import type { Segment } from "./media/audio";

export type WordConfidence = "high" | "review" | "low";

export type Word = {
  text: string;
  start: number;
  end: number;
  /** 0–1 evidence score from transcript agreement and acoustic boundary fit. */
  confidence?: number;
  confidenceLabel?: WordConfidence;
};
export type CaptionGroup = { start: number; end: number; words: Word[] };

export type StrokeSize = "none" | "small" | "medium" | "large";

export type CaptionAnimation =
  | "none"
  | "pop"
  | "fade"
  | "slideUp"
  | "typewriter"
  | "bounce"
  | "zoom"
  | "karaoke"
  | "shake"
  | "flip";

export const animationOptions: { label: string; value: CaptionAnimation }[] = [
  { label: "None", value: "none" },
  { label: "Pop", value: "pop" },
  { label: "Fade", value: "fade" },
  { label: "Slide up", value: "slideUp" },
  { label: "Typewriter", value: "typewriter" },
  { label: "Bounce", value: "bounce" },
  { label: "Zoom", value: "zoom" },
  { label: "Karaoke", value: "karaoke" },
  { label: "Shake", value: "shake" },
  { label: "Flip", value: "flip" },
];

export type FontOption = { label: string; value: string; scripts: ("latin" | "th" | "lo")[] };

export const fontOptions: FontOption[] = [
  { label: "Archivo Black", value: "'Archivo Black', system-ui, sans-serif", scripts: ["latin"] },
  { label: "Inter", value: "'Inter', system-ui, sans-serif", scripts: ["latin"] },
  { label: "Bebas Neue", value: "'Bebas Neue', Impact, sans-serif", scripts: ["latin"] },
  { label: "Playfair Display", value: "'Playfair Display', Georgia, serif", scripts: ["latin"] },
  { label: "Anton", value: "'Anton', Impact, sans-serif", scripts: ["latin"] },
  { label: "Kanit (ไทย)", value: "'Kanit', 'Noto Sans Thai', sans-serif", scripts: ["th", "latin"] },
  { label: "Mitr (ไทย)", value: "'Mitr', 'Noto Sans Thai', sans-serif", scripts: ["th", "latin"] },
  { label: "Prompt (ไทย)", value: "'Prompt', 'Noto Sans Thai', sans-serif", scripts: ["th", "latin"] },
  { label: "Bai Jamjuree (ไทย)", value: "'Bai Jamjuree', 'Noto Sans Thai', sans-serif", scripts: ["th", "latin"] },
  { label: "Noto Serif Thai", value: "'Noto Serif Thai', serif", scripts: ["th"] },
  { label: "Noto Sans Lao (ລາວ)", value: "'Noto Sans Lao', 'Noto Sans Thai', sans-serif", scripts: ["lo", "th"] },
  { label: "Noto Sans Lao Looped", value: "'Noto Sans Lao Looped', 'Noto Sans Lao', sans-serif", scripts: ["lo"] },
  { label: "Noto Serif Lao", value: "'Noto Serif Lao', serif", scripts: ["lo"] },
  {
    label: "Universal (ไทย/ລາວ/EN)",
    value: "'Noto Sans Thai', 'Noto Sans Lao', 'Inter', sans-serif",
    scripts: ["th", "lo", "latin"],
  },
];

