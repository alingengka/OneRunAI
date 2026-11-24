/**
 * iPhone Safari caps the memory all canvases on a page may use together, and
 * a canvas keeps its share until garbage collection, which can take a long
 * time. Once over the cap, a new canvas silently gets no pixels and making a
 * video frame from it fails ("Canvas has no frame"), and the page can then be
 * closed for using too much memory. Shrinking a canvas to nothing gives its
 * share back at once, so every canvas made for a job is released after it.
 */
export function releaseCanvas(canvas: HTMLCanvasElement | OffscreenCanvas | null | undefined) {
  if (!canvas) return;
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    /* a transferred OffscreenCanvas cannot be resized */
  }
}
