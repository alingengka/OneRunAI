import type { Segment } from "./media/audio";

export type Word = { text: string; start: number; end: number };
export type CaptionGroup = { start: number; end: number; words: Word[] };

export type StrokeSize = "none" | "small" | "medium" | "large";

export type CaptionStyle = {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  uppercase: boolean;
  /** font size in % of video height */
  size: number;
  color: string;
  stroke: StrokeSize;
  strokeColor: string;
  shadow: StrokeSize;
  shadowColor: string;
  highlight: "none" | "color" | "box";
  highlightColor: string;
  highlightTextColor: string;
  /** vertical position in % from top */
  posY: number;
  posX: number;
  wordsPerGroup: number;
  animation: boolean;
  uppercaseKeywords?: boolean;
};

export const baseStyle: CaptionStyle = {
  id: "kelly",
  name: "Kelly",
  fontFamily: "'Archivo Black', system-ui, sans-serif",
  fontWeight: 900,
  uppercase: false,
  size: 6.4,
  color: "#ffffff",
  stroke: "none",
  strokeColor: "#000000",
  shadow: "small",
  shadowColor: "#000000",
  highlight: "color",
  highlightColor: "#ffd400",
  highlightTextColor: "#111111",
  posY: 68,
  posX: 50,
  wordsPerGroup: 3,
  animation: true,
};

export const stylePresets: CaptionStyle[] = [
  { ...baseStyle },
  {
    ...baseStyle,
    id: "hormozi",
    name: "HORMOZI",
    uppercase: true,
    size: 7.2,
    stroke: "medium",
    highlight: "box",
    highlightColor: "#22c55e",
    highlightTextColor: "#0b0b0b",
  },
  {
    ...baseStyle,
    id: "beast",
    name: "BEAST",
    uppercase: true,
    size: 7.6,
    color: "#ffffff",
    stroke: "large",
    shadow: "large",
    highlight: "color",
    highlightColor: "#ff4d1c",
    wordsPerGroup: 1,
  },
  {
    ...baseStyle,
    id: "karl",
    name: "Karl",
    uppercase: false,
    size: 5.6,
    stroke: "small",
    highlight: "none",
    wordsPerGroup: 4,
  },
  {
    ...baseStyle,
    id: "laura",
    name: "Laura",
    highlight: "box",
    highlightColor: "#fde047",
    highlightTextColor: "#111111",
    stroke: "none",
    shadow: "none",
    wordsPerGroup: 2,
  },
  {
    ...baseStyle,
    id: "kendrick",
    name: "Kendrick",
    uppercase: false,
    highlight: "box",
    highlightColor: "#22ff88",
    highlightTextColor: "#06210f",
    stroke: "small",
    wordsPerGroup: 3,
  },
  {
    ...baseStyle,
    id: "leon",
    name: "LEON",
    uppercase: true,
    highlight: "box",
    highlightColor: "#ff5a1f",
    highlightTextColor: "#ffffff",
    size: 6.8,
    wordsPerGroup: 2,
  },
  {
    ...baseStyle,
    id: "molly",
    name: "Molly",
    color: "#111111",
    highlight: "box",
    highlightColor: "#ffffff",
    highlightTextColor: "#111111",
    stroke: "none",
    shadow: "small",
    fontWeight: 800,
    size: 5.8,
  },
  {
    ...baseStyle,
    id: "jess",
    name: "JESS",
    uppercase: true,
    color: "#ff8a00",
    stroke: "medium",
    highlight: "color",
    highlightColor: "#ffffff",
    wordsPerGroup: 2,
  },
  {
    ...baseStyle,
    id: "iman",
    name: "Iman",
    uppercase: false,
    color: "#e7e7e7",
    stroke: "none",
    shadow: "medium",
    highlight: "none",
    size: 5.2,
    wordsPerGroup: 5,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 700,
  },
  {
    ...baseStyle,
    id: "noah",
    name: "NOAH",
    uppercase: true,
    fontFamily: "'Bebas Neue', Impact, sans-serif",
    fontWeight: 400,
    size: 8.4,
    highlight: "color",
    highlightColor: "#ff2d55",
    stroke: "small",
    wordsPerGroup: 3,
  },
  {
    ...baseStyle,
    id: "maya",
    name: "Maya",
    color: "#ffb703",
    fontFamily: "'Playfair Display', Georgia, serif",
    fontWeight: 900,
    uppercase: false,
    highlight: "none",
    stroke: "none",
    shadow: "medium",
    size: 6,
    wordsPerGroup: 4,
  },
];

export const strokeWidth: Record<StrokeSize, number> = {
  none: 0,
  small: 2,
  medium: 5,
  large: 9,
};

export const shadowBlur: Record<StrokeSize, number> = {
  none: 0,
  small: 6,
  medium: 14,
  large: 26,
};

const STOPWORDS = new Set([
  "the","a","an","and","or","but","to","of","in","on","at","is","are","was","were","be","it","this","that","for","with","as","you","your","i","we","they","he","she","from","by","so","if","not","do","does","did","will","just","can",
]);

export function isKeyword(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z0-9\u0e00-\u0e7f]/gi, "");
  return w.length > 3 && !STOPWORDS.has(w);
}

/** Spread transcript words across detected speech segments, weighted by word length. */
export function alignWordsToSegments(text: string, segments: Segment[], duration: number): Word[] {
  const tokens = text.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return [];
  const segs = segments.length ? segments : [{ start: 0, end: duration }];
  const totalSpeech = segs.reduce((sum, s) => sum + (s.end - s.start), 0);
  const totalChars = tokens.reduce((sum, t) => sum + t.length + 1, 0);

  const words: Word[] = [];
  let segIndex = 0;
  let cursor = segs[0]?.start ?? 0;

  for (const token of tokens) {
    let need = ((token.length + 1) / totalChars) * totalSpeech;
    const start = cursor;
    while (need > 0 && segIndex < segs.length) {
      const seg = segs[segIndex]!;
      const available = seg.end - cursor;
      if (available > need) {
        cursor += need;
        need = 0;
      } else {
        need -= Math.max(0, available);
        segIndex += 1;
        cursor = segs[segIndex]?.start ?? seg.end;
      }
    }
    words.push({ text: token, start, end: Math.max(start + 0.08, cursor) });
  }
  return words;
}

export function groupWords(words: Word[], perGroup: number): CaptionGroup[] {
  const size = Math.max(1, Math.min(8, Math.round(perGroup)));
  const groups: CaptionGroup[] = [];
  for (let i = 0; i < words.length; i += size) {
    const slice = words.slice(i, i + size);
    if (!slice.length) continue;
    groups.push({
      start: slice[0]!.start,
      end: slice[slice.length - 1]!.end,
      words: slice,
    });
  }
  return groups;
}
