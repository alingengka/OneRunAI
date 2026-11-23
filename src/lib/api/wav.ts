/**
 * Reads a PCM WAV file into the small slice of the Web Audio AudioBuffer API
 * the subtitle pipeline uses, so the same speech detection and alignment code
 * runs on the server (where there is no AudioBuffer).
 */
export type PcmBuffer = Pick<
  AudioBuffer,
  "sampleRate" | "length" | "duration" | "numberOfChannels" | "getChannelData"
>;

export function parseWav(bytes: Uint8Array): PcmBuffer {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.byteLength < 44 || text(0) !== "RIFF" || text(8) !== "WAVE") {
    throw new Error("ไฟล์ต้องเป็น WAV (16-bit PCM)");
  }
  let format: { channels: number; sampleRate: number; bits: number; tag: number } | null = null;
  let data: { offset: number; size: number } | null = null;
  for (let offset = 12; offset + 8 <= bytes.byteLength;) {
    const id = text(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      format = {
        tag: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === "data") {
      // ffmpeg writing to a pipe leaves the size unset; take what is there
      const available = bytes.byteLength - body;
      data = { offset: body, size: size === 0 || size > available ? available : size };
      break;
    }
    offset = body + size + (size % 2);
  }
  // 0xFFFE is WAVE_FORMAT_EXTENSIBLE, which ffmpeg uses for some layouts
  if (!format || !data || (format.tag !== 1 && format.tag !== 0xfffe) || format.bits !== 16) {
    throw new Error("ไฟล์ต้องเป็น WAV แบบ 16-bit PCM");
  }
  if (format.channels < 1 || format.sampleRate < 8000 || format.sampleRate > 96000) {
    throw new Error("รูปแบบเสียงในไฟล์ WAV ไม่รองรับ");
  }
  const { channels, sampleRate } = format;
  const length = Math.floor(data.size / 2 / channels);
  const planes = Array.from({ length: channels }, () => new Float32Array(length));
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      planes[c]![i] = view.getInt16(data.offset + (i * channels + c) * 2, true) / 0x8000;
    }
  }
  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels: channels,
    getChannelData: (channel: number) => {
      const plane = planes[channel];
      if (!plane) throw new RangeError("channel");
      return plane;
    },
  };
}
