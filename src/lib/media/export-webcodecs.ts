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
import { decodeAudioFromFile, type Segment } from "./audio";
import type { MotionElement, MotionScene } from "./motion";
import { createNoiseGate } from "./noise-gate";
import {
  createBurnRenderer,
  ensureCaptionFonts,
  targetSize,
  type ExportResolution,
} from "./burn-render";
import { brollWindows, createBrollTrack, type BrollTrack } from "./broll";
import { createStickerLayer, type Sticker, type StickerLayer } from "./stickers";
import { openFrameReader, probeVideo, type FrameReader } from "./frame-reader";
import { copyAudioPackets } from "./audio-passthrough";
import type { CaptionGroup, CaptionStyle } from "../captions";

type Progress = (ratio: number) => void;

export function supportsWebCodecsExport(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
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
  /** The clip's audio was copied as is (no AudioEncoder): no noise reduction or fades. */
  audioCopied: boolean;
  videoCodec: string;
  renderMs: number;
};

const dbg = (m: string) => {
  if ((window as unknown as { __EXPORT_DEBUG?: boolean }).__EXPORT_DEBUG)
    console.log("[webcodecs] " + m);
};

async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("เลื่อนไปยังช่วงวิดีโอไม่สำเร็จ"));
    }, 10000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", failed);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error("อ่านช่วงวิดีโอไม่สำเร็จ"));
    };
    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("error", failed, { once: true });
    video.currentTime = time;
  });
}

/**
 * Encodes one blank frame and waits for the result. Safari (iPhone) answers
 * "supported" to configs it then fails to encode, so a config is only trusted
 * once a frame has really come out.
 */
async function encoderWorks(config: VideoEncoderConfig): Promise<string | null> {
  let failure: string | null = null;
  let produced = false;
  const encoder = new VideoEncoder({
    output: () => {
      produced = true;
    },
    error: (error) => {
      failure = error.message || String(error);
    },
  });
  try {
    encoder.configure(config);
    const canvas = document.createElement("canvas");
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.getContext("2d")?.fillRect(0, 0, config.width, config.height);
    const frame = new VideoFrame(canvas, { timestamp: 0 });
    encoder.encode(frame, { keyFrame: true });
    frame.close();
    await Promise.race([
      encoder.flush(),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 8000)),
    ]);
  } catch (error) {
    failure ??= error instanceof Error ? error.message : String(error);
  } finally {
    try {
      if (encoder.state !== "closed") encoder.close();
    } catch {
      /* ignore */
    }
  }
  return produced && !failure ? null : (failure ?? "no output");
}

/** เลือก codec วิดีโอที่เครื่องนี้เข้ารหัสได้จริงที่ความละเอียดนี้ */
async function pickVideoCodec(width: number, height: number, bitrate: number, fps: number) {
  // Lowest H.264 level that fits first: phones often reject levels above
  // what the frame size needs (High 4.0 covers 1080p30, 4.2 covers 1080p60).
  const large = width * height > 1920 * 1088;
  const candidates = large
    ? ["avc1.640033", "avc1.640034", "avc1.4d0033"]
    : fps > 30
      ? ["avc1.64002a", "avc1.4d002a", "avc1.640033"]
      : ["avc1.640028", "avc1.4d0028", "avc1.64002a", "avc1.640033"];
  // Level 4.x tops out around 20-25 Mbps.
  const avcBitrate = large ? bitrate : Math.min(bitrate, 20_000_000);
  const failures: string[] = [];
  for (const codec of candidates) {
    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate: avcBitrate,
      framerate: fps,
      avc: { format: "avc" },
    };
    const support = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (!support?.supported) continue;
    const failure = await encoderWorks(config);
    if (!failure) return { codec, config, muxCodec: "avc" as const };
    failures.push(`${codec}: ${failure}`);
  }
  const vp9: VideoEncoderConfig = {
    codec: "vp09.00.51.08",
    width,
    height,
    bitrate,
    framerate: fps,
  };
  const support = await VideoEncoder.isConfigSupported(vp9).catch(() => null);
  if (support?.supported) {
    const failure = await encoderWorks(vp9);
    if (!failure) return { codec: vp9.codec, config: vp9, muxCodec: "vp9" as const };
    failures.push(`vp9: ${failure}`);
  }
  dbg(`no working encoder: ${failures.join(" | ")}`);
  throw new Error(
    `เบราว์เซอร์นี้เข้ารหัสวิดีโอ ${width}x${height} ไม่ได้ ลองลดความละเอียดหรือ FPS ลง` +
      (failures.length ? ` (${failures[0]})` : ""),
  );
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
    } catch {
      /* ลองตัวถัดไป */
    }
  }
  return null;
}

