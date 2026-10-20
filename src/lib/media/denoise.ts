/**
 * Real background-noise removal for the export (fans, traffic, wind, room
 * hiss): RNNoise, a small speech-denoising neural network, run over the clip's
 * decoded audio. Unlike the old noise gate it also cleans the noise *under*
 * speech, not just the pauses between words.
 */

const RATE = 48_000; // RNNoise works on 48 kHz audio in 10 ms frames
const PCM_SCALE = 32768; // it expects 16-bit sample values in float form

/**
 * A denoised copy of `input` at 48 kHz (up to 2 identical channels), or null when the
 * model could not load, so the caller can keep the plain filters.
 */
export async function denoiseBuffer(
  input: AudioBuffer,
  signal?: AbortSignal,
): Promise<AudioBuffer | null> {
  let rnnoise: Awaited<ReturnType<typeof import("@shiguredo/rnnoise-wasm").Rnnoise.load>>;
  try {
    const { Rnnoise } = await import("@shiguredo/rnnoise-wasm");
    rnnoise = await Rnnoise.load();
  } catch (error) {
    console.error("[denoise] RNNoise failed to load", error);
    return null;
  }

  const channels = Math.min(2, input.numberOfChannels);
  const resampled = input.sampleRate === RATE ? input : await resample(input, channels);
  const frameSize = rnnoise.frameSize;
  const length = resampled.length;
  // Phone speech is effectively mono: clean one mixed channel (half the work)
  // and put it on every output channel.
  const source = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = resampled.getChannelData(c);
    for (let i = 0; i < length; i++) source[i]! += data[i]! / channels;
  }
  const target = new Float32Array(length);
  const frame = new Float32Array(frameSize);
  // The model answers two frames late (measured), so feed two extra frames and
  // write each result two frames back: the clean audio stays in sync with the video.
  const delay = frameSize * 2;
  const state = rnnoise.createDenoiseState();
  let lastYield = performance.now();
  try {
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
        // keep the page responsive on long clips
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (signal?.aborted) throw new DOMException("ยกเลิกการเรนเดอร์", "AbortError");
        lastYield = performance.now();
      }
    }
  } finally {
    state.destroy();
  }
  // Removing the noise also takes some energy out of the speech: bring the
  // voice back to its old level (at most +6 dB, so leftover hiss is not pumped up).
  const gain = Math.min(2, Math.max(1, speechLevel(source) / Math.max(1e-6, speechLevel(target))));
  if (gain > 1.01) for (let i = 0; i < length; i++) target[i]! *= gain;
  const output = new AudioBuffer({ numberOfChannels: channels, length, sampleRate: RATE });
  for (let c = 0; c < channels; c++) output.copyToChannel(target, c);
  return output;
}

async function resample(input: AudioBuffer, channels: number): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(
    channels,
    Math.max(1, Math.ceil(input.duration * RATE)),
    RATE,
  );
  const source = offline.createBufferSource();
  source.buffer = input;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
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
