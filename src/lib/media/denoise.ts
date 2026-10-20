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
  strong: 30,
};

export type { DenoiseEngine } from "./denoise-core";
import type { DenoiseEngine } from "./denoise-core";

const RATE = 48_000;

type Options = {
  strength?: DenoiseStrength | undefined;
  signal?: AbortSignal | undefined;
  onProgress?: ((done: number) => void) | undefined;
};

/**
 * A denoised mono copy of `input` at 48 kHz, or null when neither model could
 * load (the caller then keeps the plain filters). The models run in a worker
 * so the page (preview, timeline, export) stays smooth, and the worker is
 * closed afterwards so the model's memory is given back.
 */
export async function denoiseBuffer(
  input: AudioBuffer,
  options: Options = {},
): Promise<{ buffer: AudioBuffer; engine: DenoiseEngine } | null> {
  // Phone speech is effectively mono: clean one mixed channel (half the work
  // and memory); playback spreads it over both speakers.
  const source = await toMono48k(input);
  const limit = DENOISE_LIMIT_DB[options.strength ?? "normal"];
  let result: { samples: Float32Array<ArrayBuffer>; engine: DenoiseEngine } | null;
  try {
    result = await cleanInWorker(source.slice(), limit, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("[denoise] worker unavailable, cleaning on the page", error);
    const { cleanSamples } = await import("./denoise-core");
    result = await cleanSamples(source, limit, options);
  }
  if (!result) return null;
  const buffer = new AudioBuffer({
    numberOfChannels: 1,
    length: result.samples.length,
    sampleRate: RATE,
  });
  buffer.copyToChannel(result.samples, 0);
  return { buffer, engine: result.engine };
}

type WorkerReply =
  | { type: "progress"; done: number }
  | { type: "done"; samples: Float32Array<ArrayBuffer> | null; engine: DenoiseEngine }
  | { type: "error"; message: string };

function cleanInWorker(
  source: Float32Array<ArrayBuffer>,
  limitDb: number,
  { signal, onProgress }: Options,
): Promise<{ samples: Float32Array<ArrayBuffer>; engine: DenoiseEngine } | null> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./denoise.worker.ts", import.meta.url), {
      type: "module",
    });
    const finish = () => {
      worker.terminate();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException("ยกเลิกแล้ว", "AbortError"));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort);
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      const reply = event.data;
      if (reply.type === "progress") onProgress?.(reply.done);
      else if (reply.type === "done") {
        finish();
        resolve(reply.samples ? { samples: reply.samples, engine: reply.engine } : null);
      } else {
        finish();
        reject(new Error(reply.message));
      }
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "denoise worker failed"));
    };
    worker.postMessage({ source, limitDb }, [source.buffer]);
  });
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
