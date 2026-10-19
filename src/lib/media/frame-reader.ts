/**
 * Reads video frames in order with WebCodecs (via mediabunny) instead of
 * seeking a <video> element once per frame. A seek decodes from the previous
 * keyframe every time, which made export many times slower than decoding the
 * frames one after another.
 */

export type FrameReader = {
  /** The frame for the next planned timestamp, or null when it could not be decoded. */
  next: () => Promise<CanvasImageSource | null>;
  dispose: () => void;
};

/**
 * Opens a reader that yields one canvas per entry of `times` (seconds), sized
 * and fitted to `size`. Returns null when this browser cannot decode the clip,
 * so the caller can fall back to seeking.
 */
export async function openFrameReader(
  blob: Blob,
  times: number[],
  size: { width: number; height: number; fit: "fill" | "cover" },
): Promise<FrameReader | null> {
  if (typeof VideoDecoder === "undefined" || !times.length) return null;
  let dispose = () => {};
  try {
    const { ALL_FORMATS, BlobSource, CanvasSink, Input } = await import("mediabunny");
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    dispose = () => input.dispose();
    const track = await input.getPrimaryVideoTrack();
    // Without a color matrix tag, decoded frames draw with different colors than
    // the <video> element shows, so such clips keep the slower seeking path.
    const untagged = track ? !(await track.getColorSpace()).matrix : true;
    if (!track || untagged || !(await track.canDecode())) {
      dispose();
      return null;
    }
    // A pool of 2 is enough: each canvas is drawn before the next one is asked for.
    const sink = new CanvasSink(track, { ...size, poolSize: 2 });
    // iPhone clips often start their first frame a little after 0. Times before
    // it have no frame, and falling back to the <video> there painted black, so
    // they show the first frame instead.
    const first = await track.getFirstTimestamp().catch(() => 0);
    const frames = sink.canvasesAtTimestamps(times.map((time) => Math.max(time, first)));
    return {
      next: async () => {
        const result = await frames.next();
        return result.done
          ? null
          : ((result.value?.canvas as CanvasImageSource | undefined) ?? null);
      },
      dispose: () => {
        void frames.return(undefined).catch(() => undefined);
        dispose();
      },
    };
  } catch {
    dispose();
    return null;
  }
}

/**
 * Duration and display size read from the file itself. iPhone Safari does not
 * load a <video> it has not played, so waiting on its metadata can hang.
 */
export async function probeVideo(
  blob: Blob,
): Promise<{ duration: number; width: number; height: number } | null> {
  try {
    const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) return null;
      const duration = await input.computeDuration();
      if (!(duration > 0) || !track.displayWidth || !track.displayHeight) return null;
      return { duration, width: track.displayWidth, height: track.displayHeight };
    } finally {
      input.dispose();
    }
  } catch {
    return null;
  }
}
