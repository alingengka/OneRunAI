/**
 * Background-noise removal (traffic, wind, fans, room hiss) for the preview
 * and the export, run in the browser on the clip's decoded audio with
 * RNNoise at full strength (see denoise-core.ts).
 */

const RATE = 48_000;

type Options = {
  signal?: AbortSignal | undefined;
  onProgress?: ((done: number) => void) | undefined;
};

/**
 * A denoised mono copy of `input` at 48 kHz, or null when the model could not
 * load (the caller then keeps the plain filters). The model runs in a worker
 * so the page (preview, timeline, export) stays smooth, and the worker is
 * closed afterwards so its memory is given back.
 */
export async function denoiseBuffer(
  input: AudioBuffer,
  options: Options = {},
): Promise<AudioBuffer | null> {
  // Phone speech is effectively mono: clean one mixed channel (half the work
  // and memory); playback spreads it over both speakers.
  const source = await toMono48k(input);
  let samples: Float32Array<ArrayBuffer> | null;
  try {
    samples = await cleanInWorker(source.slice(), options);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    console.error("[denoise] worker unavailable, cleaning on the page", error);
    const { cleanSamples } = await import("./denoise-core");
    samples = await cleanSamples(source, options);
  }
  if (!samples) return null;
  const buffer = new AudioBuffer({ numberOfChannels: 1, length: samples.length, sampleRate: RATE });
  buffer.copyToChannel(samples, 0);
  return buffer;
}

type WorkerReply =
  | { type: "progress"; done: number }
  | { type: "done"; samples: Float32Array<ArrayBuffer> | null }
  | { type: "error"; message: string };

function cleanInWorker(
  source: Float32Array<ArrayBuffer>,
  { signal, onProgress }: Options,
): Promise<Float32Array<ArrayBuffer> | null> {
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
        resolve(reply.samples);
      } else {
        finish();
        reject(new Error(reply.message));
      }
    };
    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "denoise worker failed"));
    };
    worker.postMessage({ source }, [source.buffer]);
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
