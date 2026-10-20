/**
 * The noise-removal model itself, shared by the denoise worker (where it
 * normally runs, off the page's main thread) and the in-page fallback:
 * RNNoise, a small speech-denoising network, at full strength. Input and
 * output are 48 kHz mono samples on the clip's timeline.
 */

const RATE = 48_000; // RNNoise works on 48 kHz audio in 10 ms frames
const PCM_SCALE = 32768; // it expects 16-bit sample values in float form
/** RNNoise answers this many frames late (measured); the delay is taken back out. */
const DELAY_FRAMES = 2;

type Options = {
  signal?: AbortSignal | undefined;
  onProgress?: ((done: number) => void) | undefined;
};

/** Cleaned samples, or null when the model could not load. */
export async function cleanSamples(
  source: Float32Array<ArrayBuffer>,
  { signal, onProgress }: Options = {},
): Promise<Float32Array<ArrayBuffer> | null> {
  let rnnoise: Awaited<ReturnType<typeof import("@shiguredo/rnnoise-wasm").Rnnoise.load>>;
  try {
    const { Rnnoise } = await import("@shiguredo/rnnoise-wasm");
    rnnoise = await Rnnoise.load();
  } catch (error) {
    console.error("[denoise] RNNoise failed to load", error);
    return null;
  }

  const frameSize = rnnoise.frameSize;
  const length = source.length;
  const delay = frameSize * DELAY_FRAMES;
  const target = new Float32Array(length);
  const frame = new Float32Array(frameSize);
  const state = rnnoise.createDenoiseState();
  let lastYield = performance.now();
  try {
    // feed a little past the end, and write each result back by the delay
    for (let start = 0; start < length + delay; start += frameSize) {
      for (let i = 0; i < frameSize; i++) {
        const value = source[start + i];
        frame[i] = value === undefined ? 0 : value * PCM_SCALE;
      }
      state.processFrame(frame);
      const at = start - delay;
      for (let i = 0; i < frameSize; i++) {
        const index = at + i;
        if (index >= 0 && index < length) target[index] = frame[i]! / PCM_SCALE;
      }
      if (performance.now() - lastYield > 40) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (signal?.aborted) throw new DOMException("ยกเลิกแล้ว", "AbortError");
        onProgress?.(Math.min(1, start / length));
        lastYield = performance.now();
      }
    }
  } finally {
    state.destroy();
  }

  // Removing the noise also takes some energy out of the speech: bring the
  // voice back to its old level (at most +6 dB, so leftover noise is not pumped up).
  const gain = Math.min(2, Math.max(1, speechLevel(source) / Math.max(1e-6, speechLevel(target))));
  if (gain > 1.01) for (let i = 0; i < length; i++) target[i]! *= gain;
  return target;
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