/** สไตล์เฉพาะรายบรรทัด (override สไตล์หลัก) */
export type LineStyle = {
  fontFamily?: string;
  color?: string;
  stroke?: StrokeSize;
  strokeColor?: string;
  fontWeight?: number;
  /** ระยะห่างจากบรรทัดก่อนหน้า (เท่าของขนาดฟอนต์) */
  gap?: number;
};

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
  /** words per rendered line (0 = all on one line) */
  wordsPerLine: number;
  textAlign: "left" | "center" | "right";
  animation: CaptionAnimation;
  /** animation speed multiplier (higher = faster) */
  animationSpeed: number;
  /** background plate behind the whole caption line */
  plate: boolean;
  plateColor: string;
  /** ระยะห่างระหว่างบรรทัด (เท่าของขนาดฟอนต์) */
  lineGap?: number;
  /** สไตล์เฉพาะบรรทัดที่ 1,2,3… (index เริ่มที่ 0) */
  lineStyles?: Record<number, LineStyle>;
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
  wordsPerLine: 0,
  textAlign: "center",
  animation: "pop",
  animationSpeed: 1,
  plate: false,
  plateColor: "#000000",
  lineGap: 0.08,
  lineStyles: {},
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
    animation: "bounce",
  },
  {
    ...baseStyle,
    id: "beast",
    name: "BEAST",
    uppercase: true,
    size: 7.6,
    stroke: "large",
    shadow: "large",
    highlight: "color",
    highlightColor: "#ff4d1c",
    wordsPerGroup: 1,
    animation: "zoom",
  },
  {
    ...baseStyle,
    id: "karl",
    name: "Karl",
    size: 5.6,
    stroke: "small",
    highlight: "none",
    wordsPerGroup: 4,
    animation: "fade",
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
    animation: "slideUp",
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 800,
  },
  {
    ...baseStyle,
    id: "kendrick",
    name: "Kendrick",
    highlight: "box",
    highlightColor: "#22ff88",
    highlightTextColor: "#06210f",
    stroke: "small",
    wordsPerGroup: 3,
    animation: "karaoke",
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
    animation: "flip",
    fontFamily: "'Anton', Impact, sans-serif",
    fontWeight: 400,
  },
  {
    ...baseStyle,
    id: "molly",
    name: "Molly",
    color: "#111111",
    highlight: "none",
    stroke: "none",
    shadow: "none",
    fontWeight: 800,
    size: 5.6,
    plate: true,
    plateColor: "#ffffff",
    animation: "fade",
    fontFamily: "'Inter', system-ui, sans-serif",
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
    animation: "shake",
  },
  {
    ...baseStyle,
    id: "iman",
    name: "Iman",
    color: "#e7e7e7",
    stroke: "none",
    shadow: "medium",
    highlight: "none",
    size: 5.2,
    wordsPerGroup: 5,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 700,
    animation: "typewriter",
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
    animation: "slideUp",
  },
  {
    ...baseStyle,
    id: "maya",
    name: "Maya",
    color: "#ffb703",
    fontFamily: "'Playfair Display', Georgia, serif",
    fontWeight: 900,
    highlight: "none",
    stroke: "none",
    shadow: "medium",
    size: 6,
    wordsPerGroup: 4,
    animation: "fade",
  },
  {
    ...baseStyle,
    id: "siam",
    name: "สยาม",
    fontFamily: "'Kanit', 'Noto Sans Thai', sans-serif",
    fontWeight: 700,
    color: "#ffffff",
    stroke: "medium",
    strokeColor: "#101010",
    highlight: "color",
    highlightColor: "#00e5ff",
    size: 6.2,
    wordsPerGroup: 3,
    animation: "karaoke",
  },
  {
    ...baseStyle,
    id: "bangkok",
    name: "บางกอก",
    fontFamily: "'Mitr', 'Noto Sans Thai', sans-serif",
    fontWeight: 600,
    color: "#111111",
    stroke: "none",
    shadow: "none",
    highlight: "box",
    highlightColor: "#ff4d8d",
    highlightTextColor: "#ffffff",
    plate: true,
    plateColor: "#ffffff",
    size: 5.6,
    wordsPerGroup: 2,
    animation: "pop",
  },
  {
    ...baseStyle,
    id: "lanxang",
    name: "ລ້ານຊ້າງ",
    fontFamily: "'Noto Sans Lao Looped', 'Noto Sans Lao', sans-serif",
    fontWeight: 700,
    color: "#ffd166",
    stroke: "medium",
    strokeColor: "#1b1b1b",
    shadow: "medium",
    highlight: "color",
    highlightColor: "#ffffff",
    size: 6.4,
    wordsPerGroup: 3,
    animation: "bounce",
  },
  {
    ...baseStyle,
    id: "mekong",
    name: "ແມ່ຂອງ",
    fontFamily: "'Noto Serif Lao', serif",
    fontWeight: 700,
    color: "#ffffff",
    stroke: "none",
    shadow: "large",
    highlight: "box",
    highlightColor: "#3b82f6",
    highlightTextColor: "#ffffff",
    size: 5.8,
    wordsPerGroup: 4,
    animation: "slideUp",
  },
  {
    ...baseStyle,
    id: "neon",
    name: "NEON",
    uppercase: true,
    fontFamily: "'Anton', Impact, sans-serif",
    fontWeight: 400,
    color: "#f5f3ff",
    stroke: "none",
    shadow: "large",
    shadowColor: "#a855f7",
    highlight: "color",
    highlightColor: "#a855f7",
    size: 7.4,
    wordsPerGroup: 1,
    animation: "zoom",
  },
  {
    ...baseStyle,
    id: "minimal",
    name: "Minimal",
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: 600,
    color: "#ffffff",
    stroke: "none",
    shadow: "small",
    highlight: "none",
    size: 4.6,
    wordsPerGroup: 6,
    posY: 82,
    animation: "fade",
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
  const w = word.toLowerCase().replace(/[^a-z0-9\u0e00-\u0eff]/gi, "");
  return w.length > 3 && !STOPWORDS.has(w);
}

