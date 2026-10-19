/**
 * Sound effects the user places on the timeline from the sound library
 * (files in public/sfx, loudness-matched: loudest 100 ms at about -14 dBFS
 * RMS, peaks limited to -3 dBFS, so no sound is far quieter than another).
 * Clip times are on the source timeline, like captions and stickers; the
 * export maps them onto the cut video.
 */
import type { Segment } from "./media/audio";

export type SoundCategory =
  "click" | "pop" | "whoosh" | "notify" | "typing" | "reward" | "wrong" | "scifi" | "other";

export type LibrarySound = {
  id: string;
  name: string;
  category: SoundCategory;
  /** seconds (from the file; the decoded length wins once loaded) */
  duration: number;
};

export const SOUND_CATEGORIES: { id: SoundCategory; label: string }[] = [
  { id: "click", label: "คลิก / ปุ่ม" },
  { id: "pop", label: "ป๊อป / ฟอง" },
  { id: "whoosh", label: "วูช / เปลี่ยนฉาก" },
  { id: "notify", label: "แจ้งเตือน" },
  { id: "typing", label: "พิมพ์ / ข้อความ" },
  { id: "reward", label: "รางวัล / ถูกต้อง" },
  { id: "wrong", label: "ผิด" },
  { id: "scifi", label: "ไซไฟ / ดิจิทัล" },
  { id: "other", label: "อื่น ๆ" },
];

