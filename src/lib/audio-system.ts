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
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx!.currentTime, 0.05);
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
      const frequencies: Record<string, [number, number]> = {
        fade: [360, 520], slideUp: [240, 720], typewriter: [900, 700], bounce: [180, 540],
        zoom: [160, 880], karaoke: [520, 660], shake: [140, 110], flip: [760, 260],
      };
      const [from, to] = frequencies[animationSound] ?? [600, 300];
      osc.type = this.pack === "digital" ? "square" : this.pack === "punch" ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(from * packScale, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, to * packScale), now + 0.14);
      gain.gain.setValueAtTime(this.pack === "soft" ? 0.045 : 0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.16);
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
