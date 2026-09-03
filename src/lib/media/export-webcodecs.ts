/**
 * Export แบบ WebCodecs (เส้นทางหลัก)
 *
 * ต่างจากเส้นทางเดิม (canvas.captureStream + MediaRecorder) ตรงที่ "ไม่แข่งกับเวลาจริง":
 * เรา seek วิดีโอไปทีละเฟรมตามช่วงเวลาคงที่ (1/fps) รอ event `seeked` จริง วาดลง canvas
 * แล้วเข้ารหัสเฟรมนั้นทันทีด้วย VideoEncoder เครื่องช้าก็แค่ export นานขึ้น
 * แต่ไฟล์ที่ได้มีเฟรมครบทุกช่วงเวลา ไม่มีเฟรมหลุด
 *
 * เสียงประมวลผลล่วงหน้าด้วย OfflineAudioContext (เร็วกว่าเวลาจริงมาก) แล้วเข้ารหัสด้วย
 * AudioEncoder จากนั้นรวม video+audio เป็นไฟล์ .mp4 เดียวด้วย mp4-muxer
 */
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import type { Segment } from "./audio";
import type { MotionElement, MotionScene } from "./motion";
import { createNoiseGate } from "./noise-gate";
import { createBurnRenderer, targetSize, type ExportResolution } from "./burn-render";
import type { CaptionGroup, CaptionStyle } from "../captions";
import { sceneSoundCues } from "../scenes";
import { scheduleSfx } from "./sfx";

type Progress = (ratio: number) => void;

export function supportsWebCodecsExport(): boolean {
  return (
    typeof window !== "undefined" &&
    "VideoEncoder" in window &&
    "VideoFrame" in window &&
    "AudioEncoder" in window &&
    "AudioData" in window
  );
}

export type WebCodecsExportResult = {
  blob: Blob;
  ext: "mp4";
  width: number;
  height: number;
  fps: number;
  frames: number;
  expectedDuration: number;
  audioCodec: "aac" | "opus" | "none";
  videoCodec: string;
  renderMs: number;
};

const dbg = (m: string) => {
  if ((window as unknown as { __EXPORT_DEBUG?: boolean }).__EXPORT_DEBUG) console.log("[webcodecs] " + m);
};

async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => { cleanup(); reject(new Error("เลื่อนไปยังช่วงวิดีโอไม่สำเร็จ")); }, 10000);
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

/** เลือก codec วิดีโอที่เครื่องนี้เข้ารหัสได้จริงที่ความละเอียดนี้ */
async function pickVideoCodec(width: number, height: number, bitrate: number, fps: number) {
  const candidates = [
    "avc1.640034", // High 5.2 (รองรับ 4K)
    "avc1.4d0034",
    "avc1.640028",
    "avc1.42E01E",
  ];
  for (const codec of candidates) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
      avc: { format: "avc" },
    };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return { codec, config, muxCodec: "avc" as const };
    } catch { /* ลองตัวถัดไป */ }
  }
  const vp9: VideoEncoderConfig = { codec: "vp09.00.51.08", width, height, bitrate, framerate: fps };
  const support = await VideoEncoder.isConfigSupported(vp9).catch(() => ({ supported: false }));
  if (support.supported) return { codec: vp9.codec, config: vp9, muxCodec: "vp9" as const };
  throw new Error("เบราว์เซอร์นี้เข้ารหัสวิดีโอที่ความละเอียดนี้ไม่ได้ ลองลดความละเอียดลง");
}

async function pickAudioCodec(sampleRate: number, channels: number) {
  const options: Array<{ codec: string; mux: "aac" | "opus" }> = [
    { codec: "mp4a.40.2", mux: "aac" },
    { codec: "opus", mux: "opus" },
  ];
  for (const option of options) {
    const config: AudioEncoderConfig = {
      codec: option.codec,
      sampleRate,
      numberOfChannels: channels,
      bitrate: 128_000,
    };
    try {
      const support = await AudioEncoder.isConfigSupported(config);
      if (support.supported) return { config, mux: option.mux };
    } catch { /* ลองตัวถัดไป */ }
  }
  return null;
}

