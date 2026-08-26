/**
 * UI Audio System
 * Uses Web Audio API to synthesize UI sound effects without external assets.
 */

import type { CaptionAnimation } from "./captions";

export type SoundPack = "clean" | "punch" | "soft" | "digital";
export type SoundType = 'click' | 'hover' | 'success' | 'error' | 'open' | 'close' | 'pop' | CaptionAnimation;

class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.5;
  private enabled: boolean = true;
  private pack: SoundPack = "clean";

  private init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx?.currentTime ?? 0, 0.05);
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setPack(pack: SoundPack) { this.pack = pack; }

  async play(type: SoundType) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    const animationSound = ["fade", "slideUp", "typewriter", "bounce", "zoom", "karaoke", "shake", "flip"].includes(type) ? type : null;
    if (animationSound) {
      const packScale = { clean: 1, punch: 0.72, soft: 1.25, digital: 1.5 }[this.pack];
      const profiles: Record<string, { from: number; to: number; duration: number; wave: OscillatorType; pulses?: number }> = {
        fade: { from: 240, to: 420, duration: 0.32, wave: "sine" },
        slideUp: { from: 180, to: 920, duration: 0.2, wave: "sine" },
        typewriter: { from: 1250, to: 980, duration: 0.055, wave: "square", pulses: 2 },
        bounce: { from: 150, to: 520, duration: 0.24, wave: "triangle", pulses: 2 },
        zoom: { from: 90, to: 760, duration: 0.28, wave: "sawtooth" },
        karaoke: { from: 620, to: 780, duration: 0.12, wave: "sine" },
        shake: { from: 95, to: 65, duration: 0.18, wave: "sawtooth", pulses: 5 },
        flip: { from: 980, to: 190, duration: 0.22, wave: "square" },
      };
      const profile = profiles[animationSound] ?? profiles["fade"];
      if (!profile) return;
      const duration = profile.duration * (this.pack === "soft" ? 1.35 : this.pack === "punch" ? 0.8 : 1);
      osc.type = this.pack === "digital" ? "square" : profile.wave;
      osc.frequency.setValueAtTime(profile.from * packScale, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, profile.to * packScale), now + duration);
      const peak = this.pack === "soft" ? 0.035 : this.pack === "punch" ? 0.14 : 0.075;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
      if (profile.pulses) {
        for (let i = 1; i <= profile.pulses; i++) {
          gain.gain.setValueAtTime(i % 2 ? peak * 0.18 : peak, now + (duration * i) / (profile.pulses + 1));
        }
      }
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.start(now);
      osc.stop(now + duration);
      return;
    }

    switch (type) {
      case 'none':
        return;
      case 'click':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;

      case 'hover':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        break;

      case 'success':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;

      case 'error':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;

      case 'open':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;

      case 'close':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;

      case 'pop':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
    }
  }
}

export const audioSystem = new AudioSystem();
