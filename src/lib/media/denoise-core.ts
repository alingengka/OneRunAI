/**
 * The noise-removal models themselves, shared by the denoise worker (where
 * they normally run, off the page's main thread) and the in-page fallback.
 * Input and output are 48 kHz mono samples on the clip's timeline.
 */

export type DenoiseEngine = "deepfilter" | "rnnoise";

const RATE = 48_000; // both models work on 48 kHz audio in 10 ms frames

type Options = {
  signal?: AbortSignal | undefined;
  onProgress?: ((done: number) => void) | undefined;
};

/** Cleaned samples, or null when neither model could load. */
export async function cleanSamples(
  source: Float32Array<ArrayBuffer>,
  limitDb: number,
  options: Options = {},
): Promise<{ samples: Float32Array<ArrayBuffer>; engine: DenoiseEngine } | null> {
  let engine: DenoiseEngine = "deepfilter";
  let target = await runDeepFilter(source, limitDb, options).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("[denoise] DeepFilterNet unavailable, using RNNoise", error);
    return null;
  });
  if (!target) {
    engine = "rnnoise";
    target = await runRnnoise(source, limitDb, options).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      console.error("[denoise] RNNoise failed to load", error);
      return null;
    });
  }
  if (!target) return null;

  // Removing the noise also takes some energy out of the speech: bring the
  // voice back towards its old level (at most +4 dB, so leftover noise is not pumped up).
  const gain = Math.min(
    1.6,
    Math.max(1, speechLevel(source) / Math.max(1e-6, speechLevel(target))),
  );
  if (gain > 1.01) for (let i = 0; i < target.length; i++) target[i]! *= gain;
  return { samples: target, engine };
}

async function runDeepFilter(
  source: Float32Array<ArrayBuffer>,
  limitDb: number,
  { signal, onProgress }: Options,
): Promise<Float32Array<ArrayBuffer>> {
  const [{ DeepFilter }, { default: wasmUrl }] = await Promise.all([
    import("@lofcz/deepfilternet-web"),
    import("@lofcz/deepfilternet-web/df_bg.wasm?url"),
  ]);
  const df = await DeepFilter.create({ wasmUrl, attenuationLimit: limitDb });
  try {
    return await runFrames(source, df.frameLength, (frame) => df.process(frame), {
      signal,
      onProgress,
    });
  } finally {
    df.destroy();
  }
}

async function runRnnoise(
  source: Float32Array<ArrayBuffer>,
  limitDb: number,
  { signal, onProgress }: Options,
): Promise<Float32Array<ArrayBuffer>> {
  const { Rnnoise } = await import("@shiguredo/rnnoise-wasm");
  const rnnoise = await Rnnoise.load();
  const state = rnnoise.createDenoiseState();
  const scale = 32768; // RNNoise expects 16-bit sample values in float form
  try {
    const target = await runFrames(
      source,
      rnnoise.frameSize,
      (frame) => {
        for (let i = 0; i < frame.length; i++) frame[i]! *= scale;
        state.processFrame(frame);
        for (let i = 0; i < frame.length; i++) frame[i]! /= scale;
        return frame;
      },
      { signal, onProgress },
    );
    // RNNoise has no cap of its own: keep the original underneath at the limit
    const dry = 10 ** (-limitDb / 20);
    for (let i = 0; i < target.length; i++) target[i]! += source[i]! * dry;
    return target;
  } finally {
    state.destroy();
  }
}

/** RNNoise answers 2 frames late and DeepFilterNet3 3 frames (measured); allow some margin. */
const MAX_DELAY_FRAMES = 6;

/**
 * Feeds `source` through a frame-based model and returns the result lined up
 * with the input: both models answer a few frames late, so the delay is
 * measured (it is a whole number of frames) and taken back out.
 */
async function runFrames(
  source: Float32Array<ArrayBuffer>,
  frameSize: number,
  process: (frame: Float32Array<ArrayBuffer>) => Float32Array,
  { signal, onProgress }: Options,
): Promise<Float32Array<ArrayBuffer>> {
  const extra = frameSize * MAX_DELAY_FRAMES;
  const length = source.length;
  const raw = new Float32Array(length + extra + frameSize);
  let lastYield = performance.now();
  for (let start = 0; start < length + extra; start += frameSize) {
    const frame = new Float32Array(frameSize);
    frame.set(source.subarray(start, Math.min(length, start + frameSize)));
    raw.set(process(frame).subarray(0, frameSize), start);
    if (performance.now() - lastYield > 40) {
      // keep the page responsive on long clips
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (signal?.aborted) throw new DOMException("ยกเลิกแล้ว", "AbortError");
      onProgress?.(Math.min(1, start / length));
      lastYield = performance.now();
    }
  }
  const delay = frameDelay(source, raw, frameSize);
  return raw.slice(delay, delay + length);
}

function frameDelay(source: Float32Array, raw: Float32Array, frameSize: number): number {
  const span = Math.min(source.length, 20 * RATE);
  let best = 0;
  let bestScore = -Infinity;
  for (let frames = 0; frames <= MAX_DELAY_FRAMES; frames++) {
    const shift = frames * frameSize;
    let score = 0;
    for (let i = 0; i < span; i += 2) score += source[i]! * raw[i + shift]!;
    if (score > bestScore) [best, bestScore] = [shift, score];
  }
  return best;
}

/** Level of the loud (speech) parts: the 90th percentile of 100 ms RMS windows. */
function speechLevel(samples: Float32Array): number {
  const window = RATE / 10;
  const levels: number[] = [];
  for (let start = 0; start + window <= samples.length; start += window) {
    let sum = 0;
    for (let i = start; i < start + window; i++) sum += samples[i]! * samples[i]!;
    levels.push(Math.sqrt(sum / window));
  }
  levels.sort((a, b) => a - b);
  return levels[Math.floor(levels.length * 0.9)] ?? 0;
}
