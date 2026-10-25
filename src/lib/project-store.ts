import type { Segment } from "./media/audio";
import type { CaptionStyle, Word } from "./captions";
import type { SoundClip } from "./sounds";
import type { SceneElement } from "./scenes";
import type { LexRule } from "./lao-glossary";
import type { Sticker } from "./media/stickers";
import { safeLocalStorage } from "@/lib/safe-storage";

const KEY = "shortcut-studio-project-v1";

export type SavedProject = {
  savedAt: number;
  fileName: string;
  duration: number;
  segments: Segment[];
  words: Word[];
  transcript: string;
  glossary?: string;
  lexRules?: LexRule[];
  style: CaptionStyle;
  languages: string[];
  threshold: number;
  minSilence: number;
  dropped?: string[];
  sceneElements?: SceneElement[];
  stickers?: Sticker[];
  splitPoints?: number[];
  /** CapCut-style video cuts and deleted pieces */
  videoEdit?: { cuts: number[]; removed: { start: number; end: number }[] } | null;
  projectName?: string;
  /** sound effects placed from the sound library */
  sounds?: SoundClip[];
  /** caption lines' own looks, by clip id */
  clipStyles?: Record<string, Partial<CaptionStyle>>;
  /** bilingual subtitles: translation per caption clip id */
  subtitles?: {
    lang: string;
    lines: Record<string, { text: string; source: string }>;
  } | null;
};

export function saveProject(p: Omit<SavedProject, "savedAt">): void {
  try {
    safeLocalStorage().setItem(KEY, JSON.stringify({ ...p, savedAt: Date.now() }));
  } catch {
    /* quota or private mode — ignore */
  }
}

export function loadProject(): SavedProject | null {
  try {
    const raw = safeLocalStorage().getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedProject;
    if (!parsed || !Array.isArray(parsed.segments)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearProject(): void {
  try {
    safeLocalStorage().removeItem(KEY);
  } catch {
    /* ignore */
  }
}
