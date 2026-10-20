/**
 * Noise removal with ElevenLabs Voice Isolator, run from the editor: the clip's
 * audio goes up in short WAV chunks (hosting caps request bodies at ~4.5 MB),
 * the cleaned chunks come back and are stitched into one 48 kHz mono track on
 * the clip's own timeline, so the preview and the export can use it like the
 * in-browser denoiser's output.
 */

const RATE = 48_000; // output, same as denoiseBuffer
const UPLOAD_RATE = 24_000; // speech loses nothing audible; keeps chunks small
const CHUNK = 30; // seconds per request
const OVERLAP = 1; // seconds shared by neighbouring chunks, crossfaded
const MIN_CHUNK = 5; // very short uploads are refused, so pad up to this

export type IsolateChunk = (
  wavBase64: string,
) => Promise<{ audioBase64: string; mime: string } | { unavailable: true }>;

/**
 * The cleaned clip audio, or null when voice isolation is not set up on the
 * server (the caller then uses the in-browser denoiser). Errors are thrown.
 */
export async function isolateVoiceBuffer(
  input: AudioBuffer,
  call: IsolateChunk,
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (done: number) => void } = {},
): Promise<AudioBuffer | null> {
  const mono = await toMono(input, RATE);
  const total = mono.length;
  const output = new Float32Array(total);
  const step = (CHUNK - OVERLAP) * RATE;
  const starts: number[] = [];
  for (let at = 0; at < total; at += step) {
    // fold a short tail into the chunk before it
    if (starts.length && total - at < MIN_CHUNK * RATE) break;
    starts.push(at);
  }

  let done = 0;
  onProgress?.(0);
  for (const [index, start] of starts.entries()) {
    if (signal?.aborted) throw new DOMException("ยกเลิกแล้ว", "AbortError");
    const end = index === starts.length - 1 ? total : Math.min(total, start + CHUNK * RATE);
    const piece = mono.subarray(start, end);
    const result = await call(await encodeWavBase64(piece, RATE, UPLOAD_RATE));
    if ("unavailable" in result) return null;
    const cleaned = await decodeTo(result.audioBase64, result.mime, RATE);
    // Encoders add a little delay or padding: line the result up with the
    // original by where they match best, so lips and voice stay together.
    const shift = bestShift(piece, cleaned);
    const fadeIn = index === 0 ? 0 : OVERLAP * RATE;
    for (let i = 0; i < piece.length; i++) {
      const value = cleaned[i + shift] ?? 0;
      const at = start + i;
      if (i < fadeIn) {
        const t = i / fadeIn; // crossfade with the previous chunk's tail
        output[at] = output[at]! * (1 - t) + value * t;
      } else {
        output[at] = value;
      }
    }
    done++;
    onProgress?.(done / starts.length);
  }

  const buffer = new AudioBuffer({ numberOfChannels: 1, length: total, sampleRate: RATE });
  buffer.copyToChannel(output, 0);
  return buffer;
}

async function toMono(input: AudioBuffer, rate: number): Promise<Float32Array> {
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(input.duration * rate)), rate);
  const source = offline.createBufferSource();
  source.buffer = input;
  source.connect(offline.destination); // a mono destination mixes the channels down
  source.start();
  return (await offline.startRendering()).getChannelData(0);
}

async function encodeWavBase64(samples: Float32Array, from: number, to: number): Promise<string> {
  const seconds = Math.max(MIN_CHUNK, samples.length / from);
  const offline = new OfflineAudioContext(1, Math.ceil(seconds * to), to);
  const buffer = offline.createBuffer(1, samples.length, from);
  buffer.copyToChannel(new Float32Array(samples), 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const pcm = (await offline.startRendering()).getChannelData(0);

  const bytes = new Uint8Array(44 + pcm.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, to, true);
  view.setUint32(28, to * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]!));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function decodeTo(base64: string, mime: string, rate: number): Promise<Float32Array> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const ctx = new OfflineAudioContext(1, 1, rate);
  const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);
  void mime; // decodeAudioData sniffs the format itself
  return toMono(decoded, rate);
}

/**
 * Samples to skip at the start of `cleaned` so it lines up with `original`
 * (searched within ±100 ms on a 4x-thinned copy, then refined).
 */
function bestShift(original: Float32Array, cleaned: Float32Array): number {
  const span = Math.min(original.length, cleaned.length, 10 * RATE);
  const thin = 4;
  const reach = Math.round(0.1 * RATE);
  const score = (shift: number, stride: number) => {
    let sum = 0;
    for (let i = Math.max(0, -shift); i < span && i + shift < cleaned.length; i += stride) {
      sum += original[i]! * cleaned[i + shift]!;
    }
    return sum;
  };
  // no shift unless another one matches clearly better (a silent chunk stays put)
  let best = 0;
  let bestScore = score(0, thin);
  for (let shift = -reach; shift <= reach; shift += thin) {
    const value = score(shift, thin);
    if (value > bestScore * 1.05 + 1e-9) [best, bestScore] = [shift, value];
  }
  const coarse = best;
  bestScore = score(coarse, 1);
  for (let shift = coarse - thin + 1; shift < coarse + thin; shift++) {
    const value = score(shift, 1);
    if (value > bestScore) [best, bestScore] = [shift, value];
  }
  return best;
}
