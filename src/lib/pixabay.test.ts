import { mapPixabayHits } from "./pixabay";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Shapes follow the Pixabay API documentation (videos and images endpoints).
const videos = mapPixabayHits("videos", [
  {
    id: 125,
    pageURL: "https://pixabay.com/videos/id-125/",
    duration: 12,
    user: "Coverr-Free-Footage",
    videos: {
      large: {
        url: "https://cdn.pixabay.com/v/large.mp4",
        width: 3840,
        height: 2160,
        size: 90_000_000,
        thumbnail: "https://cdn.pixabay.com/v/large.jpg",
      },
      medium: {
        url: "https://cdn.pixabay.com/v/medium.mp4",
        width: 1920,
        height: 1080,
        size: 12_000_000,
        thumbnail: "https://cdn.pixabay.com/v/medium.jpg",
      },
      small: {
        url: "https://cdn.pixabay.com/v/small.mp4",
        width: 1280,
        height: 720,
        size: 6_000_000,
        thumbnail: "https://cdn.pixabay.com/v/small.jpg",
      },
      tiny: {
        url: "https://cdn.pixabay.com/v/tiny.mp4",
        width: 960,
        height: 540,
        size: 2_000_000,
        thumbnail: "https://cdn.pixabay.com/v/tiny.jpg",
      },
    },
  },
  { id: 7, videos: {} },
]);
assert(videos.length === 1, "skips hits without files");
assert(videos[0]!.assetUrl.endsWith("medium.mp4"), "picks the 1080p rendition, not 4K");
assert(videos[0]!.previewUrl.endsWith("tiny.jpg"), "uses the small thumbnail");
assert(videos[0]!.duration === 12 && videos[0]!.assetType === "video", "video fields");

const huge = mapPixabayHits("videos", [
  {
    id: 9,
    videos: {
      medium: { url: "https://cdn.pixabay.com/m.mp4", width: 1920, height: 1080, size: 80_000_000 },
      small: { url: "https://cdn.pixabay.com/s.mp4", width: 1280, height: 720, size: 9_000_000 },
    },
  },
]);
assert(huge[0]!.assetUrl.endsWith("s.mp4"), "skips renditions over 40MB");

const images = mapPixabayHits("images", [
  {
    id: 1,
    user: "a",
    webformatURL: "https://pixabay.com/get/w.jpg",
    largeImageURL: "https://pixabay.com/get/l.jpg",
    imageWidth: 4000,
    imageHeight: 3000,
  },
]);
assert(
  images[0]!.assetUrl.endsWith("l.jpg") && images[0]!.previewUrl.endsWith("w.jpg"),
  "image urls",
);

console.log("pixabay tests passed");
