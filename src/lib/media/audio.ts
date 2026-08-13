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
  padding: 0.06,
};

export async function decodeAudioFromFile(file: File | Blob): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    void ctx.close();
  }
}

/** Returns speech segments (non-silent parts) of the buffer. */
export function detectSpeechSegments(buffer: AudioBuffer, opts: SilenceOptions): Segment[] {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const win = Math.max(256, Math.floor(sr * 0.02)); // 20ms
  const frames: number[] = [];
  let peak = 1e-8;

  for (let i = 0; i < data.length; i += win) {
    let sum = 0;
    const end = Math.min(i + win, data.length);
    for (let j = i; j < end; j++) sum += data[j] * data[j];
    const rms = Math.sqrt(sum / Math.max(1, end - i));
    frames.push(rms);
    if (rms > peak) peak = rms;
  }

  const threshold = peak * Math.pow(10, opts.thresholdDb / 20);
  const frameDur = win / sr;
  const segments: Segment[] = [];
  let current: Segment | null = null;

  frames.forEach((rms, index) => {
    const t = index * frameDur;
    if (rms >= threshold) {
      if (!current) current = { start: t, end: t + frameDur };
      else current.end = t + frameDur;
    } else if (current) {
      const gapStart = current.end;
      // close only when the silence run is long enough
      const silenceLen = t + frameDur - gapStart;
      if (silenceLen >= opts.minSilence) {
        segments.push(current);
        current = null;
      } else {
        current.end = t + frameDur;
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
    .filter((s) => s.end - s.start > 0.08);
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
  const src = buffer.getChannelData(0);
  const ratio = buffer.sampleRate / targetRate;
  const length = Math.floor(src.length / ratio);
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const s = src[Math.floor(i * ratio)] ?? 0;
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
  for (let i = 0; i < out.length; i++) view.setInt16(44 + i * 2, out[i], true);
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
