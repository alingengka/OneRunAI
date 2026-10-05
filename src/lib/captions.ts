import type { Segment } from "./media/audio";

export type WordConfidence = "high" | "review" | "low";

export type Word = {
  text: string;
  start: number;
  end: number;
  /** 0–1 evidence score from transcript agreement and acoustic boundary fit. */
  confidence?: number;
  confidenceLabel?: WordConfidence;
  /** color picked for this word only (overrides the caption color) */
  color?: string | undefined;
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
  | "flip"
  | "slideUp2"
  | "glow"
  | "highlight"
  | "karaokePlus"
  | "karaoke2";

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
  { label: "สไลด์2", value: "slideUp2" },
  { label: "เรืองแสง", value: "glow" },
  { label: "ไฮไลต์", value: "highlight" },
  { label: "คาราโอเกะ+", value: "karaokePlus" },
  { label: "คาราโอเกะ2", value: "karaoke2" },
];

/** สีเรืองแสง/แถบไฮไลต์ตามธีม OneRunAI (ค่าเดียวกันทั้งพรีวิวและ export) */
export const ACCENT_PRIMARY_HEX = "#6d28d9";
export const ACCENT_SECONDARY_HEX = "#8b5cf6";

/**
 * อนิเมชันแต่ละแบบเหมาะกับโหมดไหน
 * word = ไล่ทีละคำ, sentence = ทั้งประโยคพร้อมกัน (บางแบบใช้ได้ทั้งคู่)
 */
export const animationModes: Record<CaptionAnimation, ("word" | "sentence")[]> = {
  none: ["word", "sentence"],
  pop: ["word", "sentence"],
  fade: ["word", "sentence"],
  slideUp: ["word", "sentence"],
  slideUp2: ["word", "sentence"],
  typewriter: ["word"],
  bounce: ["word", "sentence"],
  zoom: ["word", "sentence"],
  karaoke: ["word"],
  karaokePlus: ["word"],
  karaoke2: ["word"],
  shake: ["word", "sentence"],
  flip: ["word"],
  glow: ["word", "sentence"],
  highlight: ["word", "sentence"],
};


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
  // ฟอนต์ลาวที่เพิ่มเข้ามาเอง (ไฟล์อยู่ใน public/fonts)
  { label: "Lao Chalk (ລາວ)", value: "'Lao Chalk', 'Noto Sans Lao', sans-serif", scripts: ["lo"] },
  {
    label: "Lao Handwriting 16 (ລາວ)",
    value: "'Lao Handwriting 16', 'Noto Sans Lao', sans-serif",
    scripts: ["lo"],
  },
  { label: "PB Melon (ລາວ)", value: "'PB Melon', 'Noto Sans Lao', sans-serif", scripts: ["lo"] },
  {
    label: "PB Champasak (ລາວ)",
    value: "'PB Champasak', 'Noto Sans Lao', sans-serif",
    scripts: ["lo"],
  },
  { label: "Hinsiew (ລາວ)", value: "'Hinsiew', 'Noto Sans Lao', sans-serif", scripts: ["lo"] },
  { label: "Tiktok Lao (ລາວ)", value: "'Tiktok Lao', 'Noto Sans Lao', sans-serif", scripts: ["lo"] },
  { label: "Touk2 (ລາວ)", value: "'Touk2', 'Noto Sans Lao', sans-serif", scripts: ["lo"] },
];


/** สไตล์เฉพาะรายบรรทัด (override สไตล์หลัก) */
export type LineStyle = {
  fontFamily?: string;
  color?: string;
  stroke?: StrokeSize;
  strokeColor?: string;
  fontWeight?: number;
  /** ตัวหนาสังเคราะห์ (override สไตล์หลัก) */
  bold?: boolean | undefined;
  /** ตัวเอียงสังเคราะห์ (override สไตล์หลัก) */
  italic?: boolean | undefined;
  /** ระยะห่างจากบรรทัดก่อนหน้า (เท่าของขนาดฟอนต์) */
  gap?: number;
  /** size of this line relative to the caption size (1 = same) */
  scale?: number | undefined;
};

/** ตัวหนา/ตัวเอียงสังเคราะห์ — ใช้ได้กับทุกฟอนต์แม้ไฟล์ฟอนต์มีน้ำหนักเดียว */
export type TextEmphasis = { bold?: boolean | undefined; italic?: boolean | undefined };

/** องศาเอียง ~12.4° (ค่าลบ = เอนไปทางขวาแบบ italic ปกติ) */
export const ITALIC_SKEW = -0.22;

/** น้ำหนักฟอนต์ที่ใช้จริงเมื่อเปิดตัวหนา */
export function emphasizedWeight(weight: number, bold?: boolean): number {
  return bold ? Math.min(900, Math.max(700, weight + 200)) : weight;
}

