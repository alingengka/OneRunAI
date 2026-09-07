import type { Segment } from "./audio";
import type { MotionElement, MotionScene } from "./motion";
import { createNoiseGate, type NoiseGateNode } from "./noise-gate";
import { createBurnRenderer, targetSize, type ExportResolution } from "./burn-render";
import type { CaptionGroup, CaptionStyle } from "../captions";

export { targetSize };
export type { ExportResolution };

type Progress = (ratio: number) => void;

function pickMime(): string {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

export function mimeExtension(mime: string): "mp4" | "webm" {
  return mime.startsWith("video/mp4") ? "mp4" : "webm";
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
 * Render a finished, ready-to-post video: silences removed and captions burned
 * into the frames, so the user can publish it without CapCut.
 */
export type ExportSegmentDiagnostic = {
  index: number;
  start: number;
  end: number;
  played: number;
  reason: "reached-end" | "source-ended";
};


export async function exportBurnedVideo(
  url: string,
  segments: Segment[],
  groups: CaptionGroup[],
  style: CaptionStyle,
  onProgress?: Progress,
  options: {
    noiseReduction?: boolean;
    /** RMS ของ noise floor ที่วัดจากคลิป ใช้เป็น threshold ของ noise gate */
    noiseFloor?: number;
    smoothCuts?: boolean;
    captions?: boolean;
    signal?: AbortSignal;
    scenes?: MotionScene[];
    sceneElements?: MotionElement[];
    resolution?: ExportResolution;
  } = {},
): Promise<{ blob: Blob; ext: "mp4" | "webm"; width: number; height: number; fps: number; plannedFps: number; fpsAdapted: boolean; frames: number; painted: number; chunks: number; expectedDuration: number; segments: ExportSegmentDiagnostic[]; frameStats: { avgMs: number; p95Ms: number; maxMs: number; maxAtSec: number; overBudget: number; budgetMs: number } }> {

  if (!segments.length) throw new Error("ยังไม่ได้วิเคราะห์ช่วงเงียบ");
  if (typeof MediaRecorder === "undefined") throw new Error("เบราว์เซอร์นี้ไม่รองรับการอัดวิดีโอ");

  const video = document.createElement("video");
  video.src = url;
  video.muted = false;
  // ห้ามตั้ง volume = 0: MediaElementSource ใช้ค่า volume ของ element คูณสัญญาณ
  // ที่ส่งเข้า Web Audio ด้วย ทำให้ไฟล์ที่ export ออกมาเงียบสนิท
  // (เสียงไม่ออกลำโพงอยู่แล้ว เพราะ element ถูกต่อเข้ากราฟแทน default output)
  video.volume = 1;
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

  let audioContext: AudioContext | null = null;
  let outputStream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let gate: NoiseGateNode | null = null;
  /** จำนวนเฟรมที่วาดจริง ใช้ตรวจเฟรมตกตอนเรนเดอร์ความละเอียดสูง */
  let painted = 0;
  /** สถิติเวลาวาดต่อเฟรม (ms) ใช้หาว่าเฟรมไหนช้าจนภาพกระตุก */
  const frameCosts: number[] = [];
  let frameCostTotal = 0;
  let frameCostMax = 0;
  let frameCostMaxAt = 0;
  let frameCostOverBudget = 0;

  try {
    await waitFor("loadedmetadata");
    if (video.readyState < 2) await waitFor("loadeddata");
    await ensureCaptionFonts(style);

    const sourceWidth = video.videoWidth || 1080;
    const sourceHeight = video.videoHeight || 1920;
    const target = targetSize(sourceWidth, sourceHeight, options.resolution ?? "source");
    const width = target.width;
    const height = target.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("เบราว์เซอร์นี้ไม่รองรับการเรนเดอร์วิดีโอ");
    // ค่าเริ่มต้นของเบราว์เซอร์อาจเป็น "low" ทำให้ภาพที่ scale ดูเบลอ
    ctx.imageSmoothingEnabled = true;
    const smoothingOverride = (window as unknown as { __EXPORT_SMOOTHING?: ImageSmoothingQuality }).__EXPORT_SMOOTHING;
    ctx.imageSmoothingQuality = smoothingOverride ?? "high";

    // 4K canvas วาดช้ากว่ามาก จับที่ 24fps เพื่อไม่ให้เฟรมตกจนภาพกระตุก
    // 4K: การวัดจริงพบว่าเบราว์เซอร์วาด+เข้ารหัส 8.3 ล้านพิกเซลได้ ~6-12fps
    // จึงตั้งเป้าที่ 15fps (เดินสม่ำเสมอ) แทน 24/30fps ที่เฟรมหลุดเป็นช่วง ๆ
    const plannedFps = width * height >= 3840 * 2160 * 0.8 ? 15 : 30;
    let fps = plannedFps;
    let frameBudget = 1000 / fps;
    // จับเฟรมเอง (captureStream(0) + requestFrame) แทนการให้เบราว์เซอร์ดูดที่ fps
    // คงที่ ถ้าเราวาดไม่ทัน เบราว์เซอร์จะได้เฟรมห่างแบบสุ่ม (ที่ 4K เคยเหลือ 6fps
    // และเฟรมขาดช่วงเกือบทุกช่วง) การจับเองทำให้ระยะห่างเฟรมสม่ำเสมอตาม fps ที่
    // เครื่องทำได้จริง
    const stream = canvas.captureStream(0);
    const captureTrack = stream.getVideoTracks()[0] as (MediaStreamTrack & { requestFrame?: () => void }) | undefined;
    outputStream = stream;

    // Audio: route the element through Web Audio so we can clean and fade it.
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
    const boundaryGain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();
    // noise gate จริง: ลดเสียงช่วงที่เบากว่า noise floor ลงจริง ไม่ใช่แค่กรองความถี่
    gate = options.noiseReduction && options.noiseFloor
      ? await createNoiseGate(audioContext, { noiseFloor: options.noiseFloor })
      : null;
    if (gate) {
      source.connect(highpass).connect(lowpass).connect(compressor).connect(gate.input);
      gate.output.connect(boundaryGain).connect(destination);
    } else {
      source.connect(highpass).connect(lowpass).connect(compressor).connect(boundaryGain).connect(destination);
    }
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

    const mimeType = pickMime();
    const chunks: Blob[] = [];
    const chunkTimes: number[] = [];
    // bitrate ตามมาตรฐาน short-form vertical: ~0.2 bit ต่อพิกเซลต่อเฟรม
    // (720x1280@30 ≈ 11 Mbps, 1080x1920@30 ≈ 25 Mbps, 2160x3840@24 ≈ 40 Mbps)
    // สูตรเดิม width*height*0.14 ให้ 1080p แค่ ~2.9 Mbps จนภาพแตก
    const bitrateOverride = (window as unknown as { __EXPORT_BITRATE?: number }).__EXPORT_BITRATE;
    const bitrate = bitrateOverride ?? Math.min(64_000_000, Math.max(8_000_000, Math.round(width * height * fps * 0.2)));
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrate,
      audioBitsPerSecond: 128_000,
    });

    recorder.ondataavailable = (e) => {
      if (!e.data.size) return;
      chunks.push(e.data);
      chunkTimes.push(performance.now());
    };
    const done = new Promise<void>((resolve, reject) => {
      if (!recorder) { reject(new Error("สร้าง MediaRecorder ไม่สำเร็จ")); return; }
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("MediaRecorder เข้ารหัสวิดีโอไม่สำเร็จ"));
    });


    // ตัววาดร่วม (ซับ + motion + viral text) ใช้ชุดเดียวกับเส้นทาง WebCodecs
    const renderer = createBurnRenderer(ctx, width, height, groups, style, {
      captions: options.captions,
      smoothCuts: options.smoothCuts,
      scenes: options.scenes,
      sceneElements: options.sceneElements,
    });



    const normalizedSegments = segments.map((segment, index) => {
      const start = Math.max(0, Math.min(video.duration, segment.start));
      const end = Math.max(0, Math.min(video.duration, segment.end));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.02) {
        throw new Error(`ช่วงวิดีโอที่ ${index + 1} ไม่ถูกต้อง (${segment.start}–${segment.end})`);
      }
      if (index > 0 && start < Math.min(video.duration, segments[index - 1]!.end) - 0.001) {
        throw new Error(`ช่วงวิดีโอที่ ${index + 1} ซ้อนหรือเรียงลำดับผิด`);
      }
      return { start, end };
    });
    const total = normalizedSegments.reduce((n, s) => n + (s.end - s.start), 0);
    let elapsed = 0;
    const segmentDiagnostics: ExportSegmentDiagnostic[] = [];

    // A frame source that follows the decoder when available (steadier than rAF,
    // which fires on display vsync and drops frames while seeking).
    type FrameVideo = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (id: number) => void;
    };
    const frameVideo = video as FrameVideo;

    const paint = (time: number, seg: Segment) => renderer.paint(video, time, seg);


    // ---- ตัวจับเฟรมแบบปรับ fps อัตโนมัติ ----
    let lastCaptureAt = -Infinity;
    let captured = 0;
    let fpsAdapted = false;
    const recentCosts: number[] = [];
    let sinceAdapt = 0;
    const FPS_LADDER = [30, 24, 20, 15, 12, 10, 8, 6];
    const adapt = (cost: number) => {
      recentCosts.push(cost);
      if (recentCosts.length > 20) recentCosts.shift();
      sinceAdapt++;
      if (recentCosts.length < 10 || sinceAdapt < 10) return;
      sinceAdapt = 0;
      const sorted = [...recentCosts].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      if (median <= 0) return;
      // เผื่อเวลาให้ encoder/decoder อีก 25%
      const achievable = 1000 / (median * 1.25);
      const next = FPS_LADDER.find((v) => v <= plannedFps && v <= achievable) ?? FPS_LADDER[FPS_LADDER.length - 1]!;
      if (next < fps) {
        fps = next;
        frameBudget = 1000 / fps;
        fpsAdapted = true;
      }
    };
    /** ส่งเฟรมที่วาดแล้วเข้าสตรีมตามจังหวะ fps ปัจจุบัน */
    const commitFrame = (force = false) => {
      if (typeof captureTrack?.requestFrame !== "function") return;
      const now = performance.now();
      if (!force && now - lastCaptureAt < (1000 / fps) * 0.9) return;
      lastCaptureAt = now;
      captured++;
      captureTrack.requestFrame();
    };

    if (audioContext.state === "suspended") await audioContext.resume();

    // Prime the first frame so the recording never starts on a blank canvas.
    await seek(video, normalizedSegments[0]!.start);
    paint(normalizedSegments[0]!.start, normalizedSegments[0]!);


    // เฟดเสียงตรงรอยตัด "ตามเวลาจริงของวิดีโอ" ไม่ใช่ตารางเวลาของ AudioContext
    // (การจองล่วงหน้าทำให้เกนค้างที่ค่าต่ำสุดเมื่อการเล่นช้ากว่ากำหนด → ไฟล์เงียบ)
    let lastBoundaryTarget = -1;
    let lastBoundaryUpdate = -Infinity;
    const applyBoundaryGain = (time: number, seg: Segment, force = false) => {
      if (options.smoothCuts === false || !audioContext) return;
      const length = Math.max(0.06, seg.end - seg.start);
      const fade = Math.min(0.05, length / 4);
      const edge = Math.max(0, Math.min(time - seg.start, seg.end - time));
      const target = Math.max(0.0001, Math.min(1, edge / fade));
      if (!force && Math.abs(target - lastBoundaryTarget) < 0.04 && time - lastBoundaryUpdate < 0.025) return;
      boundaryGain.gain.setTargetAtTime(target, audioContext.currentTime, 0.008);
      lastBoundaryTarget = target;
      lastBoundaryUpdate = time;
    };

    const transitionRecorder = (target: "paused" | "recording") => new Promise<void>((resolve, reject) => {
      if (!recorder) { reject(new Error("MediaRecorder ถูกปิดก่อน export เสร็จ")); return; }
      if (recorder.state === target) { resolve(); return; }
      const event = target === "paused" ? "pause" : "resume";
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error(`MediaRecorder ไม่เข้าสู่สถานะ ${target}`)); }, 3000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        recorder?.removeEventListener(event, done);
        recorder?.removeEventListener("error", failed);
      };
      const done = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error("MediaRecorder หยุดทำงานระหว่าง export")); };
      recorder.addEventListener(event, done, { once: true });
      recorder.addEventListener("error", failed, { once: true });
      if (target === "paused") recorder.pause();
      else recorder.resume();
    });

    const dbg = (m: string) => { if ((window as unknown as { __EXPORT_DEBUG?: boolean }).__EXPORT_DEBUG) console.log("[export] " + m); };
    for (let segmentIndex = 0; segmentIndex < normalizedSegments.length; segmentIndex++) {
      const seg = normalizedSegments[segmentIndex]!;
      if (options.signal?.aborted) throw new DOMException("ยกเลิกการเรนเดอร์", "AbortError");
      dbg(`seg ${segmentIndex + 1}/${normalizedSegments.length} ${seg.start.toFixed(2)}-${seg.end.toFixed(2)} rec=${recorder.state}`);
      if (segmentIndex > 0) await seek(video, seg.start);
      dbg(`seeked ${video.currentTime.toFixed(2)}`);
      if (options.smoothCuts !== false) {
        const now = audioContext.currentTime;
        boundaryGain.gain.cancelScheduledValues(now);
        boundaryGain.gain.setValueAtTime(0.0001, now);
        lastBoundaryTarget = 0.0001;
        lastBoundaryUpdate = seg.start;
      }
      // วาดเฟรมแรกของช่วงใหม่ก่อนเปิดบันทึกอีกครั้ง ไม่งั้น recorder จะเก็บ
      // เฟรมสุดท้ายของช่วงก่อนหน้าค้างไว้ ~0.1s ทุกรอยตัด (อาการภาพกระตุก)
      paint(video.currentTime, seg);
      commitFrame(true);
      try {
        await video.play();
      } catch {
        throw new Error("เบราว์เซอร์บล็อกการเล่นวิดีโอ กรุณากดปุ่มอีกครั้ง");
      }
      if (segmentIndex === 0) recorder.start(1000);
      else {
        // รอให้ decoder ส่งเฟรมจริงก่อน แล้วค่อย resume — ช่วงหน่วงหลัง play()
        // จะไม่ถูกบันทึกเป็นเฟรมค้าง
        await new Promise<void>((resolve) => {
          let settled = false;
          const finishWait = () => { if (!settled) { settled = true; resolve(); } };
          const timer = window.setTimeout(finishWait, 400);
          const onFrame = () => { window.clearTimeout(timer); paint(video.currentTime, seg); commitFrame(true); finishWait(); };
          if (typeof frameVideo.requestVideoFrameCallback === "function") frameVideo.requestVideoFrameCallback(onFrame);
          else requestAnimationFrame(onFrame);
        });
        await transitionRecorder("recording");
      }

      await new Promise<void>((resolve, reject) => {
        let lastMediaTime = video.currentTime;
        let lastProgressWall = performance.now();
        let finished = false;
        let frameRequest = 0;
        let healthTimer = 0;
        let abortHandler: (() => void) | null = null;
        const cleanup = () => {
          window.clearInterval(healthTimer);
          if (frameRequest) {
            if (typeof frameVideo.cancelVideoFrameCallback === "function") frameVideo.cancelVideoFrameCallback(frameRequest);
            else cancelAnimationFrame(frameRequest);
          }
          if (abortHandler) options.signal?.removeEventListener("abort", abortHandler);
        };
        const fail = (error: Error | DOMException) => {
          if (finished) return;
          finished = true;
          cleanup();
          video.pause();
          reject(error);
        };
        const finish = async (reason: ExportSegmentDiagnostic["reason"]) => {
          if (finished) return;
          const played = Math.max(0, Math.min(seg.end, video.currentTime) - seg.start);
          const expected = seg.end - seg.start;
          if (reason !== "source-ended" && played + Math.max(0.08, 2 / fps) < expected) {
            fail(new Error(`ช่วงที่ ${segmentIndex + 1} เล่นไม่ครบ: ${played.toFixed(3)}s จาก ${expected.toFixed(3)}s`));
            return;
          }
          finished = true;
          cleanup();
          if (options.smoothCuts !== false && audioContext) {
            boundaryGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.008);
          }
          video.pause();
          try {
            await transitionRecorder("paused");
            segmentDiagnostics.push({ index: segmentIndex, start: seg.start, end: seg.end, played, reason });
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        const requestNextFrame = (callback: () => void) => {
          frameRequest = typeof frameVideo.requestVideoFrameCallback === "function"
            ? frameVideo.requestVideoFrameCallback(callback)
            : requestAnimationFrame(callback);
        };
        // การตรวจสอบหนึ่งรอบ: วาดเฟรม, เฟดเสียง, และเช็คว่าจบช่วงหรือยัง
        // เรียกได้ทั้งจาก requestVideoFrameCallback และจากตัวจับเวลาสำรอง
        // (rVFC หยุดยิงเมื่อ decoder ไม่ส่งเฟรมใหม่ เช่นวิดีโอถูก pause เอง
        //  ซึ่งเคยทำให้ export ค้างที่ช่วงสุดท้ายแบบไม่มีวันจบ)
        const step = (scheduleNext: boolean) => {
          if (finished) return;
          const time = video.currentTime;
          if (time > lastMediaTime + 0.001) {
            lastMediaTime = time;
            lastProgressWall = performance.now();
          }
          const frameStart = performance.now();
          paint(time, seg);
          applyBoundaryGain(time, seg);
          const cost = performance.now() - frameStart;
          commitFrame();
          adapt(cost);
          frameCostTotal += cost;
          if (cost > frameCostMax) { frameCostMax = cost; frameCostMaxAt = time; }
          if (cost > frameBudget) frameCostOverBudget++;
          frameCosts.push(cost);
          painted++;

          if (options.signal?.aborted) { fail(new DOMException("ยกเลิกการเรนเดอร์", "AbortError")); return; }
          if (time >= seg.end) { void finish("reached-end"); return; }
          if (video.ended) { void finish("source-ended"); return; }
          onProgress?.(Math.min(1, (elapsed + (time - seg.start)) / total));
          if (scheduleNext) requestNextFrame(tick);
        };
        const tick = () => step(true);
        abortHandler = () => fail(new DOMException("ยกเลิกการเรนเดอร์", "AbortError"));
        options.signal?.addEventListener("abort", abortHandler, { once: true });
        let resumeAttempts = 0;
        healthTimer = window.setInterval(() => {
          if (finished) return;
          // เดินลูปต่อแม้ rVFC เงียบ เพื่อไม่ให้ค้างที่ 100%
          step(false);
          if (finished) return;
          const now = performance.now();
          if (video.currentTime > lastMediaTime + 0.001) {
            lastMediaTime = video.currentTime;
            lastProgressWall = now;
            return;
          }
          if (now - lastProgressWall < 3000) return;
          if (video.paused && !video.ended && resumeAttempts < 3) {
            resumeAttempts++;
            lastProgressWall = now;
            void video.play().catch(() => undefined);
            return;
          }
          if (now - lastProgressWall > 8000) {
            fail(new Error(`ตัวถอดรหัสวิดีโอค้างเกิน 8 วินาทีที่ช่วง ${segmentIndex + 1} (${video.currentTime.toFixed(2)}s)`));
          }
        }, 250);
        requestNextFrame(tick);

      });

      elapsed += seg.end - seg.start;
      // Emit bounded chunks only while the recorder is active. This keeps long
      // exports memory-safe without the pause/resume deadlock seen in Chromium.
      dbg(`seg ${segmentIndex + 1} done rec=${recorder.state} t=${video.currentTime.toFixed(2)}`);
      if (recorder.state === "recording") recorder.requestData();
      onProgress?.(Math.min(1, elapsed / total));
    }

    // Let the encoder flush the tail before closing the file. Do not wait for
    // rAF here: a hidden/background tab may throttle rAF indefinitely after
    // the source video pauses, leaving export stuck at 100%.
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    // Stopping from the paused state excludes all seek/decode delays from the
    // recording timeline and is supported by MediaRecorder.
    dbg(`stopping rec=${recorder.state} chunks=${chunks.length}`);
    recorder.stop();
    await Promise.race([
      done,
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("MediaRecorder ไม่ปิดไฟล์ภายใน 8 วินาที")), 8000)),
    ]);
    dbg(`stopped chunks=${chunks.length}`);
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size < 1024) throw new Error("ไฟล์วิดีโอที่ส่งออกไม่มีข้อมูล กรุณาลองใช้ Chrome หรือ Edge");
    const sortedCosts = [...frameCosts].sort((a, b) => a - b);
    const frameStats = {
      avgMs: frameCosts.length ? frameCostTotal / frameCosts.length : 0,
      p95Ms: sortedCosts.length ? sortedCosts[Math.min(sortedCosts.length - 1, Math.floor(sortedCosts.length * 0.95))]! : 0,
      maxMs: frameCostMax,
      maxAtSec: frameCostMaxAt,
      overBudget: frameCostOverBudget,
      budgetMs: frameBudget,
    };
    dbg(`frame cost avg=${frameStats.avgMs.toFixed(2)}ms p95=${frameStats.p95Ms.toFixed(2)}ms max=${frameStats.maxMs.toFixed(2)}ms@${frameStats.maxAtSec.toFixed(2)}s over=${frameStats.overBudget}/${frameCosts.length}`);
    return { blob, ext: mimeExtension(mimeType), width, height, fps, plannedFps, fpsAdapted, frames: captured, painted, chunks: chunkTimes.length, expectedDuration: total, segments: segmentDiagnostics, frameStats };


  } finally {
    video.pause();
    video.remove();
    if (recorder && recorder.state !== "inactive") recorder.stop();
    outputStream?.getTracks().forEach((track) => track.stop());
    gate?.dispose();
    if (audioContext) void audioContext.close();
  }
}