const THAI_LAO = /[\u0e00-\u0eff]/;

/**
 * Split text into words. Thai/Lao are written without spaces, so we use
 * Intl.Segmenter word segmentation for those scripts (fallback: fixed chunks).
 */
export function tokenizeWords(text: string): string[] {
  const out: string[] = [];
  const SegmenterCtor = (Intl as unknown as { Segmenter?: any }).Segmenter;
  for (const chunk of text.split(/\s+/).map((t) => t.trim()).filter(Boolean)) {
    if (!THAI_LAO.test(chunk)) {
      out.push(chunk);
      continue;
    }
    const locale = /[\u0e80-\u0eff]/.test(chunk) ? "lo" : "th";
    if (SegmenterCtor) {
      try {
        const seg = new SegmenterCtor(locale, { granularity: "word" });
        for (const part of seg.segment(chunk) as Iterable<{ segment: string }>) {
          const w = part.segment.trim();
          if (w) out.push(w);
        }
        continue;
      } catch {
        /* fall through */
      }
    }
    for (let i = 0; i < chunk.length; i += 4) out.push(chunk.slice(i, i + 4));
  }
  return out;
}

/** Rough spoken-duration weight of a token (syllable-ish), so subs match speech better. */
export function speechWeight(token: string): number {
  if (THAI_LAO.test(token)) {
    // Thai/Lao: count consonants (vowel marks/tone marks are non-spacing)
    const consonants = token.replace(/[\u0e30-\u0e3a\u0e47-\u0e4e\u0eb0-\u0ebc\u0ec8-\u0ecd]/g, "");
    return Math.max(1, consonants.length * 0.75);
  }
  const vowels = token.toLowerCase().match(/[aeiouy]+/g)?.length ?? 0;
  const syllables = Math.max(1, vowels);
  return syllables + token.length * 0.15;
}

/** Spread transcript words across detected speech segments, weighted by spoken length. */
export function alignWordsToSegments(text: string, segments: Segment[], duration: number): Word[] {
  const tokens = tokenizeWords(text);
  if (tokens.length === 0) return [];
  const segs = segments.length ? segments : [{ start: 0, end: duration }];
  const totalSpeech = segs.reduce((sum, s) => sum + (s.end - s.start), 0);
  const weights = tokens.map(speechWeight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

  const words: Word[] = [];
  let segIndex = 0;
  let cursor = segs[0]?.start ?? 0;

  tokens.forEach((token, i) => {
    let need = (weights[i]! / totalWeight) * totalSpeech;
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
  });
  return words;
}


/** Zero-length token that forces a manual line break inside a caption group. */
export const LINE_BREAK = "\u2028";

export function groupWords(words: Word[], perGroup: number): CaptionGroup[] {
  const size = Math.max(1, Math.min(8, Math.round(perGroup)));
  const groups: CaptionGroup[] = [];
  let current: Word[] = [];
  let counted = 0;

  const flush = () => {
    const visible = current.filter((w) => w.text !== LINE_BREAK);
    if (visible.length) {
      groups.push({
        start: visible[0]!.start,
        end: visible[visible.length - 1]!.end,
        words: [...current],
      });
    }
    current = [];
    counted = 0;
  };

  for (const word of words) {
    current.push(word);
    if (word.text === LINE_BREAK) continue;
    counted++;
    if (counted >= size) flush();
  }
  flush();
  return groups;
}

