import type { Segment } from "./audio";
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
export async function exportBurnedVideo(
  url: string,
  segments: Segment[],
  groups: CaptionGroup[],
  style: CaptionStyle,
  onProgress?: Progress,
  options: { noiseReduction?: boolean; smoothCuts?: boolean; captions?: boolean; signal?: AbortSignal } = {},
): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
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

  let audioContext: AudioContext | null = null;

  try {
    await waitFor("loadedmetadata");
    if (video.readyState < 2) await waitFor("loadeddata");
    try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }

    const width = video.videoWidth || 1080;
    const height = video.videoHeight || 1920;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("เบราว์เซอร์นี้ไม่รองรับการเรนเดอร์วิดีโอ");

    const stream = canvas.captureStream(30);

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
    source.connect(highpass).connect(lowpass).connect(compressor).connect(boundaryGain).connect(destination);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

    const mimeType = pickMime();
    const chunks: BlobPart[] = [];
    const bitrate = Math.min(16_000_000, Math.max(4_000_000, Math.round(width * height * 0.14)));
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: bitrate,
      audioBitsPerSecond: 128_000,
    });
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });


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

    const total = segments.reduce((n, s) => n + (s.end - s.start), 0);
    let elapsed = 0;

    // A frame source that follows the decoder when available (steadier than rAF,
    // which fires on display vsync and drops frames while seeking).
    type FrameVideo = HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    const frameVideo = video as FrameVideo;
    const nextFrame = (cb: () => void) => {
      if (typeof frameVideo.requestVideoFrameCallback === "function") frameVideo.requestVideoFrameCallback(cb);
      else requestAnimationFrame(cb);
    };

    const FADE = 0.08; // seconds of visual cross-fade at each cut
    const paint = (time: number, seg: Segment) => {
      ctx.drawImage(video, 0, 0, width, height);
      if (options.smoothCuts !== false) {
        const into = time - seg.start;
        const left = seg.end - time;
        const edge = Math.min(into, left);
        if (edge < FADE) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, 1 - edge / FADE)) * 0.85;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, width, height);
          ctx.restore();
        }
      }
      drawCaption(time);
    };

    if (audioContext.state === "suspended") await audioContext.resume();

    // Prime the first frame so the recording never starts on a blank canvas.
    await seek(video, segments[0]!.start);
    ctx.drawImage(video, 0, 0, width, height);
    drawCaption(segments[0]!.start);

    // Timeslice keeps chunks flowing, so a long render can't be lost in one
    // oversized buffer and the file stays playable.
    recorder.start(500);
    await new Promise((r) => setTimeout(r, 120));

    for (const seg of segments) {
      await seek(video, seg.start);
      if (options.smoothCuts !== false) {
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
          paint(time, seg);
          if (time >= seg.end || video.ended) {
            video.pause();
            resolve();
            return;
          }
          // Guard against a decoder stall so the export can never hang forever.
          if (Math.abs(time - last) < 0.0005) {
            stalled += 1;
            if (stalled > 240) { video.pause(); resolve(); return; }
          } else {
            stalled = 0;
          }
          last = time;
          onProgress?.(Math.min(1, (elapsed + (time - seg.start)) / total));
          nextFrame(tick);
        };
        nextFrame(tick);
      });
      elapsed += seg.end - seg.start;
      onProgress?.(Math.min(1, elapsed / total));
    }

    // Let the encoder flush the tail before closing the file.
    await new Promise((r) => setTimeout(r, 250));
    recorder.requestData();
    recorder.stop();
    await done;
    const blob = new Blob(chunks, { type: mimeType });
    if (blob.size < 1024) throw new Error("ไฟล์วิดีโอที่ส่งออกไม่มีข้อมูล กรุณาลองใช้ Chrome หรือ Edge");
    return { blob, ext: mimeExtension(mimeType) };

  } finally {
    video.pause();
    video.remove();
    if (audioContext) void audioContext.close();
  }
}
