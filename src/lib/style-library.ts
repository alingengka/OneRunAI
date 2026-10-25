import type { CaptionStyle } from "./captions";
import { safeLocalStorage } from "@/lib/safe-storage";

const KEY = "shortcut-studio-style-library-v1";

export function loadCustomStyles(): CaptionStyle[] {
  try {
    const value = JSON.parse(safeLocalStorage().getItem(KEY) ?? "[]") as CaptionStyle[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function saveCustomStyle(style: CaptionStyle): CaptionStyle[] {
  const item = { ...style, id: `custom-${Date.now()}`, name: `${style.name} copy` };
  const next = [item, ...loadCustomStyles()].slice(0, 24);
  safeLocalStorage().setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeCustomStyle(id: string): CaptionStyle[] {
  const next = loadCustomStyles().filter((style) => style.id !== id);
  safeLocalStorage().setItem(KEY, JSON.stringify(next));
  return next;
}