/**
 * ฟอนต์ที่มี "ไฟล์" ตัวหนา/ตัวเอียงจริง (ไม่ต้องสังเคราะห์)
 * key = ชื่อ family ตัวแรกใน CSS font stack
 */
const REAL_FACES: Record<string, { bold: boolean; italic: boolean }> = {
  "PB Melon": { bold: true, italic: false },
  "PB Champasak": { bold: true, italic: true },
  Hinsiew: { bold: true, italic: true },
};

/** อ่านชื่อ family ตัวแรกจาก CSS font stack เช่น "'PB Melon', sans-serif" → PB Melon */
export function primaryFamily(fontFamily: string): string {
  return (fontFamily.split(",")[0] ?? "").trim().replace(/^["']|["']$/g, "");
}

/** ฟอนต์นี้มีไฟล์ตัวหนา/เอียงจริงไหม (ถ้ามี ให้ใช้ไฟล์จริงแทนการสังเคราะห์) */
export function fontRealFaces(fontFamily: string): { bold: boolean; italic: boolean } {
  return REAL_FACES[primaryFamily(fontFamily)] ?? { bold: false, italic: false };
}

/** แยกเป็น "ส่วนที่ฟอนต์จริงทำได้" กับ "ส่วนที่ต้องสังเคราะห์" */
export function splitEmphasis(
  fontFamily: string,
  em: TextEmphasis,
): { native: TextEmphasis; synthetic: TextEmphasis } {
  const real = fontRealFaces(fontFamily);
  return {
    native: { bold: !!em.bold && real.bold, italic: !!em.italic && real.italic },
    synthetic: { bold: !!em.bold && !real.bold, italic: !!em.italic && !real.italic },
  };
}


export type CaptionMode = "sentence" | "word" | "fixed";

export type CaptionStyle = {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  /** ตัวหนาสังเคราะห์ (ใช้ได้กับทุกฟอนต์) */
  bold?: boolean | undefined;
  /** ตัวเอียงสังเคราะห์ (ใช้ได้กับทุกฟอนต์) */
  italic?: boolean | undefined;
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
  /**
   * How words are grouped on screen: "sentence" shows a whole phrase (split
   * at pauses and punctuation), "word" one word at a time, "fixed" exactly
   * `wordsPerGroup` words. Older saved styles have no value; see captionModeOf.
   */
  captionMode?: CaptionMode | undefined;
  /** 2 = split each caption into two balanced lines (podcast style) */
  splitLines?: number | undefined;
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
  /**
   * Thai and Lao words sit together without spaces, as they are written
   * (default). false puts a gap between every word.
   */
  joinWords?: boolean | undefined;
  /** extra space between letters, in em */
  letterSpacing?: number | undefined;
  /** 0–1 opacity of the whole caption */
  opacity?: number | undefined;
  /** rotation of the caption block, in degrees */
  rotation?: number | undefined;
  /** 0–1 opacity of the background plate (default 0.9) */
  plateOpacity?: number | undefined;
  /** plate corner radius, in em (default 0.22) */
  plateRadius?: number | undefined;
  /** สไตล์เฉพาะบรรทัดที่ 1,2,3… (index เริ่มที่ 0) */
  lineStyles?: Record<number, LineStyle>;
};

export const baseStyle: CaptionStyle = {
  id: "kelly",
  name: "Kelly",
  fontFamily: "'Archivo Black', system-ui, sans-serif",
  fontWeight: 900,
  bold: false,
  italic: false,
  uppercase: false,

  size: 6.4,
  color: "#ffffff",
  stroke: "none",
  strokeColor: "#000000",
  shadow: "small",
  shadowColor: "#000000",
  highlight: "none",
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

export const sampleTextByLanguage: Record<string, string> = {
  lo: "ຕົວຢ່າງ",
  th: "ตัวอย่าง",
  en: "Example",
};

export function sampleTextForLanguage(language?: string): string {
  return (language && sampleTextByLanguage[language]) || sampleTextByLanguage["th"]!;
}

const podcastBase: CaptionStyle = {
  ...baseStyle,
  size: 6,
  shadow: "large",
  shadowColor: "#000000",
  highlight: "none",
  textAlign: "left",
  posX: 50,
  posY: 72,
  splitLines: 2,
  lineGap: 0,
  animation: "pop",
  // two short lines read best; an explicit word-count choice still wins
  captionMode: "fixed",
  wordsPerGroup: 4,
};

export const stylePresets: CaptionStyle[] = [
  { ...baseStyle },
  {
    ...podcastBase,
    id: "podcast-yellow",
    name: "Podcast เหลือง",
    lineStyles: { 1: { color: "#ffd400", scale: 1.45, bold: true } },
  },
  {
    ...podcastBase,
    id: "podcast-blue",
    name: "Podcast ฟ้า",
    lineStyles: { 1: { color: "#6cc4ff", scale: 1.45, bold: true } },
  },
  {
    // White heavy text with a thick dark outline and soft shadow; the spoken
    // word turns yellow. Kanit covers Thai and Latin, Noto Sans Lao takes Lao.
    ...baseStyle,
    id: "outline-yellow",
    name: "ขอบดำ เน้นเหลือง",
    fontFamily: "'Kanit', 'Noto Sans Lao', 'Noto Sans Thai', sans-serif",
    fontWeight: 800,
    size: 6.6,
    color: "#ffffff",
    stroke: "large",
    strokeColor: "#1f1f1f",
    shadow: "medium",
    shadowColor: "#000000",
    highlight: "color",
    highlightColor: "#ffd21f",
    animation: "pop",
  },
  {
    ...baseStyle,
    id: "yellow-bar",
    name: "แถบเหลือง",
    size: 4.6,
    color: "#111111",
    shadow: "none",
    highlight: "none",
    textAlign: "left",
    posY: 40,
    plate: true,
    plateColor: "#facc15",
    plateOpacity: 1,
    plateRadius: 0.08,
    animation: "slideUp2",
  },
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


export function captionModeOf(style: Pick<CaptionStyle, "captionMode" | "wordsPerGroup">): CaptionMode {
  return style.captionMode ?? (style.wordsPerGroup === 1 ? "word" : "sentence");
}

const SENTENCE_END = /[.!?…,;:。、ฯ]$/;

/**
 * Groups words into spoken phrases: a new caption starts after a pause, after
 * punctuation, or when the line would get too long to read at a glance.
 */
export function groupSentences(
  words: Word[],
  options: { pause?: number; maxWords?: number; maxChars?: number } = {},
): CaptionGroup[] {
  const pause = options.pause ?? 0.45;
  const maxWords = options.maxWords ?? 8;
  const maxChars = options.maxChars ?? 32;
  const groups: CaptionGroup[] = [];
  let current: Word[] = [];
  let counted = 0;
  let chars = 0;
  let last: Word | null = null;

  const flush = () => {
    const visible = current.filter((w) => w.text !== LINE_BREAK);
    if (visible.length) {
      groups.push({ start: visible[0]!.start, end: visible[visible.length - 1]!.end, words: [...current] });
    }
    current = [];
    counted = 0;
    chars = 0;
  };

  for (const word of words) {
    if (word.text === LINE_BREAK) {
      current.push(word);
      continue;
    }
    const length = word.text.length;
    const breakHere =
      last !== null &&
      counted > 0 &&
      (word.start - last.end >= pause ||
        SENTENCE_END.test(last.text) ||
        counted >= maxWords ||
        chars + length > maxChars);
    if (breakHere) flush();
    current.push(word);
    counted++;
    chars += length;
    last = word;
  }
  flush();
  return groups;
}

export function groupCaptions(words: Word[], style: Pick<CaptionStyle, "captionMode" | "wordsPerGroup">): CaptionGroup[] {
  const mode = captionModeOf(style);
  if (mode === "word") return groupWords(words, 1);
  if (mode === "fixed") return groupWords(words, style.wordsPerGroup);
  return groupSentences(words);
}

/** Hex color (#rgb or #rrggbb) with an alpha, as rgba(). */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return hex;
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}

const THAI_LAO_CHAR = /[\u0E00-\u0EFF]/;

/** Whether a space belongs between two caption words. */
export function needsSpace(prev: string, next: string, joinWords: boolean | undefined = true): boolean {
  if (joinWords === false) return true;
  const last = prev.slice(-1);
  const first = next.charAt(0);
  return !(THAI_LAO_CHAR.test(last) && THAI_LAO_CHAR.test(first));
}

/** Caption words as written text: Thai/Lao joined, other words spaced; LINE_BREAK becomes "\n". */
export function joinCaptionWords(words: Word[], joinWords: boolean | undefined = true): string {
  let out = "";
  let prev = "";
  for (const word of words) {
    if (word.text === LINE_BREAK) {
      out += "\n";
      prev = "";
      continue;
    }
    if (prev && needsSpace(prev, word.text, joinWords)) out += " ";
    out += word.text;
    prev = word.text;
  }
  return out.trim();
}

/**
 * Index where a caption splits into two lines of similar length; the first
 * line is never longer than the second (a short lead-in, then the key words).
 */
export function balancedSplitIndex(texts: string[]): number {
  if (texts.length < 2) return texts.length;
  const total = texts.reduce((n, t) => n + t.length, 0);
  let best = 1;
  let bestScore = Infinity;
  let first = 0;
  for (let i = 1; i < texts.length; i++) {
    first += texts[i - 1]!.length;
    const second = total - first;
    const score = Math.abs(second - first) + (first > second ? 2 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}
