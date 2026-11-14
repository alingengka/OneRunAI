/**
 * A light 720p copy of a heavy clip, played in the editor instead of the
 * original (like CapCut's proxy media). A 4K or Cinematic phone clip made the
 * preview stutter or stall and could get the page closed on iPhone; exports
 * still read the original file at full quality.
 */
import { knownAudio } from "./audio-track";

/** Short side of the preview copy, in pixels. */
const PREVIEW_SIZE = 720;

/**
 * Whether `file` is worth a preview copy: larger than full HD, or carrying a
 * main audio track the browser cannot play (iPhone Spatial Audio), which left
 * the preview silent.
 */
export async function needsPreviewProxy(file: Blob): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return false;
  try {
    const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      const video = await input.getPrimaryVideoTrack();
      if (!video) return false;
      if (Math.min(video.displayWidth, video.displayHeight) > 1100) return true;
      const main = await input.getPrimaryAudioTrack();
      const playable = await input.getPrimaryAudioTrack(knownAudio);
      return !!main && !!playable && main !== playable;
    } finally {
      input.dispose();
    }
  } catch {
    return false;
  }
}

/**
 * Re-encodes `file` to a 720p H.264 MP4 with the playable audio track, key
 * frames every second so scrubbing stays quick. Resolves to null when this
 * browser cannot do it, so the editor keeps playing the original.
 */
export async function makePreviewProxy(
  file: Blob,
  {
    onProgress,
    cancelled,
  }: { onProgress?: (ratio: number) => void; cancelled?: () => boolean } = {},
): Promise<Blob | null> {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } =
    await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video || !(await video.canDecode())) return null;
    const audio = await input.getPrimaryAudioTrack(knownAudio);
    const portrait = video.displayHeight >= video.displayWidth;
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "all",
      video: (track) =>
        track === video
          ? {
              ...(portrait ? { width: PREVIEW_SIZE } : { height: PREVIEW_SIZE }),
              codec: "avc",
              bitrate: 2_500_000,
              keyFrameInterval: 1,
              forceTranscode: true,
            }
          : { discard: true },
      audio: (track) => (track === audio ? { codec: "aac" } : { discard: true }),
      showWarnings: false,
    });
    if (!conversion.isValid) return null;
    conversion.onProgress = (progress) => {
      if (cancelled?.()) void conversion.cancel();
      else onProgress?.(progress);
    };
    await conversion.execute();
    if (cancelled?.() || !output.target.buffer) return null;
    return new Blob([output.target.buffer], { type: "video/mp4" });
  } catch {
    return null;
  } finally {
    input.dispose();
  }
}
