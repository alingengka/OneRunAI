/**
 * Pictures for the timeline lanes: small video thumbnails and an audio
 * loudness curve.
 */

/** One thumbnail every `step` seconds (at most `max`), as small JPEG data URLs. */
export async function makeThumbnails(
  file: Blob,
  duration: number,
  max = 80,
): Promise<{ thumbs: string[]; step: number } | null> {
  if (!(duration > 0) || typeof VideoDecoder === "undefined") return null;
  const step = Math.max(1, Math.ceil(duration / max));
  const times: number[] = [];
  for (let t = 0; t < duration; t += step) times.push(Math.min(duration - 0.05, t + step / 2));
  try {
    const { ALL_FORMATS, BlobSource, CanvasSink, Input } = await import("mediabunny");
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track || !(await track.canDecode())) return null;
      const sink = new CanvasSink(track, { height: 72, poolSize: 1 });
      const out = document.createElement("canvas");
      const thumbs: string[] = [];
      for await (const wrapped of sink.canvasesAtTimestamps(times)) {
        if (!wrapped) {
          thumbs.push(thumbs[thumbs.length - 1] ?? "");
          continue;
        }
        out.width = wrapped.canvas.width;
        out.height = wrapped.canvas.height;
        out.getContext("2d")?.drawImage(wrapped.canvas, 0, 0);
        thumbs.push(out.toDataURL("image/jpeg", 0.6));
      }
      return { thumbs, step };
    } finally {
      input.dispose();
    }
  } catch {
    return null;
  }
}

/** Peak loudness per `step` seconds, scaled so the loudest part is 1. */
export function computePeaks(buffer: AudioBuffer, step = 0.05): number[] {
  const data = buffer.getChannelData(0);
  const size = Math.max(1, Math.round(buffer.sampleRate * step));
  const peaks: number[] = [];
  let loudest = 0;
  for (let i = 0; i < data.length; i += size) {
    let peak = 0;
    const end = Math.min(data.length, i + size);
    // Every 4th sample is plenty to find the peak of a 50 ms window.
    for (let j = i; j < end; j += 4) peak = Math.max(peak, Math.abs(data[j]!));
    peaks.push(peak);
    loudest = Math.max(loudest, peak);
  }
  return loudest > 0 ? peaks.map((p) => Math.sqrt(p / loudest)) : peaks;
}
