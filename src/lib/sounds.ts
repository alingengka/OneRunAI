/**
 * Sound effects the user places on the timeline from the sound library
 * (files in public/sfx). Clip times are on the source timeline, like
 * captions and stickers; the export maps them onto the cut video.
 */
import type { Segment } from "./media/audio";

export type SoundCategory = "click" | "notify" | "reward" | "wrong";

export type LibrarySound = {
  id: string;
  name: string;
  category: SoundCategory;
  /** seconds (from the file; the decoded length wins once loaded) */
  duration: number;
};

export const SOUND_CATEGORIES: { id: SoundCategory; label: string }[] = [
  { id: "click", label: "คลิก / ป๊อป" },
  { id: "notify", label: "แจ้งเตือน" },
  { id: "reward", label: "รางวัล / ถูกต้อง" },
  { id: "wrong", label: "ผิด" },
];

export const SOUND_LIBRARY: LibrarySound[] = [
  { id: "big-pop", name: "Big Pop", category: "click", duration: 1.489 },
  { id: "button-select", name: "Button Select", category: "click", duration: 1.28 },
  { id: "click-cartoon", name: "Cartoon Click", category: "click", duration: 0.444 },
  { id: "click", name: "Click", category: "click", duration: 0.653 },
  { id: "glitch-counter", name: "Glitch Counter", category: "click", duration: 0.993 },
  { id: "hud-scroll", name: "HUD Scroll", category: "click", duration: 0.627 },
  { id: "pop", name: "Pop", category: "click", duration: 0.34 },
  { id: "text-hard", name: "Text Hard", category: "click", duration: 0.444 },
  { id: "text-medium", name: "Text Medium", category: "click", duration: 1.28 },
  { id: "chimes", name: "Chimes", category: "notify", duration: 1.593 },
  { id: "hud-notify", name: "HUD Notification", category: "notify", duration: 0.731 },
  { id: "incoming", name: "Incoming", category: "notify", duration: 2.978 },
  { id: "magic-strum", name: "Magic Strum", category: "notify", duration: 3.109 },
  { id: "message", name: "Message", category: "notify", duration: 1.332 },
  { id: "pickup-chime", name: "Pickup Chime", category: "notify", duration: 1.489 },
  { id: "rising", name: "Rising", category: "notify", duration: 4.519 },
  { id: "rising-positive", name: "Rising Positive", category: "notify", duration: 2.299 },
  { id: "short-alert", name: "Short Alert", category: "notify", duration: 0.758 },
  { id: "soft-chime", name: "Soft Chime", category: "notify", duration: 2.534 },
  { id: "best", name: "Best", category: "reward", duration: 3.396 },
  { id: "best-2", name: "Best 2", category: "reward", duration: 1.515 },
  { id: "best-glass", name: "Best Glass", category: "reward", duration: 1.045 },
  { id: "count", name: "Count", category: "reward", duration: 5.799 },
  { id: "reward", name: "Reward", category: "reward", duration: 1.358 },
  { id: "reward-received", name: "Reward Received", category: "reward", duration: 1.646 },
  { id: "shiny", name: "Shiny", category: "reward", duration: 3.03 },
  { id: "wrong", name: "Wrong", category: "wrong", duration: 1.176 },
  { id: "wrong-1", name: "Wrong 1", category: "wrong", duration: 1.28 },
  { id: "wrong-2", name: "Wrong 2", category: "wrong", duration: 0.366 },
];

export type SoundClip = {
  id: string;
  /** library sound id */
  sound: string;
  /** source-timeline second the sound starts */
  start: number;
  /** seconds trimmed off the front of the sound */
  offset: number;
  /** seconds of the sound that play */
  duration: number;
  /** 0..2 (1 = as recorded) */
  volume: number;
};

export const soundById = (id: string) => SOUND_LIBRARY.find((s) => s.id === id);
export const soundUrl = (id: string) => `/sfx/${id}.mp3`;
export const soundName = (id: string) => soundById(id)?.name ?? id;

export function newSoundId() {
  return `snd-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** A new clip of a library sound starting at `start`, playing in full. */
export function makeSoundClip(sound: string, start: number): SoundClip {
  const lib = soundById(sound);
  return {
    id: newSoundId(),
    sound,
    start: Math.max(0, start),
    offset: 0,
    duration: lib?.duration ?? 1,
    volume: 1,
  };
}

/**
 * Moves or trims a clip to a new [start, end] on the timeline. Moving keeps
 * the length; dragging the front edge trims the start of the sound.
 */
export function retimeSoundClip(
  clip: SoundClip,
  start: number,
  end: number,
  soundLength = soundById(clip.sound)?.duration ?? clip.offset + clip.duration,
): SoundClip {
  const oldEnd = clip.start + clip.duration;
  const moved = Math.abs(end - start - clip.duration) < 1e-6;
  if (moved) return { ...clip, start: Math.max(0, start) };
  if (Math.abs(end - oldEnd) < 1e-6) {
    // front edge: trim (or un-trim) the head of the sound
    const offset = Math.max(0, Math.min(soundLength - 0.05, clip.offset + (start - clip.start)));
    const s = clip.start + (offset - clip.offset);
    return { ...clip, start: s, offset, duration: Math.max(0.05, oldEnd - s) };
  }
  // back edge: shorten or lengthen up to the end of the sound
  const duration = Math.max(0.05, Math.min(soundLength - clip.offset, end - clip.start));
  return { ...clip, duration };
}

/** Splits a clip at a source time; null when the time is not inside it. */
export function splitSoundClip(clip: SoundClip, at: number): [SoundClip, SoundClip] | null {
  const cut = at - clip.start;
  if (cut < 0.05 || cut > clip.duration - 0.05) return null;
  return [
    { ...clip, duration: cut },
    {
      ...clip,
      id: newSoundId(),
      start: at,
      offset: clip.offset + cut,
      duration: clip.duration - cut,
    },
  ];
}

/**
 * Where a clip starts on the output timeline (after cut scenes are removed),
 * or null when it starts inside a removed part.
 */
export function outputTimeOf(time: number, segments: Segment[]): number | null {
  let before = 0;
  for (const seg of segments) {
    if (time < seg.start - 1e-6) return null;
    if (time <= seg.end + 1e-6) return before + (time - seg.start);
    before += seg.end - seg.start;
  }
  return null;
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();
let decoder: BaseAudioContext | null = null;

/** Decoded audio of a library sound (cached; null when it cannot be loaded). */
export function loadSound(id: string): Promise<AudioBuffer | null> {
  let pending = buffers.get(id);
  if (!pending) {
    pending = fetch(soundUrl(id))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        // A small offline context decodes without needing a user gesture.
        decoder ??= new OfflineAudioContext(2, 1, 44100);
        return decoder.decodeAudioData(data);
      })
      .catch(() => {
        buffers.delete(id);
        return null;
      });
    buffers.set(id, pending);
  }
  return pending;
}

let shared: AudioContext | null = null;
/** The page's AudioContext for previews and playback (created on first use). */
export function soundContext(): AudioContext | null {
  if (shared) return shared;
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  shared = new Ctx();
  return shared;
}

let previewing: AudioBufferSourceNode | null = null;
/** Plays a library sound once (the ▶ in the library); a new preview stops the last. */
export async function previewSound(id: string, volume = 1): Promise<void> {
  const ctx = soundContext();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
  const buffer = await loadSound(id);
  if (!buffer) return;
  try {
    previewing?.stop();
  } catch {
    /* already ended */
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(ctx.destination);
  source.start();
  previewing = source;
}