/**
 * ประมวลผลเสียงล่วงหน้า: ตัดเฉพาะช่วงที่เก็บไว้มาต่อกัน + noise reduction เดิม
 * คืนค่าเป็น AudioBuffer ของ timeline ผลลัพธ์ (เวลาต่อเนื่องหลังตัดช่วงเงียบแล้ว)
 */
async function renderAudio(
  source: Blob,
  segments: Segment[],
  total: number,
  options: { noiseReduction?: boolean; noiseFloor?: number; smoothCuts?: boolean },
): Promise<AudioBuffer | null> {
  let decoded: AudioBuffer;
  try {
    decoded = await decodeAudioFromFile(source);
  } catch {
    return null; // คลิปไม่มีแทร็กเสียง หรืออ่านไม่ได้ → ส่งออกเฉพาะภาพ
  }
  if (!decoded.length) return null;

  const sampleRate = decoded.sampleRate;
  const channels = Math.min(2, Math.max(1, decoded.numberOfChannels));
  const offline = new OfflineAudioContext(
    channels,
    Math.max(1, Math.ceil(total * sampleRate)),
    sampleRate,
  );

  const highpass = offline.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = options.noiseReduction ? 95 : 20;
  const lowpass = offline.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = options.noiseReduction ? 10500 : 20000;
  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = options.noiseReduction ? -38 : -24;
  compressor.ratio.value = options.noiseReduction ? 5 : 2;

  const gate =
    options.noiseReduction && options.noiseFloor
      ? await createNoiseGate(offline, { noiseFloor: options.noiseFloor })
      : null;

  highpass.connect(lowpass).connect(compressor);
  if (gate) (compressor.connect(gate.input), gate.output.connect(offline.destination));
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
    stickers?: Sticker[];
    /** Output frame rate; defaults to 30. */
    fps?: number;
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
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("โหลดวิดีโอไม่สำเร็จ (หมดเวลา)"));
      }, 20000);
      const ok = () => {
        cleanup();
        resolve();
      };
      const bad = () => {
        cleanup();
        reject(new Error("โหลดวิดีโอไม่สำเร็จ"));
      };
      const cleanup = () => {
        window.clearTimeout(timer);
        video.removeEventListener(ev, ok);
        video.removeEventListener("error", bad);
      };
      video.addEventListener(ev, ok, { once: true });
      video.addEventListener("error", bad, { once: true });
    });
  /**
   * The <video> is only needed for the seeking fallback. iPhone Safari loads a
   * video only after it plays, so start it muted for a moment.
   */
  let videoReady: Promise<void> | null = null;
  const ensureVideoReady = () =>
    (videoReady ??= (async () => {
      if (video.readyState >= 2) return;
      const loaded = waitFor("loadeddata");
      try {
        await video.play();
        video.pause();
      } catch {
        /* autoplay refused: loading may still finish */
      }
      await loaded;
    })());

  let encoder: VideoEncoder | null = null;
  let audioEncoder: AudioEncoder | null = null;
  let brollTrack: BrollTrack | null = null;
  let stickerLayer: StickerLayer | null = null;
  let frames: FrameReader | null = null;
  /** Encoded-but-not-yet-output frame copies, for recovering a failed encoder. */
  const pending: { index: number; frame: VideoFrame }[] = [];

  try {
    const sourceBlob = await fetch(url).then((response) => response.blob());
    // Read size and duration from the file; fall back to the <video> element.
    const probe = await probeVideo(sourceBlob);
    if (!probe) await ensureVideoReady();
    const duration = probe?.duration ?? video.duration;
    await ensureCaptionFonts(style);

    const sourceWidth = probe?.width || video.videoWidth || 1080;
    const sourceHeight = probe?.height || video.videoHeight || 1920;
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

    // Plan every output frame up front: which source time it shows, and in which segment.
    const fps = options.fps && options.fps > 0 ? options.fps : 30;
    const normalized = segments.map((segment, index) => {
      const start = Math.max(0, Math.min(duration, segment.start));
      const end = Math.max(0, Math.min(duration, segment.end));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.02) {
        throw new Error(`ช่วงวิดีโอที่ ${index + 1} ไม่ถูกต้อง (${segment.start}–${segment.end})`);
      }
      return { start, end };
    });
    const total = normalized.reduce((n, s) => n + (s.end - s.start), 0);
    const plan: { time: number; seg: Segment }[] = [];
    for (const seg of normalized) {
      const count = Math.max(1, Math.round((seg.end - seg.start) * fps));
      for (let k = 0; k < count; k++) {
        plan.push({ time: Math.min(seg.end - 0.001, seg.start + k / fps), seg });
      }
    }
    const planTimes = plan.map((frame) => frame.time);

    frames = await openFrameReader(sourceBlob, planTimes, { width, height, fit: "fill" });
    dbg(frames ? "decoding frames in order" : "falling back to seeking");

    brollTrack = await createBrollTrack(brollWindows(options.scenes, options.sceneElements), {
      plannedTimes: planTimes,
      size: { width, height },
    });
    if (options.stickers?.length) {
      stickerLayer = createStickerLayer(Math.min(1024, Math.max(256, Math.round(height * 0.5))));
      await stickerLayer.prepare(options.stickers);
    }

    const renderer = createBurnRenderer(ctx, width, height, groups, style, {
      captions: options.captions,
      smoothCuts: options.smoothCuts,
      scenes: options.scenes,
      sceneElements: options.sceneElements,
      brollTrack,
      stickers: options.stickers,
      stickerLayer: stickerLayer ?? undefined,
    });

    // ไม่ต้องลด fps ตามความสามารถเครื่องอีกแล้ว เพราะไม่ได้อัดตามเวลาจริง
    const frameDurationUs = 1e6 / fps;
    const bitrateOverride = (window as unknown as { __EXPORT_BITRATE?: number }).__EXPORT_BITRATE;
    const bitrate =
      bitrateOverride ??
      Math.min(64_000_000, Math.max(8_000_000, Math.round(width * height * fps * 0.2)));

    const { config: videoConfig, muxCodec } = await pickVideoCodec(width, height, bitrate, fps);

    // ---- เสียง (ทำล่วงหน้าแบบ offline) ----
    const canEncodeAudio = typeof AudioEncoder !== "undefined" && typeof AudioData !== "undefined";
    const audioBuffer = canEncodeAudio
      ? await renderAudio(sourceBlob, normalized, total, options)
      : null;
    const audioPick = audioBuffer
      ? await pickAudioCodec(audioBuffer.sampleRate, Math.min(2, audioBuffer.numberOfChannels))
      : null;
    // No way to encode audio here (iPhone Safari): copy the clip's own audio instead.
    const copied = audioPick ? null : await copyAudioPackets(sourceBlob, normalized);

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      // The muxer needs an integer timescale; 29.97fps uses 29970 ticks/s.
      video: {
        codec: muxCodec,
        width,
        height,
        frameRate: Number.isInteger(fps) ? fps : Math.round(fps * 1000),
      },
      ...(audioBuffer && audioPick
        ? {
            audio: {
              codec: audioPick.mux,
              numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
              sampleRate: audioBuffer.sampleRate,
            },
          }
        : copied
          ? {
              audio: {
                codec: copied.codec,
                numberOfChannels: copied.numberOfChannels,
                sampleRate: copied.sampleRate,
              },
            }
          : {}),
      fastStart: "in-memory" as const,
    });

    // Errors arrive in a callback; keep them so the loop can report the real cause.
    let encoderError: string | null = null;
    const messageOf = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
    const encodeFailed = (cause?: unknown) =>
      new Error(
        `เข้ารหัสวิดีโอไม่สำเร็จ (${videoConfig.codec}): ${encoderError ?? messageOf(cause)}`,
      );
    const makeEncoder = () => {
      const next = new VideoEncoder({
        output: (chunk, meta) => {
          muxer.addVideoChunk(chunk, meta);
          // This frame is safely in the file: stop keeping its copy.
          const done = Math.round(chunk.timestamp / frameDurationUs);
          while (pending.length && pending[0]!.index <= done) pending.shift()!.frame.close();
        },
        error: (error) => {
          encoderError = error.message || String(error);
        },
      });
      next.configure(videoConfig);
      return next;
    };
    encoder = makeEncoder();
    let activeEncoder = encoder;

    /**
     * iPhone's hardware encoder can drop out part way ("Encoding task did not
     * complete"). Frames it had not finished are still kept in `pending`, so a
     * fresh encoder re-encodes them (starting with a key frame) and the file
     * continues without a gap.
     */
    let recoveries = 0;
    const recover = async () => {
      while (encoderError) {
        if (recoveries >= 3) throw encodeFailed();
        recoveries++;
        dbg(`encoder failed (${encoderError}); restarting with ${pending.length} pending frames`);
        try {
          if (activeEncoder.state !== "closed") activeEncoder.close();
        } catch {
          /* already gone */
        }
        encoderError = null;
        await new Promise<void>((r) => window.setTimeout(r, 120));
        activeEncoder = encoder = makeEncoder();
        try {
          pending.forEach((item, i) => activeEncoder.encode(item.frame, { keyFrame: i === 0 }));
        } catch (error) {
          encoderError ??= messageOf(error);
        }
      }
    };
    // Keep the encoder's queue short: WebKit fails more often when flooded.
    const queueLimit = 4;

    onProgress?.(0.01); // setup done: show that work has started

    // ---- วนเฟรมทีละเฟรมตามเวลาที่ต้องการ ----
    let frameIndex = 0;
    const keyEvery = Math.round(fps * 2); // keyframe ทุก 2 วินาที เพื่อให้ seek ในไฟล์ผลลัพธ์ลื่น
    let lastYield = performance.now();
    for (const { time, seg } of plan) {
      if (options.signal?.aborted) throw new DOMException("ยกเลิกการเรนเดอร์", "AbortError");
      if (encoderError) await recover();
      let image: CanvasImageSource | null = null;
      if (frames) {
        try {
          image = await frames.next();
        } catch (error) {
          // The decoder gave up part way: finish the rest by seeking.
          dbg(`in-order decode failed, seeking instead: ${String(error)}`);
          frames.dispose();
          frames = null;
        }
      }
      if (!image) {
        await ensureVideoReady();
        await seekTo(video, time);
        image = video;
      }
      await brollTrack?.prepare(time);
      renderer.paint(image, time, seg);
      const timestamp = Math.round(frameIndex * frameDurationUs);
      const frame = new VideoFrame(canvas, { timestamp, duration: Math.round(frameDurationUs) });
      // The encoder copies the frame; this copy stays until its chunk is out.
      pending.push({ index: frameIndex, frame });
      try {
        activeEncoder.encode(frame, { keyFrame: frameIndex % keyEvery === 0 });
      } catch (error) {
        encoderError ??= messageOf(error);
      }
      if (encoderError) await recover();
      frameIndex++;
      while (activeEncoder.encodeQueueSize >= queueLimit || pending.length > 24) {
        if (encoderError) await recover();
        await new Promise<void>((r) => window.setTimeout(r, 4));
      }
      // Give the page a moment now and then so progress paints and taps still work.
      if (performance.now() - lastYield > 50) {
        await new Promise<void>((r) => window.setTimeout(r, 0));
        lastYield = performance.now();
      }
      if ((frameIndex & 7) === 0) onProgress?.(Math.min(0.97, frameIndex / plan.length));
    }
    dbg(`frames=${frameIndex}`);

    for (;;) {
      try {
        await activeEncoder.flush();
      } catch (error) {
        encoderError ??= messageOf(error);
      }
      if (!encoderError) break;
      await recover();
    }
    activeEncoder.close();
    encoder = null;

    // ---- เข้ารหัสเสียงที่เรนเดอร์ไว้ ----
    if (audioBuffer && audioPick) {
      const channels = Math.min(2, audioBuffer.numberOfChannels);
      const sampleRate = audioBuffer.sampleRate;
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (error) => {
          throw new Error(`เข้ารหัสเสียงไม่สำเร็จ: ${error.message}`);
        },
      });
      audioEncoder.configure(audioPick.config);
      const data: Float32Array[] = [];
      for (let c = 0; c < channels; c++) data.push(audioBuffer.getChannelData(c));
      const block = 4096;
      for (let offset = 0; offset < audioBuffer.length; offset += block) {
        const frames = Math.min(block, audioBuffer.length - offset);
        const planar = new Float32Array(frames * channels);
        for (let c = 0; c < channels; c++)
          planar.set(data[c]!.subarray(offset, offset + frames), c * frames);
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
          while (audioEncoder.encodeQueueSize > 16)
            await new Promise<void>((r) => window.setTimeout(r, 4));
        }
      }
      await audioEncoder.flush();
      audioEncoder.close();
      audioEncoder = null;
    }

    if (copied) {
      copied.packets.forEach((packet, i) =>
        muxer.addAudioChunkRaw(
          packet.data,
          "key",
          packet.timestamp,
          packet.duration,
          i === 0 ? { decoderConfig: copied.decoderConfig } : undefined,
        ),
      );
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
      audioCodec: audioBuffer && audioPick ? audioPick.mux : (copied?.codec ?? "none"),
      audioCopied: !!copied,
      videoCodec: videoConfig.codec,
      renderMs: performance.now() - started,
    };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.remove();
    frames?.dispose();
    for (const item of pending.splice(0)) item.frame.close();
    try {
      brollTrack?.dispose();
    } catch {
      /* ignore */
    }
    stickerLayer?.destroy();
    try {
      if (encoder && encoder.state !== "closed") encoder.close();
    } catch {
      /* ignore */
    }
    try {
      if (audioEncoder && audioEncoder.state !== "closed") audioEncoder.close();
    } catch {
      /* ignore */
    }
  }
}