/**
 * ประมวลผลเสียงล่วงหน้า: ตัดเฉพาะช่วงที่เก็บไว้มาต่อกัน + noise reduction เดิม
 * คืนค่าเป็น AudioBuffer ของ timeline ผลลัพธ์ (เวลาต่อเนื่องหลังตัดช่วงเงียบแล้ว)
 */
export async function renderAudio(
  url: string,
  segments: Segment[],
  total: number,
  options: {
    noiseReduction?: boolean;
    noiseFloor?: number;
    smoothCuts?: boolean;
    scenes?: MotionScene[];
    sceneElements?: MotionElement[];
  },
): Promise<AudioBuffer | null> {
  let decoded: AudioBuffer;
  try {
    const response = await fetch(url);
    const bytes = await response.arrayBuffer();
    const decodeContext = new AudioContext();
    try {
      decoded = await decodeContext.decodeAudioData(bytes);
    } finally {
      void decodeContext.close();
    }
  } catch {
    return null; // คลิปไม่มีแทร็กเสียง หรืออ่านไม่ได้ → ส่งออกเฉพาะภาพ
  }
  if (!decoded.length) return null;

  const sampleRate = decoded.sampleRate;
  const channels = Math.min(2, Math.max(1, decoded.numberOfChannels));
  const offline = new OfflineAudioContext(channels, Math.max(1, Math.ceil(total * sampleRate)), sampleRate);

  const highpass = offline.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = options.noiseReduction ? 95 : 20;
  const lowpass = offline.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = options.noiseReduction ? 10500 : 20000;
  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = options.noiseReduction ? -38 : -24;
  compressor.ratio.value = options.noiseReduction ? 5 : 2;

  const gate = options.noiseReduction && options.noiseFloor
    ? await createNoiseGate(offline, { noiseFloor: options.noiseFloor })
    : null;

  highpass.connect(lowpass).connect(compressor);
  if (gate) compressor.connect(gate.input), gate.output.connect(offline.destination);
  else compressor.connect(offline.destination);

  let cursor = 0;
  for (const segment of segments) {
    const length = Math.max(0, segment.end - segment.start);
    if (length <= 0) continue;
    const source = offline.createBufferSource();
    source.buffer = decoded;
    const gain = offline.createGain();
    source.connect(gain).connect(highpass);
    if (options.smoothCuts !== false) {
      // เฟดสั้น ๆ ตรงรอยตัด กันเสียงป็อป (ตรงกับพฤติกรรมเดิม)
      const fade = Math.min(0.02, length / 4);
      gain.gain.setValueAtTime(0.0001, cursor);
      gain.gain.linearRampToValueAtTime(1, cursor + fade);
      gain.gain.setValueAtTime(1, cursor + length - fade);
      gain.gain.linearRampToValueAtTime(0.0001, cursor + length);
    }
    source.start(cursor, segment.start, length);
    cursor += length;
  }

  // ---- เสียงเอฟเฟกต์ของซีน ----
  // ต่อตรงเข้า destination ไม่ผ่าน noise gate/compressor ของเสียงพูด เพื่อไม่ให้ถูกดักหรือดัก
  // เสียงพูดตามไปด้วย ส่วนจุดที่ตกในช่วงเงียบที่ถูกตัดทิ้ง เราจะ "เลื่อนไปจุดที่ใกล้ที่สุด
  // ในช่วงที่เก็บไว้" แทนการทิ้ง เพราะผู้ใช้ตั้งใจวางเสียงไว้ตรงรอยต่อนั้นอยู่แล้ว
  const cues = sceneSoundCues(options.scenes, options.sceneElements);
  if (cues.length) {
    const mapToOutput = (time: number): number | null => {
      let acc = 0;
      let lastEnd: number | null = null;
      for (const segment of segments) {
        const length = Math.max(0, segment.end - segment.start);
        if (time < segment.start) return acc; // อยู่ในช่วงเงียบก่อนหน้า → ต้นช่วงที่เก็บไว้ถัดไป
        if (time <= segment.end) return acc + (time - segment.start);
        acc += length;
        lastEnd = acc;
      }
      return lastEnd; // เลยช่วงสุดท้าย → ท้ายไฟล์
    };
    for (const cue of cues) {
      const at = mapToOutput(cue.time);
      if (at === null || at >= total) continue;
      scheduleSfx(offline, cue.soundId, at, offline.destination, cue.volume);
    }
  }

  const rendered = await offline.startRendering();
  gate?.dispose();
  return rendered;
}

