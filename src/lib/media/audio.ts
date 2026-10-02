export type Segment = { start: number; end: number };

export type SilenceOptions = {
  /** dB below peak considered silence */
  thresholdDb: number;
  /** minimum silence length to cut (seconds) */
  minSilence: number;
  /** padding kept around speech (seconds) */
  padding: number;
};

export const defaultSilenceOptions: SilenceOptions = {
  thresholdDb: -34,
  minSilence: 0.35,
  padding: 0.12,
};

function newAudioContext(): AudioContext {
  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new Ctx();
}

async function decodeBytes(bytes: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = newAudioContext();
  try {
    return await ctx.decodeAudioData(bytes);
  } finally {
    void ctx.close();
  }
}

/**
 * Copies only the audio track into a small audio-only MP4 without re-encoding.
 * Mobile Safari often fails ("Decoding failed") on a full phone video with
 * decodeAudioData, but decodes the same AAC audio once the video track is gone.
 */
async function extractAudioOnly(file: Blob): Promise<ArrayBuffer | null> {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } =
    await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    if (!(await input.getPrimaryAudioTrack())) return null;
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: { discard: true },
      showWarnings: false,
    });
    if (!conversion.isValid) return null;
    await conversion.execute();
    return output.target.buffer;
  } finally {
    input.dispose();
  }
}

/** Decodes the audio track with WebCodecs, for files the Web Audio decoder rejects. */
async function decodeWithWebCodecs(file: Blob): Promise<AudioBuffer | null> {
  if (typeof AudioDecoder === "undefined") return null;
  const { ALL_FORMATS, AudioBufferSink, BlobSource, Input } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const parts: AudioBuffer[] = [];
    for await (const { buffer } of new AudioBufferSink(track).buffers()) parts.push(buffer);
    const first = parts[0];
    if (!first) return null;
    const channels = first.numberOfChannels;
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new AudioBuffer({ length, numberOfChannels: channels, sampleRate: first.sampleRate });
    for (let c = 0; c < channels; c++) {
      const data = out.getChannelData(c);
      let offset = 0;
      for (const part of parts) {
        data.set(part.getChannelData(Math.min(c, part.numberOfChannels - 1)), offset);
        offset += part.length;
      }
    }
    return out;
  } finally {
    input.dispose();
  }
}

export async function decodeAudioFromFile(file: File | Blob): Promise<AudioBuffer> {
  let firstError: unknown;
  try {
    const audioOnly = await extractAudioOnly(file);
    if (audioOnly) return await decodeBytes(audioOnly);
  } catch (error) {
    firstError = error;
  }
  try {
    return await decodeBytes(await file.arrayBuffer());
  } catch (error) {
    firstError ??= error;
  }
  try {
    const decoded = await decodeWithWebCodecs(file);
    if (decoded) return decoded;
  } catch {
    // fall through to the original error
  }
  throw firstError ?? new Error("No audio track");
}