export const SOUND_LIBRARY: LibrarySound[] = [
  { id: "big-pop", name: "Big Pop", category: "pop", duration: 1.489 },
  { id: "button-select", name: "Button Select", category: "click", duration: 1.28 },
  { id: "click-cartoon", name: "Cartoon Click", category: "click", duration: 0.444 },
  { id: "click", name: "Click", category: "click", duration: 0.653 },
  { id: "glitch-counter", name: "Glitch Counter", category: "click", duration: 0.993 },
  { id: "hud-scroll", name: "HUD Scroll", category: "click", duration: 0.627 },
  { id: "pop", name: "Pop", category: "pop", duration: 0.34 },
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
  // second set (OneRun SPX)
  { id: "x-button", name: "Button", category: "click", duration: 0.261 },
  { id: "x-button-click", name: "Button Click", category: "click", duration: 0.078 },
  {
    id: "x-computer-mouse-click",
    name: "Computer Mouse Click",
    category: "click",
    duration: 0.235,
  },
  { id: "x-ipad-click", name: "iPad Click", category: "click", duration: 0.235 },
  { id: "x-mouse-click", name: "Mouse Click", category: "click", duration: 0.235 },
  { id: "x-tiktok-click", name: "TikTok Click", category: "click", duration: 0.261 },
  { id: "x-ui-click-1", name: "UI Click 1", category: "click", duration: 0.366 },
  { id: "x-ui-click-2", name: "UI Click 2", category: "click", duration: 0.522 },
  { id: "x-ui-click-3", name: "UI Click 3", category: "click", duration: 0.34 },
  { id: "x-ui-click-4", name: "UI Click 4", category: "click", duration: 1.28 },
  { id: "x-ui-click-5", name: "UI Click 5", category: "click", duration: 0.888 },
  { id: "x-ui-click-6", name: "UI Click 6", category: "click", duration: 0.601 },
  { id: "x-ui-click-7", name: "UI Click 7", category: "click", duration: 1.123 },
  { id: "x-ui-click-8", name: "UI Click 8", category: "click", duration: 0.131 },
  { id: "x-ui-click-10", name: "UI Click 10", category: "click", duration: 0.914 },
  { id: "x-ui-click-11", name: "UI Click 11", category: "click", duration: 0.366 },
  { id: "x-ui-click-12", name: "UI Click 12", category: "click", duration: 0.627 },
  { id: "x-ui-click-13", name: "UI Click 13", category: "click", duration: 0.705 },
  { id: "x-ui-click-14", name: "UI Click 14", category: "click", duration: 0.366 },
  { id: "x-bubble", name: "Bubble", category: "pop", duration: 0.575 },
  { id: "x-bubble-pop", name: "Bubble Pop", category: "pop", duration: 0.104 },
  { id: "x-bubble-pops", name: "Bubble Pops", category: "pop", duration: 6.975 },
  { id: "x-marimba-1", name: "Marimba 1", category: "pop", duration: 1.698 },
  { id: "x-marimba-2", name: "Marimba 2", category: "pop", duration: 1.541 },
  { id: "x-minimal-pop", name: "Minimal Pop", category: "pop", duration: 0.993 },
  { id: "x-multi-pop", name: "Multi Pop", category: "pop", duration: 0.235 },
  { id: "x-plop", name: "Plop", category: "pop", duration: 0.34 },
  { id: "x-pop-1", name: "Pop 1", category: "pop", duration: 0.575 },
  { id: "x-pop-2", name: "Pop 2", category: "pop", duration: 0.313 },
  { id: "x-pop-3", name: "Pop 3", category: "pop", duration: 0.183 },
  { id: "x-pop-4", name: "Pop 4", category: "pop", duration: 0.157 },
  { id: "x-sharp-pop", name: "Sharp Pop", category: "pop", duration: 0.131 },
  { id: "x-simple-pop-noise", name: "Simple Pop Noise", category: "pop", duration: 0.575 },
  { id: "x-soft-pop", name: "Soft Pop", category: "pop", duration: 0.183 },
  { id: "x-soft-pop-click", name: "Soft Pop Click", category: "pop", duration: 3.892 },
  { id: "x-subtle-pop", name: "Subtle Pop", category: "pop", duration: 0.575 },
  { id: "x-ui-pop", name: "UI Pop", category: "pop", duration: 0.131 },
  { id: "x-appear", name: "Appear", category: "whoosh", duration: 2.769 },
  { id: "x-double-swish", name: "Double Swish", category: "whoosh", duration: 1.933 },
  { id: "x-flipcard", name: "Flipcard", category: "whoosh", duration: 0.81 },
  { id: "x-glitch-transition", name: "Glitch Transition", category: "whoosh", duration: 2.325 },
  { id: "x-simple-whoosh-1", name: "Simple Whoosh 1", category: "whoosh", duration: 3.5 },
  { id: "x-simple-whoosh-2", name: "Simple Whoosh 2", category: "whoosh", duration: 0.418 },
  { id: "x-spin", name: "Spin", category: "whoosh", duration: 3.579 },
  { id: "x-swoosh-1", name: "Swoosh 1", category: "whoosh", duration: 1.071 },
  { id: "x-swoosh-2", name: "Swoosh 2", category: "whoosh", duration: 0.81 },
  { id: "x-swoosh-3", name: "Swoosh 3", category: "whoosh", duration: 0.862 },
  { id: "x-swoosh-4", name: "Swoosh 4", category: "whoosh", duration: 0.993 },
  { id: "x-swoosh-5", name: "Swoosh 5", category: "whoosh", duration: 1.097 },
  { id: "x-swoosh-6", name: "Swoosh 6", category: "whoosh", duration: 0.94 },
  { id: "x-swoosh-fight", name: "Swoosh Fight", category: "whoosh", duration: 0.34 },
  { id: "x-whoosh-arrow-start", name: "Whoosh Arrow Start", category: "whoosh", duration: 1.802 },
  { id: "x-whoosh-end", name: "Whoosh End", category: "whoosh", duration: 1.384 },
  { id: "x-whoosh-velocity", name: "Whoosh Velocity", category: "whoosh", duration: 1.698 },
  { id: "x-woosh", name: "Woosh", category: "whoosh", duration: 1.045 },
  { id: "x-bright-notification", name: "Bright Notification", category: "notify", duration: 0.862 },
  { id: "x-happy-message-ping", name: "Happy Message Ping", category: "notify", duration: 0.784 },
  { id: "x-message-sent", name: "Message Sent", category: "notify", duration: 0.444 },
  { id: "x-notification-1", name: "Notification 1", category: "notify", duration: 0.496 },
  { id: "x-notification-2", name: "Notification 2", category: "notify", duration: 0.34 },
  { id: "x-notification-3", name: "Notification 3", category: "notify", duration: 0.81 },
  { id: "x-notification-4", name: "Notification 4", category: "notify", duration: 0.81 },
  { id: "x-notification-5", name: "Notification 5", category: "notify", duration: 0.784 },
  { id: "x-phone-alert", name: "Phone Alert", category: "notify", duration: 0.418 },
  { id: "x-pluck", name: "Pluck", category: "notify", duration: 0.496 },
  { id: "x-pop-up", name: "Pop-up", category: "notify", duration: 0.209 },
  { id: "x-pop-up-notify", name: "Pop-up Notify", category: "notify", duration: 1.881 },
  { id: "x-sonar-ping", name: "Sonar Ping", category: "notify", duration: 1.907 },
  { id: "x-digital-text", name: "Digital Text", category: "typing", duration: 1.358 },
  { id: "x-iphone-keyboard", name: "iPhone Keyboard", category: "typing", duration: 21.107 },
  {
    id: "x-keyboard-typing-fast",
    name: "Keyboard Typing Fast",
    category: "typing",
    duration: 8.072,
  },
  { id: "x-phone-typing", name: "Phone Typing", category: "typing", duration: 23.876 },
  { id: "x-text-beep", name: "Text Beep", category: "typing", duration: 16.457 },
  { id: "x-accept", name: "Accept", category: "reward", duration: 2.011 },
  { id: "x-confirm-tap", name: "Confirm Tap", category: "reward", duration: 1.097 },
  { id: "x-game-start", name: "Game Start", category: "reward", duration: 0.784 },
  { id: "x-shine-1", name: "Shine 1", category: "reward", duration: 3.213 },
  { id: "x-shine-2", name: "Shine 2", category: "reward", duration: 1.724 },
  { id: "x-success", name: "Success", category: "reward", duration: 3.344 },
  { id: "x-error", name: "Error", category: "wrong", duration: 0.784 },
  { id: "x-data-processing", name: "Data Processing", category: "scifi", duration: 11.416 },
  { id: "x-sci-fi-1", name: "Sci-Fi 1", category: "scifi", duration: 0.366 },
  { id: "x-sci-fi-2", name: "Sci-Fi 2", category: "scifi", duration: 0.575 },
  { id: "x-sci-fi-3", name: "Sci-Fi 3", category: "scifi", duration: 0.627 },
  { id: "x-sci-fi-4", name: "Sci-Fi 4", category: "scifi", duration: 0.444 },
  { id: "x-sci-fi-5", name: "Sci-Fi 5", category: "scifi", duration: 0.34 },
  { id: "x-sci-fi-6", name: "Sci-Fi 6", category: "scifi", duration: 1.306 },
  { id: "x-flowing-water", name: "Flowing Water", category: "other", duration: 15.882 },
  { id: "x-rope-creak", name: "Rope Creak", category: "other", duration: 1.176 },
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
/** Stops the library preview that is playing, if any. */
export function stopPreview(): void {
  try {
    previewing?.stop();
  } catch {
    /* already ended */
  }
  previewing = null;
}
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
