import type { Segment } from "./audio";

type Progress = (ratio: number) => void;

function pickMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

/**
 * Render a real, silence-free video by playing only the speech segments of the
 * source clip and recording the element's captured stream.
 * Runs in realtime (kept duration), so it's meant for short clips.
 */
export async function exportTrimmedWebm(
  url: string,
  segments: Segment[],
  onProgress?: Progress,
): Promise<Blob> {
  if (!segments.length) throw new Error("ยังไม่ได้วิเคราะห์ช่วงเงียบ");
  if (typeof MediaRecorder === "undefined") throw new Error("เบราว์เซอร์นี้ไม่รองรับการอัดวิดีโอ");

  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.style.position = "fixed";
  video.style.left = "-10000px";
  video.style.width = "320px";
  document.body.appendChild(video);

  const waitFor = (ev: string) =>
    new Promise<void>((resolve, reject) => {
      const ok = () => { cleanup(); resolve(); };
      const bad = () => { cleanup(); reject(new Error("โหลดวิดีโอไม่สำเร็จ")); };
      const cleanup = () => {
        video.removeEventListener(ev, ok);
        video.removeEventListener("error", bad);
      };
      video.addEventListener(ev, ok, { once: true });
      video.addEventListener("error", bad, { once: true });
    });

  try {
    await waitFor("loadedmetadata");

    const capture = (video as HTMLVideoElement & {
      captureStream?: (fps?: number) => MediaStream;
      mozCaptureStream?: (fps?: number) => MediaStream;
    });
    const stream = capture.captureStream?.(30) ?? capture.mozCaptureStream?.(30);
    if (!stream) throw new Error("เบราว์เซอร์นี้ไม่รองรับการบันทึกวิดีโอ");

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: pickMime() });
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

    const total = segments.reduce((n, s) => n + (s.end - s.start), 0);
    let elapsed = 0;

    recorder.start(250);

    for (const seg of segments) {
      video.currentTime = seg.start;
      await waitFor("seeked");
      await video.play();
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (video.currentTime >= seg.end || video.ended) {
            video.pause();
            resolve();
            return;
          }
          onProgress?.(Math.min(1, (elapsed + (video.currentTime - seg.start)) / total));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      elapsed += seg.end - seg.start;
      onProgress?.(Math.min(1, elapsed / total));
    }

    recorder.stop();
    await done;
    return new Blob(chunks, { type: "video/webm" });
  } finally {
    video.pause();
    video.remove();
  }
}
