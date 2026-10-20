/// <reference lib="webworker" />
/**
 * Runs the noise-removal model off the page's main thread (see denoise.ts).
 * One job per worker: the page closes it afterwards to free the model.
 */
import { cleanSamples } from "./denoise-core";

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async (event: MessageEvent<{ source: Float32Array<ArrayBuffer> }>) => {
  try {
    const samples = await cleanSamples(event.data.source, {
      onProgress: (done) => scope.postMessage({ type: "progress", done }),
    });
    if (!samples) scope.postMessage({ type: "done", samples: null });
    else scope.postMessage({ type: "done", samples }, [samples.buffer]);
  } catch (error) {
    scope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
