import { wavSecondsFromBase64 } from "./wav-billing";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function wav(seconds: number, rate = 16000, patch?: (view: DataView) => void): string {
  const dataBytes = Math.round(seconds * rate) * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const str = (offset: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  str(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, dataBytes, true);
  patch?.(view);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
assert(near(wavSecondsFromBase64(wav(3)), 3), "16 kHz mono");
assert(near(wavSecondsFromBase64(wav(2, 48000)), 2), "48 kHz mono");

const throws = (b64: string) => {
  try {
    wavSecondsFromBase64(b64);
    return false;
  } catch {
    return true;
  }
};
// a forged byte rate must not shrink the charge
assert(throws(wav(3, 16000, (v) => v.setUint32(28, 384000, true))), "forged byte rate");
assert(throws(wav(3, 16000, (v) => v.setUint16(20, 3, true))), "not PCM");
assert(throws(btoa("not a wav file at all, just some text that is long enough....")), "garbage");

console.log("wav billing tests passed");
