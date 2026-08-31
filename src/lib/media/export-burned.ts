import type { Segment } from "./audio";
import { motionAt, type MotionElement, type MotionScene } from "./motion";
import { createNoiseGate, type NoiseGateNode } from "./noise-gate";
import { viralTextAt } from "../scenes";
import {
  LINE_BREAK,
  isKeyword,
  shadowBlur,
  strokeWidth,
  type CaptionGroup,
  type CaptionStyle,
  type LineStyle,
} from "../captions";

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

type Line = { words: { text: string; active: boolean; keyword: boolean }[] };

function layoutGroup(group: CaptionGroup, time: number, style: CaptionStyle): Line[] {
  const lines: Line[] = [{ words: [] }];
  const perLine = Math.max(0, Math.round(style.wordsPerLine ?? 0));
  for (const word of group.words) {
    if (word.text === LINE_BREAK) {
      lines.push({ words: [] });
      continue;
    }
    const current = lines[lines.length - 1]!;
    if (perLine > 0 && current.words.length >= perLine) lines.push({ words: [] });
    const target = lines[lines.length - 1]!;
    const text = style.uppercase ? word.text.toUpperCase() : word.text;
    target.words.push({
      text,
      active: time >= word.start - 0.01 && time <= word.end + 0.01,
      keyword: isKeyword(word.text),
    });
  }
  return lines.filter((line) => line.words.length);
}

function lineStyleAt(style: CaptionStyle, index: number): LineStyle {
  return style.lineStyles?.[index] ?? {};
}

/**
 * Render a finished, ready-to-post video: silences removed and captions burned
 * into the frames, so the user can publish it without CapCut.
 */
export type ExportResolution = "source" | "4k" | "1080" | "720";

export type ExportSegmentDiagnostic = {
  index: number;
  start: number;
  end: number;
  played: number;
  reason: "reached-end" | "source-ended";
};

/** ความสูงของด้านสั้น (แนวตั้ง 9:16 → 1080 = 1080x1920) */
const SHORT_SIDE: Record<Exclude<ExportResolution, "source">, number> = {
  "4k": 2160,
  "1080": 1080,
  "720": 720,
};

