import type { Segment } from "./media/audio";
import type { CaptionStyle, Word } from "./captions";
import type { SoundClip } from "./sounds";
import type { SceneElement } from "./scenes";
import type { LexRule } from "./lao-glossary";
import type { Sticker } from "./media/stickers";

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
  projectName?: string;
  /** sound effects placed from the sound library */
  sounds?: SoundClip[];
  /** caption lines' own looks, by clip id */
  clipStyles?: Record<string, Partial<CaptionStyle>>;
};

export function saveProject(p: Omit<SavedProject, "savedAt">): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, savedAt: Date.now() }));
  } catch {
    /* quota or private mode — ignore */
  }
}

export function loadProject(): SavedProject | null {
  try {
    const raw = localStorage.getItem(KEY);
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
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
