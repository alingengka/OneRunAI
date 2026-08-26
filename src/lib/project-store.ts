import type { Segment } from "./media/audio";
import type { CaptionStyle, Word } from "./captions";
import type { SoundPack } from "./audio-system";

const KEY = "shortcut-studio-project-v1";

export type SavedProject = {
  savedAt: number;
  fileName: string;
  duration: number;
  segments: Segment[];
  words: Word[];
  transcript: string;
  glossary?: string;
  style: CaptionStyle;
  languages: string[];
  threshold: number;
  minSilence: number;
  noiseReduction?: boolean;
  dropped?: string[];
  sfx?: { enabled: boolean; volume: number; pack: SoundPack };
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