export async function exportWebCodecsVideo(
  url: string,
  segments: Segment[],
  groups: CaptionGroup[],
  style: CaptionStyle,
  onProgress?: Progress,
  options: {
    noiseReduction?: boolean;
    noiseFloor?: number;
    smoothCuts?: boolean;
    captions?: boolean;
    signal?: AbortSignal;
    scenes?: MotionScene[];
    sceneElements?: MotionElement[];
    resolution?: ExportResolution;
  } = {},
): Promise<WebCodecsExportResult> {
  if (!segments.length) throw new Error("ยังไม่ได้วิเคราะห์ช่วงเงียบ");
  if (!supportsWebCodecsExport()) throw new Error("เบราว์เซอร์นี้ไม่รองรับ WebCodecs");

  const started = performance.now();
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

  let encoder: VideoEncoder | null = null;
  let audioEncoder: AudioEncoder | null = null;

  try {
    await waitFor("loadedmetadata");
    if (video.readyState < 2) await waitFor("loadeddata");
    try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }

    const sourceWidth = video.videoWidth || 1080;
    const sourceHeight = video.videoHeight || 1920;
    const target = targetSize(sourceWidth, sourceHeight, options.resolution ?? "source");
    const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
    const width = even(target.width);
    const height = even(target.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("เบราว์เซอร์นี้ไม่รองรับการเรนเดอร์วิดีโอ");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const renderer = createBurnRenderer(ctx, width, height, groups, style, {
      captions: options.captions,
      smoothCuts: options.smoothCuts,
      scenes: options.scenes,
      sceneElements: options.sceneElements,
    });

    // ไม่ต้องลด fps ตามความสามารถเครื่องอีกแล้ว เพราะไม่ได้อัดตามเวลาจริง
    const fps = 30;
    const frameDurationUs = 1e6 / fps;
    const bitrateOverride = (window as unknown as { __EXPORT_BITRATE?: number }).__EXPORT_BITRATE;
    const bitrate = bitrateOverride ?? Math.min(64_000_000, Math.max(8_000_000, Math.round(width * height * fps * 0.2)));

    const normalized = segments.map((segment, index) => {
      const start = Math.max(0, Math.min(video.duration, segment.start));
      const end = Math.max(0, Math.min(video.duration, segment.end));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.02) {
        throw new Error(`ช่วงวิดีโอที่ ${index + 1} ไม่ถูกต้อง (${segment.start}–${segment.end})`);
      }
      return { start, end };
    });
    const total = normalized.reduce((n, s) => n + (s.end - s.start), 0);

    const { config: videoConfig, muxCodec } = await pickVideoCodec(width, height, bitrate, fps);

    // ---- เสียง (ทำล่วงหน้าแบบ offline) ----
    const audioBuffer = await renderAudio(url, normalized, total, options);
    const audioPick = audioBuffer
      ? await pickAudioCodec(audioBuffer.sampleRate, Math.min(2, audioBuffer.numberOfChannels))
      : null;

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: muxCodec, width, height, frameRate: fps },
      ...(audioBuffer && audioPick
        ? {
            audio: {
              codec: audioPick.mux,
              numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
              sampleRate: audioBuffer.sampleRate,
            },
          }
        : {}),
      fastStart: "in-memory" as const,
    });

    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (error) => { throw new Error(`เข้ารหัสวิดีโอไม่สำเร็จ: ${error.message}`); },
    });
    encoder.configure(videoConfig);

    // ---- วนเฟรมทีละเฟรมตามเวลาที่ต้องการ ----
    let frameIndex = 0;
    let outputTime = 0; // วินาทีสะสมของ timeline ผลลัพธ์
    for (let s = 0; s < normalized.length; s++) {
      const seg = normalized[s]!;
      const length = seg.end - seg.start;
      const count = Math.max(1, Math.round(length * fps));
      for (let k = 0; k < count; k++) {
        if (options.signal?.aborted) throw new DOMException("ยกเลิกการเรนเดอร์", "AbortError");
        const sourceTime = Math.min(seg.end - 0.001, seg.start + k / fps);
        await seekTo(video, sourceTime);
        renderer.paint(video, sourceTime, seg);
        const timestamp = Math.round(frameIndex * frameDurationUs);
        const frame = new VideoFrame(canvas, { timestamp, duration: Math.round(frameDurationUs) });
        // keyframe ทุก 2 วินาที เพื่อให้ seek ในไฟล์ผลลัพธ์ลื่น
        encoder.encode(frame, { keyFrame: frameIndex % (fps * 2) === 0 });
        frame.close();
        frameIndex++;
        if (encoder.encodeQueueSize > 8) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
          while (encoder.encodeQueueSize > 8) await new Promise<void>((r) => window.setTimeout(r, 4));
        }
        if ((frameIndex & 7) === 0) onProgress?.(Math.min(0.97, (outputTime + k / fps) / total));
      }
      outputTime += length;
      dbg(`segment ${s + 1}/${normalized.length} frames=${frameIndex}`);
    }

    await encoder.flush();
    encoder.close();
    encoder = null;

    // ---- เข้ารหัสเสียงที่เรนเดอร์ไว้ ----
    if (audioBuffer && audioPick) {
      const channels = Math.min(2, audioBuffer.numberOfChannels);
      const sampleRate = audioBuffer.sampleRate;
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (error) => { throw new Error(`เข้ารหัสเสียงไม่สำเร็จ: ${error.message}`); },
      });
      audioEncoder.configure(audioPick.config);
      const data: Float32Array[] = [];
      for (let c = 0; c < channels; c++) data.push(audioBuffer.getChannelData(c));
      const block = 4096;
      for (let offset = 0; offset < audioBuffer.length; offset += block) {
        const frames = Math.min(block, audioBuffer.length - offset);
        const planar = new Float32Array(frames * channels);
        for (let c = 0; c < channels; c++) planar.set(data[c]!.subarray(offset, offset + frames), c * frames);
        const audioData = new AudioData({
          format: "f32-planar",
          sampleRate,
          numberOfFrames: frames,
          numberOfChannels: channels,
          timestamp: Math.round((offset / sampleRate) * 1e6),
          data: planar,
        });
        audioEncoder.encode(audioData);
        audioData.close();
        if (audioEncoder.encodeQueueSize > 16) {
          while (audioEncoder.encodeQueueSize > 16) await new Promise<void>((r) => window.setTimeout(r, 4));
        }
      }
      await audioEncoder.flush();
      audioEncoder.close();
      audioEncoder = null;
    }

    muxer.finalize();
    const buffer = (muxer.target as ArrayBufferTarget).buffer;
    const blob = new Blob([buffer], { type: "video/mp4" });
    if (blob.size < 1024) throw new Error("ไฟล์วิดีโอที่ส่งออกไม่มีข้อมูล");
    onProgress?.(1);

    return {
      blob,
      ext: "mp4",
      width,
      height,
      fps,
      frames: frameIndex,
      expectedDuration: total,
      audioCodec: audioBuffer && audioPick ? audioPick.mux : "none",
      videoCodec: videoConfig.codec,
      renderMs: performance.now() - started,
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.remove();
    try { if (encoder && encoder.state !== "closed") encoder.close(); } catch { /* ignore */ }
    try { if (audioEncoder && audioEncoder.state !== "closed") audioEncoder.close(); } catch { /* ignore */ }
  }
}
