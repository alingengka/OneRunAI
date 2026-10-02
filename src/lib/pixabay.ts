/** Pure helpers for Pixabay search results (shared by the server function and tests). */

export type PixabayItem = {
  id: string;
  /** thumbnail for the grid */
  previewUrl: string;
  /** file to copy into storage */
  assetUrl: string;
  assetType: "image" | "video";
  width: number;
  height: number;
  /** seconds, videos only */
  duration?: number | undefined;
  author: string;
  pageUrl: string;
};

type VideoFile = {
  url?: string;
  width?: number;
  height?: number;
  size?: number;
  thumbnail?: string;
};
type RawVideo = {
  id: number;
  pageURL?: string;
  duration?: number;
  picture_id?: string;
  user?: string;
  videos?: Partial<Record<"large" | "medium" | "small" | "tiny", VideoFile>>;
};
type RawImage = {
  id: number;
  pageURL?: string;
  user?: string;
  webformatURL?: string;
  largeImageURL?: string;
  previewURL?: string;
  imageWidth?: number;
  imageHeight?: number;
};

/** Largest rendition at most ~1080p and ~40MB, so copying stays quick. */
function pickVideoFile(videos: RawVideo["videos"]): VideoFile | undefined {
  if (!videos) return undefined;
  const order = ["medium", "large", "small", "tiny"] as const;
  for (const key of order) {
    const file = videos[key];
    if (!file?.url) continue;
    const longSide = Math.max(file.width ?? 0, file.height ?? 0);
    if (longSide > 1920 || (file.size ?? 0) > 40_000_000) continue;
    return file;
  }
  return videos.small ?? videos.tiny;
}

/** Turns Pixabay search hits into picker items (videos or photos). */
export function mapPixabayHits(kind: "videos" | "images", hits: unknown[]): PixabayItem[] {
  const items: PixabayItem[] = [];
  for (const raw of hits) {
    if (kind === "videos") {
      const video = raw as RawVideo;
      const file = pickVideoFile(video.videos);
      if (!file?.url) continue;
      const thumb =
        video.videos?.tiny?.thumbnail ??
        video.videos?.small?.thumbnail ??
        file.thumbnail ??
        (video.picture_id ? `https://i.vimeocdn.com/video/${video.picture_id}_295x166.jpg` : "");
      items.push({
        id: String(video.id),
        previewUrl: thumb,
        assetUrl: file.url,
        assetType: "video",
        width: file.width ?? 0,
        height: file.height ?? 0,
        duration: video.duration,
        author: video.user ?? "Pixabay",
        pageUrl: video.pageURL ?? "https://pixabay.com",
      });
    } else {
      const image = raw as RawImage;
      const asset = image.largeImageURL ?? image.webformatURL;
      if (!asset) continue;
      items.push({
        id: String(image.id),
        previewUrl: image.webformatURL ?? image.previewURL ?? asset,
        assetUrl: asset,
        assetType: "image",
        width: image.imageWidth ?? 0,
        height: image.imageHeight ?? 0,
        author: image.user ?? "Pixabay",
        pageUrl: image.pageURL ?? "https://pixabay.com",
      });
    }
  }
  return items;
}
