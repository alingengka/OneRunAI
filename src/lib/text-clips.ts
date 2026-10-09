/**
 * Free text clips (CapCut "Add text") drawn by the caption engine, so they
 * get the same looks, highlight, karaoke and animations as captions, and the
 * export matches the preview.
 */
import {
  LINE_BREAK,
  tokenizeWords,
  type CaptionGroup,
  type CaptionStyle,
  type Word,
} from "./captions";
import { DEFAULT_TEXT_FONT, type Sticker } from "./media/stickers";

/** Words of a text spread evenly over [start, end]; "\n" becomes a line break. */
export function spreadWords(text: string, start: number, end: number): Word[] {
  const lines = text.split("\n");
  const pieces: string[] = [];
  lines.forEach((line, i) => {
    if (i) pieces.push(LINE_BREAK);
    pieces.push(...tokenizeWords(line));
  });
  const spoken = pieces.filter((p) => p !== LINE_BREAK);
  if (!spoken.length) return [{ text: text || " ", start, end }];
  const step = Math.max(0.01, (end - start) / spoken.length);
  let t = start;
  return pieces.map((piece) => {
    if (piece === LINE_BREAK) return { text: LINE_BREAK, start: t, end: t };
    const word = { text: piece, start: t, end: Math.min(end, t + step) };
    t += step;
    return word;
  });
}

/** The look of a text clip: its own settings, with older sticker fields mapped in. */
export function textClipStyle(sticker: Sticker): Partial<CaptionStyle> {
  const legacy: Partial<CaptionStyle> = {
    posX: sticker.x,
    posY: sticker.y,
    size: sticker.size,
    rotation: sticker.rotation,
  };
  if (!sticker.style) {
    // Text made before text clips used the caption engine.
    legacy.color = sticker.color ?? "#ffffff";
    legacy.fontFamily = sticker.font || DEFAULT_TEXT_FONT;
    legacy.stroke = sticker.stroke ? "medium" : "none";
    if (sticker.stroke) legacy.strokeColor = sticker.stroke;
    legacy.plate = !!sticker.background;
    if (sticker.background) {
      legacy.plateColor = sticker.background;
      legacy.plateOpacity = 1;
    }
    if (sticker.opacity != null) legacy.opacity = sticker.opacity;
    legacy.highlight = "none";
    legacy.animation = "none";
    legacy.captionMode = "sentence";
  }
  return { ...legacy, ...sticker.style };
}

const groupCache = new WeakMap<Sticker, CaptionGroup>();

/** A text clip as a caption group the renderers understand (free: may overlap). */
export function textClipGroup(sticker: Sticker): CaptionGroup {
  const cached = groupCache.get(sticker);
  if (cached) return cached;
  const group: CaptionGroup = {
    id: sticker.id,
    start: sticker.start,
    end: sticker.end,
    words: sticker.words?.length
      ? sticker.words
      : spreadWords(sticker.asset, sticker.start, sticker.end),
    style: textClipStyle(sticker),
    free: true,
  };
  groupCache.set(sticker, group);
  return group;
}

/** Shifts word timings so they keep their place inside a clip that moved or was resized. */
export function retimeWords(
  words: Word[],
  from: { start: number; end: number },
  to: { start: number; end: number },
): Word[] {
  const span = Math.max(0.001, from.end - from.start);
  const scale = (to.end - to.start) / span;
  const map = (t: number) => to.start + (t - from.start) * scale;
  return words.map((w) => ({ ...w, start: map(w.start), end: map(w.end) }));
}

/** Merged look used to draw a clip. */
export function mergedStyle(base: CaptionStyle, group: CaptionGroup | null | undefined) {
  return group?.style ? { ...base, ...group.style } : base;
}
