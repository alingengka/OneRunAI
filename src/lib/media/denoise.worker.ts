/// <reference lib="webworker" />
/**
 * Runs the noise-removal models off the page's main thread (see denoise.ts).
 * One job per worker: the page closes it afterwards to free the model.
 */
import { cleanSamples } from "./denoise-core";

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (
  event: MessageEvent<{ source: Float32Array<ArrayBuffer>; limitDb: number }>,
) => {
  try {
    const result = await cleanSamples(event.data.source, event.data.limitDb, {
      onProgress: (done) => scope.postMessage({ type: "progress", done }),
    });
    if (!result) scope.postMessage({ type: "done", samples: null, engine: "rnnoise" });
    else
      scope.postMessage({ type: "done", samples: result.samples, engine: result.engine }, [
        result.samples.buffer,
      ]);
  } catch (error) {
    scope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