/** คำนวณขนาด canvas เป้าหมายโดยรักษาสัดส่วนภาพเดิม (ปัดเป็นเลขคู่) */
export function targetSize(
  sourceWidth: number,
  sourceHeight: number,
  resolution: ExportResolution = "source",
): { width: number; height: number; upscaled: boolean } {
  if (resolution === "source" || !sourceWidth || !sourceHeight) {
    return { width: sourceWidth, height: sourceHeight, upscaled: false };
  }
  const short = Math.min(sourceWidth, sourceHeight);
  const scale = SHORT_SIDE[resolution] / short;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return {
    width: even(sourceWidth * scale),
    height: even(sourceHeight * scale),
    upscaled: scale > 1,
  };
}

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
): Promise<{ blob: Blob; ext: "mp4" | "webm"; width: number; height: number; fps: number; frames: number; chunks: number; expectedDuration: number; segments: ExportSegmentDiagnostic[] }> {

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

  try {
    await waitFor("loadedmetadata");
    if (video.readyState < 2) await waitFor("loadeddata");
    try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }

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

    // 4K canvas วาดช้ากว่ามาก จับที่ 24fps เพื่อไม่ให้เฟรมตกจนภาพกระตุก
    const fps = width * height >= 3840 * 2160 * 0.8 ? 24 : 30;
    const stream = canvas.captureStream(fps);
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
    const bitrate = Math.min(48_000_000, Math.max(4_000_000, Math.round(width * height * 0.14)));
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


    const drawCaption = (time: number) => {
      if (options.captions === false || !groups.length) return;
      const group = groups.find((g) => time >= g.start - 0.02 && time <= g.end + 0.12);
      if (!group) return;
      const lines = layoutGroup(group, time, style);
      if (!lines.length) return;

      const fontSize = (style.size / 100) * height;
      const baseGap = (style.lineGap ?? 0.08) * fontSize;
      const lineHeight = fontSize * 1.18;
      ctx.textBaseline = "middle";

      const metrics = lines.map((line, i) => {
        const ls = lineStyleAt(style, i);
        const weight = ls.fontWeight ?? style.fontWeight;
        const family = ls.fontFamily ?? style.fontFamily;
        ctx.font = `${weight} ${fontSize}px ${family}`;
        const space = ctx.measureText(" ").width;
        const widths = line.words.map((w) => ctx.measureText(w.text).width);
        const total = widths.reduce((n, w) => n + w, 0) + space * Math.max(0, line.words.length - 1);
        return { widths, space, total, weight, family, ls, gap: (ls.gap ?? 0) * fontSize };
      });

      const blockHeight = metrics.reduce((n, m, i) => n + lineHeight + (i ? baseGap + m.gap : 0), 0);
      const centerX = (style.posX / 100) * width;
      let y = (style.posY / 100) * height - blockHeight / 2 + lineHeight / 2;

      lines.forEach((line, i) => {
        const m = metrics[i]!;
        if (i) y += baseGap + m.gap;
        const left =
          style.textAlign === "left"
            ? centerX - (width * 0.72) / 2
            : style.textAlign === "right"
              ? centerX + (width * 0.72) / 2 - m.total
              : centerX - m.total / 2;

        if (style.plate) {
          ctx.fillStyle = style.plateColor;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(left - fontSize * 0.28, y - lineHeight * 0.6, m.total + fontSize * 0.56, lineHeight * 1.2);
          ctx.globalAlpha = 1;
        }

        let x = left;
        ctx.font = `${m.weight} ${fontSize}px ${m.family}`;
        line.words.forEach((word, wi) => {
          const w = m.widths[wi]!;
          const highlighted = word.active;
          if (highlighted && style.highlight === "box") {
            ctx.fillStyle = style.highlightColor;
            ctx.globalAlpha = 1;
            const r = fontSize * 0.16;
            const bx = x - fontSize * 0.12;
            const by = y - lineHeight * 0.56;
            const bw = w + fontSize * 0.24;
            const bh = lineHeight * 1.12;
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, r);
            ctx.fill();
          }


          const strokePx = strokeWidth[m.ls.stroke ?? style.stroke] * (fontSize / 64);
          if (strokePx > 0) {
            ctx.lineJoin = "round";
            ctx.miterLimit = 2;
            ctx.lineWidth = strokePx * 2;
            ctx.strokeStyle = m.ls.strokeColor ?? style.strokeColor;
            ctx.strokeText(word.text, x, y);
          }

          const blur = shadowBlur[style.shadow] * (fontSize / 64);
          ctx.shadowBlur = blur;
          ctx.shadowColor = blur ? style.shadowColor : "transparent";
          ctx.shadowOffsetY = blur ? blur * 0.25 : 0;

          ctx.fillStyle = highlighted
            ? style.highlight === "box"
              ? style.highlightTextColor
              : style.highlight === "color"
                ? style.highlightColor
                : (m.ls.color ?? style.color)
            : (m.ls.color ?? style.color);
          ctx.fillText(word.text, x, y);
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.shadowColor = "transparent";
          x += w + m.space;
        });

        y += lineHeight;
      });
    };

    const drawViralText = (time: number) => {
      const hit = viralTextAt(time, options.scenes, options.sceneElements);
      if (!hit) return;
      const span = hit.span;
      const fade = Math.min(0.3, span / 3);
      const inRatio = Math.min(1, (hit.progress * span) / fade);
      const outRatio = Math.min(1, ((1 - hit.progress) * span) / fade);
      const alpha = Math.max(0, Math.min(inRatio, outRatio));
      if (alpha <= 0) return;
      const pop = inRatio < 1 ? 0.7 + 0.3 * (1 - Math.pow(1 - inRatio, 3)) : 1;

      const fontSize = height * 0.075;
      const text = hit.text.toUpperCase();
      const y = hit.position === "middle" ? height * 0.47 : height * 0.13;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.font = `900 ${fontSize}px ${style.fontFamily}`;
      ctx.translate(width / 2, y);
      ctx.scale(pop, pop);
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.lineWidth = Math.max(4, fontSize * 0.14);
      ctx.strokeStyle = "#000000";
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, 0, 0);
      ctx.restore();
      ctx.textAlign = "left";
    };

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

    const FADE = 0.08; // seconds of visual cross-fade at each cut
    const paint = (time: number, seg: Segment) => {
      // Motion (Ken Burns) applies to the image only — captions stay still.
      const motion = motionAt(time, options.scenes, options.sceneElements);
      if (motion.scale !== 1 || motion.translateX || motion.translateY) {
        ctx.save();
        ctx.translate(width / 2 + motion.translateX * width, height / 2 + motion.translateY * height);
        ctx.scale(motion.scale, motion.scale);
        ctx.drawImage(video, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, width, height);
      }
      if (options.smoothCuts !== false) {
        // Short segments get a proportionally shorter fade so a 0.2s clip is
        // not almost entirely black.
        const fade = Math.max(0.02, Math.min(FADE, (seg.end - seg.start) / 5));
        const into = time - seg.start;
        const left = seg.end - time;
        const edge = Math.min(into, left);
        if (edge < fade) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, 1 - edge / fade)) * 0.85;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
      }
      drawCaption(time);
      drawViralText(time);
    };

    if (audioContext.state === "suspended") await audioContext.resume();

    // Prime the first frame so the recording never starts on a blank canvas.
    await seek(video, normalizedSegments[0]!.start);
    ctx.drawImage(video, 0, 0, width, height);
    drawCaption(normalizedSegments[0]!.start);

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

    for (let segmentIndex = 0; segmentIndex < normalizedSegments.length; segmentIndex++) {
      const seg = normalizedSegments[segmentIndex]!;
      if (options.signal?.aborted) throw new DOMException("ยกเลิกการเรนเดอร์", "AbortError");
      if (segmentIndex > 0) await seek(video, seg.start);
      if (options.smoothCuts !== false) {
        const now = audioContext.currentTime;
        boundaryGain.gain.cancelScheduledValues(now);
        boundaryGain.gain.setValueAtTime(0.0001, now);
        lastBoundaryTarget = 0.0001;
        lastBoundaryUpdate = seg.start;
      }
      if (segmentIndex === 0) recorder.start(1000);
      else await transitionRecorder("recording");
      try {
        await video.play();
      } catch {
        throw new Error("เบราว์เซอร์บล็อกการเล่นวิดีโอ กรุณากดปุ่มอีกครั้ง");
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
        const tick = () => {
          if (finished) return;
          const time = video.currentTime;
          if (time > lastMediaTime + 0.001) {
            lastMediaTime = time;
            lastProgressWall = performance.now();
          }
          paint(time, seg);
          applyBoundaryGain(time, seg);
          painted++;

          if (options.signal?.aborted) { fail(new DOMException("ยกเลิกการเรนเดอร์", "AbortError")); return; }
          if (time >= seg.end) { void finish("reached-end"); return; }
          if (video.ended) { void finish("source-ended"); return; }
          onProgress?.(Math.min(1, (elapsed + (time - seg.start)) / total));
          requestNextFrame(tick);
        };
        abortHandler = () => fail(new DOMException("ยกเลิกการเรนเดอร์", "AbortError"));
        options.signal?.addEventListener("abort", abortHandler, { once: true });
        healthTimer = window.setInterval(() => {
          if (finished) return;
          const now = performance.now();
          if (video.currentTime > lastMediaTime + 0.001) {
            lastMediaTime = video.currentTime;
            lastProgressWall = now;
          } else if (!video.paused && now - lastProgressWall > 8000) {
            fail(new Error(`ตัวถอดรหัสวิดีโอค้างเกิน 8 วินาทีที่ช่วง ${segmentIndex + 1} (${video.currentTime.toFixed(2)}s)`));
          }
        }, 500);
        requestNextFrame(tick);
      });

      elapsed += seg.end - seg.start;
      // Emit bounded chunks only while the recorder is active. This keeps long
      // exports memory-safe without the pause/resume deadlock seen in Chromium.
      if (recorder.state === "recording") recorder.requestData();
      onProgress?.(Math.min(1, elapsed / total));
    }

    // Let the encoder flush the tail before closing the file. Do not wait for
    // rAF here: a hidden/background tab may throttle rAF indefinitely after
    // the source video pauses, leaving export stuck at 100%.
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    // Stopping from the paused state excludes all seek/decode delays from the
    // recording timeline and is supported by MediaRecorder.
    recorder.stop();
    await Promise.race([
      done,
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("MediaRecorder ไม่ปิดไฟล์ภายใน 8 วินาที")), 8000)),
    ]);
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size < 1024) throw new Error("ไฟล์วิดีโอที่ส่งออกไม่มีข้อมูล กรุณาลองใช้ Chrome หรือ Edge");
    return { blob, ext: mimeExtension(mimeType), width, height, fps, frames: painted, chunks: chunkTimes.length, expectedDuration: total, segments: segmentDiagnostics };


  } finally {
    video.pause();
    video.remove();
    if (recorder && recorder.state !== "inactive") recorder.stop();
    outputStream?.getTracks().forEach((track) => track.stop());
    gate?.dispose();
    if (audioContext) void audioContext.close();
  }
}
