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

async function seek(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.015) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error("เลื่อนไปยังช่วงวิดีโอไม่สำเร็จ")); }, 6000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", failed);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("อ่านช่วงวิดีโอไม่สำเร็จ")); };
    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("error", failed, { once: true });
    video.currentTime = time;
  });
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
  options: { noiseReduction?: boolean; smoothCuts?: boolean; signal?: AbortSignal } = {},
): Promise<Blob> {
  if (!segments.length) throw new Error("ยังไม่ได้วิเคราะห์ช่วงเงียบ");
  if (typeof MediaRecorder === "undefined") throw new Error("เบราว์เซอร์นี้ไม่รองรับการอัดวิดีโอ");

  const video = document.createElement("video");
  video.src = url;
  video.muted = false;
  video.volume = 0;
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

    let audioContext: AudioContext | null = null;
    let boundaryGain: GainNode | null = null;
    if (options.noiseReduction || options.smoothCuts) {
      audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(video);
      const highpass = audioContext.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = options.noiseReduction ? 95 : 20;
      const lowpass = audioContext.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = options.noiseReduction ? 10500 : 20000;
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = options.noiseReduction ? -38 : -24;
      compressor.ratio.value = options.noiseReduction ? 5 : 2;
      boundaryGain = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();
      source.connect(highpass).connect(lowpass).connect(compressor).connect(boundaryGain).connect(destination);
      stream.getAudioTracks().forEach((track) => { stream.removeTrack(track); track.stop(); });
      destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    }

    const chunks: BlobPart[] = [];
    const mimeType = pickMime();
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 128_000,
    });
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

    const total = segments.reduce((n, s) => n + (s.end - s.start), 0);
    let elapsed = 0;

    if (audioContext && audioContext.state === "suspended") await audioContext.resume();

    // Prime the decoder, then record with a timeslice so chunks flush steadily.
    await seek(video, segments[0]!.start);
    recorder.start(500);
    await new Promise((r) => setTimeout(r, 120));

    for (const seg of segments) {
      await seek(video, seg.start);
      if (audioContext && boundaryGain && options.smoothCuts) {
        const now = audioContext.currentTime;
        const length = Math.max(0.06, seg.end - seg.start);
        const fade = Math.min(0.05, length / 4);
        boundaryGain.gain.cancelScheduledValues(now);
        boundaryGain.gain.setValueAtTime(0.0001, now);
        boundaryGain.gain.exponentialRampToValueAtTime(1, now + fade);
        boundaryGain.gain.setValueAtTime(1, now + Math.max(fade + 0.01, length - fade));
        boundaryGain.gain.exponentialRampToValueAtTime(0.0001, now + length);
      }
      try {
        await video.play();
      } catch {
        throw new Error("เบราว์เซอร์บล็อกการเล่นวิดีโอ กรุณากดปุ่มอีกครั้ง");
      }
      await new Promise<void>((resolve) => {
        let last = -1;
        let stalled = 0;
        const tick = () => {
          const time = video.currentTime;
          if (time >= seg.end || video.ended) {
            video.pause();
            resolve();
            return;
          }
          if (Math.abs(time - last) < 0.0005) {
            stalled += 1;
            if (stalled > 240) { video.pause(); resolve(); return; }
          } else {
            stalled = 0;
          }
          last = time;
          onProgress?.(Math.min(1, (elapsed + (time - seg.start)) / total));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      elapsed += seg.end - seg.start;
      onProgress?.(Math.min(1, elapsed / total));
    }

    await new Promise((r) => setTimeout(r, 250));
    recorder.requestData();
    recorder.stop();
    await done;
    const result = new Blob(chunks, { type: mimeType });
    if (audioContext) void audioContext.close();
    if (result.size < 1024) throw new Error("ไฟล์วิดีโอที่ตัดไม่มีข้อมูล กรุณาลองใช้ Chrome หรือ Edge");
    return result;

  } finally {
    video.pause();
    video.remove();
  }
}
