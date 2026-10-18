/**
 * Seconds of AI audio to bill for a PCM WAV sent as base64. The header is
 * checked for a consistent PCM format first: a forged byte rate (say, 384000
 * for 16 kHz audio) used to cut the charge many times over.
 */
export function wavSecondsFromBase64(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const totalBytes = Math.floor((base64.length * 3) / 4) - padding;
  let header: Uint8Array;
  try {
    header = Uint8Array.from(atob(base64.slice(0, 64)), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("ไฟล์เสียงไม่ถูกต้อง");
  }
  if (header.length < 44) throw new Error("ไฟล์เสียงไม่ถูกต้อง");
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const tag = (offset: number) => String.fromCharCode(...header.subarray(offset, offset + 4));
  const format = view.getUint16(20, true);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const byteRate = view.getUint32(28, true);
  const blockAlign = view.getUint16(32, true);
  const bits = view.getUint16(34, true);
  const valid =
    tag(0) === "RIFF" &&
    tag(8) === "WAVE" &&
    tag(12) === "fmt " &&
    format === 1 &&
    channels >= 1 &&
    channels <= 2 &&
    sampleRate >= 8000 &&
    sampleRate <= 96000 &&
    (bits === 8 || bits === 16 || bits === 24 || bits === 32) &&
    blockAlign === (channels * bits) / 8 &&
    byteRate === sampleRate * blockAlign;
  if (!valid) throw new Error("ไฟล์เสียงไม่ถูกต้อง (ต้องเป็น WAV แบบ PCM)");
  return Math.max(0, totalBytes - 44) / byteRate;
}
