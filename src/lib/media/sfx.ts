/**
 * เสียงเอฟเฟกต์สำหรับ "เนื้อหาในคลิป" (ไม่ใช่เสียง UI ของแอป)
 *
 * ทุก preset สังเคราะห์สดด้วย Web Audio ไม่มีไฟล์เสียงภายนอก และรับ BaseAudioContext
 * จึงใช้ได้ทั้งกับ AudioContext (พรีวิว) และ OfflineAudioContext (ตอน export)
 */

export type SfxId = "whoosh" | "impact" | "ding" | "riser" | "click";

export type SfxPreset = {
  id: SfxId;
  label: string;
  icon: string;
  /** ความยาวโดยประมาณ (วินาที) ใช้เผื่อ tail ตอน export */
  duration: number;
  schedule: (ctx: BaseAudioContext, startTime: number, destination: AudioNode, volume: number) => void;
};

function noiseBuffer(ctx: BaseAudioContext, seconds: number) {
  const length = Math.max(1, Math.ceil(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // pink-ish ฟังนุ่มกว่า white ล้วน
    data[i] = white * 0.7 + last * 3;
  }
  return buffer;
}

const clampVolume = (v: number) => Math.max(0, Math.min(1, v));

export const SFX_PRESETS: SfxPreset[] = [
  {
    id: "whoosh",
    label: "Whoosh",
    icon: "💨",
    duration: 0.7,
    schedule(ctx, t0, dest, volume) {
      const gainPeak = 0.5 * clampVolume(volume);
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 0.8);
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 1.1;
      band.frequency.setValueAtTime(320, t0);
      band.frequency.exponentialRampToValueAtTime(3600, t0 + 0.32);
      band.frequency.exponentialRampToValueAtTime(420, t0 + 0.68);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainPeak), t0 + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
      src.connect(band).connect(gain).connect(dest);
      src.start(t0);
      src.stop(t0 + 0.8);
    },
  },
  {
    id: "impact",
    label: "Impact",
    icon: "💥",
    duration: 0.9,
    schedule(ctx, t0, dest, volume) {
      const v = clampVolume(volume);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, t0);
      osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.45);
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.0001, t0);
      oscGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.85 * v), t0 + 0.015);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.8);
      osc.connect(oscGain).connect(dest);
      osc.start(t0);
      osc.stop(t0 + 0.9);

      // ชั้น noise สั้น ๆ ให้หัวเสียงมีเนื้อ
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 0.25);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(2200, t0);
      lp.frequency.exponentialRampToValueAtTime(220, t0 + 0.22);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(Math.max(0.0002, 0.35 * v), t0);
      nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      src.connect(lp).connect(nGain).connect(dest);
      src.start(t0);
      src.stop(t0 + 0.3);
    },
  },
  {
    id: "ding",
    label: "Ding",
    icon: "🔔",
    duration: 0.6,
    schedule(ctx, t0, dest, volume) {
      const v = clampVolume(volume);
      [1318.5, 1975.5, 2637].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, t0);
        const gain = ctx.createGain();
        const peak = Math.max(0.0002, (0.4 / (i + 1.4)) * v);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5 - i * 0.1);
        osc.connect(gain).connect(dest);
        osc.start(t0);
        osc.stop(t0 + 0.6);
      });
    },
  },
  {
    id: "riser",
    label: "Riser",
    icon: "📈",
    duration: 1.0,
    schedule(ctx, t0, dest, volume) {
      const v = clampVolume(volume);
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, t0);
      osc.frequency.exponentialRampToValueAtTime(1800, t0 + 0.95);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(600, t0);
      lp.frequency.exponentialRampToValueAtTime(9000, t0 + 0.95);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.32 * v), t0 + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
      osc.connect(lp).connect(gain).connect(dest);
      osc.start(t0);
      osc.stop(t0 + 1.0);

      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 1.0);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(500, t0);
      hp.frequency.exponentialRampToValueAtTime(6000, t0 + 0.95);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.0001, t0);
      nGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.22 * v), t0 + 0.85);
      nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
      src.connect(hp).connect(nGain).connect(dest);
      src.start(t0);
      src.stop(t0 + 1.0);
    },
  },
  {
    id: "click",
    label: "Click",
    icon: "👆",
    duration: 0.12,
    schedule(ctx, t0, dest, volume) {
      const v = clampVolume(volume);
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(2200, t0);
      osc.frequency.exponentialRampToValueAtTime(700, t0 + 0.06);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.4 * v), t0 + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
      osc.connect(gain).connect(dest);
      osc.start(t0);
      osc.stop(t0 + 0.12);
    },
  },
];

export const DEFAULT_SFX_ID: SfxId = SFX_PRESETS[0]!.id;

export function getSfxPreset(id: string | undefined): SfxPreset {
  return SFX_PRESETS.find((p) => p.id === id) ?? SFX_PRESETS[0]!;
}

export function scheduleSfx(
  ctx: BaseAudioContext,
  id: string | undefined,
  startTime: number,
  destination: AudioNode,
  volume: number,
) {
  getSfxPreset(id).schedule(ctx, Math.max(0, startTime), destination, volume);
}

/** AudioContext แยกสำหรับพรีวิวเสียงเอฟเฟกต์ในคลิป (คนละตัวกับเสียง UI ของแอป) */
let previewCtx: AudioContext | null = null;

export async function playSfxNow(id: string | undefined, volume: number) {
  if (typeof window === "undefined") return;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  if (!previewCtx) previewCtx = new Ctor();
  if (previewCtx.state === "suspended") await previewCtx.resume();
  scheduleSfx(previewCtx, id, previewCtx.currentTime + 0.02, previewCtx.destination, volume);
}