/** Returns speech segments (non-silent parts) of the buffer. */
export function detectSpeechSegments(buffer: AudioBuffer, opts: SilenceOptions): Segment[] {
  const sr = buffer.sampleRate;
  const win = Math.max(256, Math.floor(sr * 0.025)); // 25ms analysis window
  const hop = Math.max(128, Math.floor(sr * 0.01)); // 10ms hop (overlapping)
  const frames: number[] = [];

  for (let i = 0; i + 1 < buffer.length; i += hop) {
    let sum = 0;
    let count = 0;
    const end = Math.min(i + win, buffer.length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      let previous = data[Math.max(0, i - 1)] ?? 0;
      for (let j = i; j < end; j++) {
        const v = data[j] ?? 0;
        // simple pre-emphasis so low-frequency room rumble is not read as speech
        const hp = v - previous * 0.95;
        previous = v;
        sum += hp * hp;
        count++;
      }
    }
    frames.push(Math.sqrt(sum / Math.max(1, count)));
  }

  if (!frames.length) return [];

  // smooth the energy envelope so single noisy frames do not toggle the gate
  const smooth = frames.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(frames.length - 1, i + 2); k++) {
      sum += frames[k] ?? 0;
      n++;
    }
    return sum / Math.max(1, n);
  });

  const sorted = [...smooth].sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.15)] ?? 1e-8;
  const speechLevel = sorted[Math.floor(sorted.length * 0.92)] ?? noiseFloor;
  const relative = speechLevel * Math.pow(10, opts.thresholdDb / 20);
  // hysteresis: open the gate on a clear level, close it only well below
  const openLevel = Math.max(noiseFloor * 2.4, relative, 0.00008);
  const closeLevel = Math.max(noiseFloor * 1.5, openLevel * 0.55);

  const frameDur = hop / sr;
  const releaseFrames = Math.max(1, Math.round(opts.minSilence / frameDur));
  const attackFrames = 2; // need ~20ms above the gate to start a segment

  const segments: Segment[] = [];
  let current: Segment | null = null;
  let aboveRun = 0;
  let belowRun = 0;

  smooth.forEach((rms, index) => {
    const t = index * frameDur;
    if (rms >= openLevel || (current && rms >= closeLevel)) {
      aboveRun++;
      belowRun = 0;
      if (!current && aboveRun >= attackFrames) {
        current = { start: Math.max(0, t - attackFrames * frameDur), end: t + frameDur };
      } else if (current) {
        current.end = Math.min(buffer.duration, t + frameDur);
      }
    } else {
      aboveRun = 0;
      if (current) {
        belowRun++;
        if (belowRun >= releaseFrames) {
          segments.push(current);
          current = null;
          belowRun = 0;
        }
      }
    }
  });
  if (current) segments.push(current);

  const duration = buffer.duration;
  return segments
    .map((s) => ({
      start: Math.max(0, s.start - opts.padding),
      end: Math.min(duration, s.end + opts.padding),
    }))
    .reduce<Segment[]>((acc, s) => {
      const last = acc[acc.length - 1];
      if (last && s.start <= last.end + 0.01) last.end = Math.max(last.end, s.end);
      else acc.push({ ...s });
      return acc;
    }, [])
    .filter((s) => s.end - s.start > 0.12);
}


/**
 * Prevent choppy edits by joining tiny pauses (breaths and gaps between words)
 * and keeping a small amount of room around each spoken phrase.
 */
export function smoothSpeechSegments(
  segments: Segment[],
  duration: number,
  joinGap = 0.18,
  edgePadding = 0.08,
): Segment[] {
  return segments.reduce<Segment[]>((result, segment) => {
    const next = {
      start: Math.max(0, segment.start - edgePadding),
      end: Math.min(duration, segment.end + edgePadding),
    };
    const previous = result[result.length - 1];
    if (previous && next.start - previous.end <= joinGap) {
      previous.end = Math.max(previous.end, next.end);
    } else {
      result.push(next);
    }
    return result;
  }, []);
}

/** Split a longer speech region at low-energy valleys for tighter caption timing. */
export function refineSpeechSegments(buffer: AudioBuffer, segments: Segment[], maxLength = 4): Segment[] {
  const sr = buffer.sampleRate;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const refined: Segment[] = [];
  for (const segment of segments) {
    let start = segment.start;
    while (segment.end - start > maxLength) {
      const target = start + maxLength;
      const searchStart = Math.max(start + 1, target - 0.6);
      const searchEnd = Math.min(segment.end - 0.25, target + 0.6);
      let best = target;
      let bestEnergy = Number.POSITIVE_INFINITY;
      for (let t = searchStart; t <= searchEnd; t += 0.02) {
        const from = Math.floor(t * sr);
        const to = Math.min(buffer.length, from + Math.floor(sr * 0.04));
        let energy = 0;
        for (const data of channels) {
          for (let i = from; i < to; i++) energy += Math.abs(data[i] ?? 0);
        }
        if (energy < bestEnergy) { bestEnergy = energy; best = t; }
      }
      refined.push({ start, end: best });
      start = best;
    }
    if (segment.end - start > 0.08) refined.push({ start, end: segment.end });
  }
  return refined;
}

