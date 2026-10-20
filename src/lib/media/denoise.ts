/**
 * Background-noise removal (traffic, wind, fans, room hiss) for the preview
 * and the export, run in the browser on the clip's decoded audio:
 *
 * - DeepFilterNet3 (WASM SIMD build of libDF): a modern speech-enhancement
 *   network with a built-in cap on how much it removes, so pauses keep a
 *   natural room tone instead of dead digital silence.
 * - RNNoise: the small older model, only where DeepFilterNet cannot run
 *   (browsers without WASM SIMD); its cap is a quiet blend of the original.
 */

export type DenoiseStrength = "light" | "normal" | "strong";

/**
 * Most the background may be lowered, in dB. Removing every trace of it
 * leaves speech popping in and out of silence, which sounds strange.
 */
export const DENOISE_LIMIT_DB: Record<DenoiseStrength, number> = {
  light: 12,
  normal: 26,
  strong: 34,
};

export type DenoiseEngine = "deepfilter" | "rnnoise";

const RATE = 48_000; // both models work on 48 kHz audio in 10 ms frames

type Options = {
  strength?: DenoiseStrength | undefined;
  signal?: AbortSignal | undefined;
  onProgress?: ((done: number) => void) | undefined;
};

/**
 * A denoised mono copy of `input` at 48 kHz, or null when neither model could
 * load (the caller then keeps the plain filters).
 */
export async function denoiseBuffer(
  input: AudioBuffer,
  options: Options = {},
): Promise<{ buffer: AudioBuffer; engine: DenoiseEngine } | null> {
  // Phone speech is effectively mono: clean one mixed channel (half the work
  // and memory); playback spreads it over both speakers.
  const source = await toMono48k(input);
  const limit = DENOISE_LIMIT_DB[options.strength ?? "normal"];
  let engine: DenoiseEngine = "deepfilter";
  let target = await runDeepFilter(source, limit, options).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("[denoise] DeepFilterNet unavailable, using RNNoise", error);
    return null;
  });
  if (!target) {
    engine = "rnnoise";
    target = await runRnnoise(source, limit, options).catch((error: unknown) => {
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
  const buffer = new AudioBuffer({ numberOfChannels: 1, length: target.length, sampleRate: RATE });
  buffer.copyToChannel(target, 0);
  return { buffer, engine };
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

async function toMono48k(input: AudioBuffer): Promise<Float32Array<ArrayBuffer>> {
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(input.duration * RATE)), RATE);
  const node = offline.createBufferSource();
  node.buffer = input;
  node.connect(offline.destination); // a mono destination mixes the channels down
  node.start();
  const rendered = await offline.startRendering();
  return new Float32Array(rendered.getChannelData(0));
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