export function invertSegments(segments: Segment[], duration: number): Segment[] {
  const gaps: Segment[] = [];
  let cursor = 0;
  for (const s of segments) {
    if (s.start - cursor > 0.01) gaps.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (duration - cursor > 0.01) gaps.push({ start: cursor, end: duration });
  return gaps;
}

/** Encode an AudioBuffer to 16-bit mono 16kHz WAV (safe for transcription upload). */
export function encodeWav16k(buffer: AudioBuffer): Blob {
  const targetRate = 16000;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  const ratio = buffer.sampleRate / targetRate;
  const length = Math.floor(buffer.length / ratio);
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.max(from + 1, Math.min(buffer.length, Math.floor((i + 1) * ratio)));
    let sum = 0;
    let count = 0;
    for (const channel of channels) {
      for (let sample = from; sample < to; sample++) {
        sum += channel[sample] ?? 0;
        count++;
      }
    }
    const s = count ? sum / count : 0;
    out[i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }
  const bytes = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(bytes);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + out.length * 2, true);
  writeStr(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, out.length * 2, true);
  for (let i = 0; i < out.length; i++) view.setInt16(44 + i * 2, out[i] ?? 0, true);
  return new Blob([bytes], { type: "audio/wav" });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Group speech segments into chunks of at most `maxLen` seconds of speech. */
export function chunkSegments(segments: Segment[], maxLen = 20): Segment[][] {
  const chunks: Segment[][] = [];
  let current: Segment[] = [];
  let len = 0;
  for (const s of segments) {
    const d = s.end - s.start;
    if (current.length && len + d > maxLen) {
      chunks.push(current);
      current = [];
      len = 0;
    }
    current.push(s);
    len += d;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function encodePcmWav(samples: Float32Array, sampleRate: number): Blob {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.max(-1, Math.min(1, samples[i] ?? 0)) * 0x7fff;
  }
  const bytes = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(bytes);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + out.length * 2, true);
  writeStr(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, out.length * 2, true);
  for (let i = 0; i < out.length; i++) view.setInt16(44 + i * 2, out[i] ?? 0, true);
  return new Blob([bytes], { type: "audio/wav" });
}

/**
 * Encode only the given segments (speech) of the buffer to a 16 kHz mono WAV.
 * Used so transcription hears exactly the audio a caption chunk covers.
 */
export function encodeSegmentsWav16k(buffer: AudioBuffer, segs: Segment[], reduceNoise = false): Blob {
  const targetRate = 16000;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  const ratio = buffer.sampleRate / targetRate;
  const total = segs.reduce(
    (n, s) => n + Math.max(0, Math.floor(((s.end - s.start) * buffer.sampleRate) / ratio)),
    0,
  );
  const outSamples = new Float32Array(total);
  let w = 0;
  for (const s of segs) {
    const from = Math.floor(s.start * buffer.sampleRate);
    const count = Math.floor(((s.end - s.start) * buffer.sampleRate) / ratio);
    for (let i = 0; i < count && w < total; i++) {
      const sourceIndex = Math.min(buffer.length - 1, from + Math.floor(i * ratio));
      const sourceEnd = Math.max(sourceIndex + 1, Math.min(buffer.length, from + Math.floor((i + 1) * ratio)));
      let mixed = 0;
      let mixedCount = 0;
      for (const channel of channels) {
        for (let sampleIndex = sourceIndex; sampleIndex < sourceEnd; sampleIndex++) {
          mixed += channel[sampleIndex] ?? 0;
          mixedCount++;
        }
      }
      const sample = mixedCount ? mixed / mixedCount : 0;
      const previousIndex = Math.max(0, sourceIndex - Math.max(1, Math.floor(ratio)));
      const previous = channels.reduce((sum, channel) => sum + (channel[previousIndex] ?? 0), 0) / Math.max(1, channels.length);
      const highPassed = sample - previous * 0.96;
      const cleaned = reduceNoise
        ? (Math.abs(highPassed) < 0.006 ? highPassed * 0.12 : highPassed * 1.15)
        : sample;
      const fadeSamples = Math.min(count / 2, Math.floor(targetRate * 0.012));
      const edgeGain = Math.min(1, i / Math.max(1, fadeSamples), (count - i) / Math.max(1, fadeSamples));
      outSamples[w++] = cleaned * Math.max(0, edgeGain);
    }
  }
  return encodePcmWav(outSamples.subarray(0, w), targetRate);
}

/**
 * Group detected speech regions into phrase-sized chunks for transcription.
 * Very short one-word chunks make Lao/Thai recognition guess; a few seconds of
 * continuous speech gives the model context while still keeping each chunk
 * anchored to the moment it was spoken.
 */
export function buildAsrChunks(
  segments: Segment[],
  duration: number,
  opts: { min?: number; max?: number; gap?: number; pad?: number } = {},
): Segment[][] {
  const min = opts.min ?? 2.4;
  const max = opts.max ?? 12;
  const gap = opts.gap ?? 0.55;
  const pad = opts.pad ?? 0.12;

  const padded = segments
    .map((s) => ({ start: Math.max(0, s.start - pad), end: Math.min(duration, s.end + pad) }))
    .filter((s) => s.end > s.start);

  const chunks: Segment[][] = [];
  let current: Segment[] = [];
  let length = 0;
  let previousEnd = -Infinity;

  for (const seg of padded) {
    const segLen = seg.end - seg.start;
    const detached = seg.start - previousEnd > gap;
    if (current.length && (length + segLen > max || (detached && length >= min))) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(seg);
    length += segLen;
    previousEnd = seg.end;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/**
 * Add a small acoustic overlap to phrase chunks. The overlap protects Lao
 * syllables at chunk boundaries; downstream merging removes duplicated words.
 */
export function addChunkOverlap(
  chunks: Segment[][],
  duration: number,
  seconds = 0.32,
): Segment[][] {
  return chunks.map((chunk, index) => {
    if (!chunk.length) return chunk;
    const copy = chunk.map((segment) => ({ ...segment }));
    const first = copy[0];
    const last = copy[copy.length - 1];
    if (first && index > 0) first.start = Math.max(0, first.start - seconds);
    if (last && index < chunks.length - 1) last.end = Math.min(duration, last.end + seconds);
    return copy.reduce<Segment[]>((merged, segment) => {
      const previous = merged[merged.length - 1];
      if (previous && segment.start <= previous.end) previous.end = Math.max(previous.end, segment.end);
      else merged.push(segment);
      return merged;
    }, []);
  });
}

/**
 * งาน A: ทำให้ขอบเขตการตัดช่วงเงียบแม่นขึ้นด้วยเวลาคำจริงจากการถอดเสียง
 *
 * energy gate อาจเปิด/ปิดไม่ตรงพยางค์เป๊ะเมื่อ noise floor แกว่ง ฟังก์ชันนี้จึง
 * ขยายขอบ segment ที่ทับกับคำจริงให้ครอบคลุมตั้งแต่ start ของคำแรกถึง end ของ
 * คำสุดท้ายในช่วงนั้น และเพิ่มช่วงใหม่ให้คำที่ energy gate พลาดไปทั้งคำ
 */
export function reconcileSegmentsWithWords(
  segments: Segment[],
  words: { start: number; end: number }[],
  opts: { duration?: number; pad?: number; joinGap?: number; maxGrow?: number; maxWord?: number; nearGap?: number } = {},
): Segment[] {
  const maxWord = opts.maxWord ?? 1.2;
  const valid = words
    .filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start)
    // เวลาที่ยาวผิดปกติมักมาจากการเดา (interpolate) ไม่ใช่คำจริง ถ้าเอามาขยายขอบ
    // จะกลืนช่วงเงียบที่ควรถูกตัดออก ทำให้ dead-air กลับมา
    .filter((w) => w.end - w.start <= maxWord)
    .sort((a, b) => a.start - b.start);
  if (!segments.length || !valid.length) return segments;

  const pad = opts.pad ?? 0.04;
  const joinGap = opts.joinGap ?? 0.08;
  // ขยายขอบได้แค่เล็กน้อยเท่านั้น (กันพยางค์ขาด) ไม่ใช่ยืดจนคลุมช่วงเงียบ
  const maxGrow = opts.maxGrow ?? 0.12;
  const duration = opts.duration ?? Math.max(
    segments[segments.length - 1]?.end ?? 0,
    valid[valid.length - 1]?.end ?? 0,
  );
  const clamp = (t: number) => Math.max(0, Math.min(duration, t));

  const grown: Segment[] = segments.map((s) => ({ ...s }));
  const covered = (w: { start: number; end: number }) =>
    grown.some((s) => w.start < s.end && w.end > s.start);

  for (const seg of grown) {
    const overlapping = valid.filter((w) => w.start < seg.end && w.end > seg.start);
    if (!overlapping.length) continue;
    const first = overlapping[0]!;
    const last = overlapping[overlapping.length - 1]!;
    const startFloor = seg.start - maxGrow;
    const endCeil = seg.end + maxGrow;
    seg.start = clamp(Math.max(startFloor, Math.min(seg.start, first.start - pad)));
    seg.end = clamp(Math.min(endCeil, Math.max(seg.end, last.end + pad)));
  }

  // คำที่ energy gate พลาดทั้งคำ (เช่นพูดเบามาก) ให้เพิ่มเป็นช่วงใหม่
  // แต่เฉพาะคำสั้น ๆ ที่อยู่ติดกับช่วงพูดจริงเท่านั้น — เวลาคำที่มาจากการเดา
  // (interpolate) มักตกอยู่กลางความเงียบ ถ้าเพิ่มเข้าไปด้วยจะกลายเป็น dead-air
  const near = opts.nearGap ?? 0.35;
  const original = segments;
  for (const w of valid) {
    if (covered(w)) continue;
    if (w.end - w.start > 0.6) continue;
    const adjacent = original.some((s) => w.start - s.end <= near && s.start - w.end <= near);
    if (!adjacent) continue;
    grown.push({ start: clamp(w.start - pad), end: clamp(w.end + pad) });
  }

  return grown
    .sort((a, b) => a.start - b.start)
    .reduce<Segment[]>((acc, s) => {
      const last = acc[acc.length - 1];
      if (last && s.start - last.end <= joinGap) last.end = Math.max(last.end, s.end);
      else acc.push({ ...s });
      return acc;
    }, [])
    .filter((s) => s.end - s.start > 0.05);
}

/**
 * ระดับเสียงรบกวนพื้นหลัง (RMS) จากคลิป ใช้เป็น threshold ของ noise gate ตอน export
 * ใช้เปอร์เซ็นไทล์ที่ 15 แบบเดียวกับ detectSpeechSegments เพื่อให้สอดคล้องกัน
 */
export function estimateNoiseFloor(buffer: AudioBuffer): number {
  const sr = buffer.sampleRate;
  const win = Math.max(256, Math.floor(sr * 0.025));
  const hop = Math.max(128, Math.floor(sr * 0.01));
  const data = buffer.getChannelData(0);
  const frames: number[] = [];
  for (let i = 0; i + win < buffer.length; i += hop) {
    let sum = 0;
    for (let j = i; j < i + win; j++) {
      const v = data[j] ?? 0;
      sum += v * v;
    }
    frames.push(Math.sqrt(sum / win));
  }
  if (!frames.length) return 0;
  frames.sort((a, b) => a - b);
  return frames[Math.floor(frames.length * 0.15)] ?? 0;
}

