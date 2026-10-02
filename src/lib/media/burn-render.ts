/**
 * ตัววาดเฟรม "วิดีโอ + ซับ + motion + viral text" ที่ใช้ร่วมกันระหว่าง
 * เส้นทาง export แบบ WebCodecs (หลัก) และ MediaRecorder (สำรอง)
 * โค้ดวาดทั้งหมดอยู่ที่นี่ที่เดียว เพื่อให้สองเส้นทางได้ภาพเหมือนกันเป๊ะ
 */
import type { Segment } from "./audio";
import {
  motionTransform,
  NO_MOTION,
  VIRAL_REF_HEIGHT,
  type MotionElement,
  type MotionScene,
} from "./motion";
import { viralTextWindow } from "../scenes";
import { coverRect, sourceSize, type BrollTrack } from "./broll";
import type { Sticker, StickerLayer } from "./stickers";
import {
  ACCENT_PRIMARY_HEX,
  ACCENT_SECONDARY_HEX,
  ITALIC_SKEW,

  LINE_BREAK,
  emphasizedWeight,
  needsSpace,
  isKeyword,
  splitEmphasis,
  shadowBlur,
  strokeWidth,
  type CaptionGroup,
  type CaptionStyle,
  type LineStyle,
  type TextEmphasis,
  withAlpha,
} from "../captions";

export type ExportResolution = "source" | "4k" | "1080" | "720";

/**
 * วาดข้อความพร้อมตัวหนา/ตัวเอียง "สังเคราะห์"
 * - เอียง: skew บนแกน x รอบเส้น baseline (สระ/วรรณยุกต์ลาวเลื่อนตามตัวอักษร ไม่หลุดตำแหน่ง)
 * - หนา: วาดซ้อนหลายรอบด้วย offset เล็ก ๆ เพราะ canvas ไม่สังเคราะห์ตัวหนาให้ฟอนต์ custom
 */
export function paintEmphasized(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  em: TextEmphasis,
  mode: "fill" | "stroke",
): void {
  const draw = (dx: number, dy: number) =>
    mode === "stroke" ? ctx.strokeText(text, dx, dy) : ctx.fillText(text, dx, dy);
  ctx.save();
  ctx.translate(x, y);
  if (em.italic) ctx.transform(1, 0, ITALIC_SKEW, 1, 0, 0);
  if (em.bold) {
    const d = Math.max(0.6, fontSize * 0.018);
    const o = d * 0.72;
    for (const [dx, dy] of [
      [0, 0],
      [d, 0],
      [-d, 0],
      [0, d],
      [0, -d],
      [o, o],
      [-o, -o],
      [o, -o],
      [-o, o],
    ] as const) {
      draw(dx, dy);
    }
  } else {
    draw(0, 0);
  }
  ctx.restore();
}

/** ความกว้างที่เพิ่มขึ้นจากการหนา/เอียงสังเคราะห์ (ใช้กัน layout ชนกัน) */
export function emphasisPad(fontSize: number, em: TextEmphasis): number {
  return (em.bold ? fontSize * 0.036 : 0) + (em.italic ? fontSize * 0.05 : 0);
}



/**
 * บังคับให้ฟอนต์ทุกตัวที่ซับใช้ (รวม override รายบรรทัด) โหลดเสร็จก่อนวาดลง canvas
 * ถ้าไม่ทำ ฟอนต์ที่ยังไม่ถูกใช้บนหน้าเว็บจะไม่ถูกดาวน์โหลด แล้ว canvas จะ fallback
 */
export async function ensureCaptionFonts(style: CaptionStyle): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  const families = new Set<string>([style.fontFamily]);
  for (const ls of Object.values(style.lineStyles ?? {})) {
    if (ls?.fontFamily) families.add(ls.fontFamily);
  }
  const weights = new Set<number>([style.fontWeight, 400, 700, 900]);
  for (const ls of Object.values(style.lineStyles ?? {})) {
    if (ls?.fontWeight) weights.add(ls.fontWeight);
  }
  const jobs: Promise<unknown>[] = [];
  for (const family of families) {
    for (const weight of weights) {
      for (const style_ of ["", "italic "]) {
        jobs.push(fonts.load(`${style_}${weight} 64px ${family}`, "ສະບາຍດີ ABC ก").catch(() => undefined));
      }
    }
  }
  await Promise.all(jobs);
  try { await fonts.ready; } catch { /* ignore */ }
}


/** ความสูงของด้านสั้น (แนวตั้ง 9:16 → 1080 = 1080x1920) */
const SHORT_SIDE: Record<Exclude<ExportResolution, "source">, number> = {
  "4k": 2160,
  "1080": 1080,
  "720": 720,
};

/** คำนวณขนาด canvas เป้าหมายโดยรักษาสัดส่วนภาพเดิม (ปัดเป็นเลขคู่) */
export function targetSize(
  sourceWidth: number,
  sourceHeight: number,
  resolution: ExportResolution = "source",
): { width: number; height: number; upscaled: boolean } {
  if (resolution === "source" || !sourceWidth || !sourceHeight) {
    return { width: sourceWidth, height: sourceHeight, upscaled: false };
  }
  const short = Math.min(sourceWidth, sourceHeight);
  const scale = SHORT_SIDE[resolution] / short;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return {
    width: even(sourceWidth * scale),
    height: even(sourceHeight * scale),
    upscaled: scale > 1,
  };
}

type StaticWord = { text: string; start: number; end: number; keyword: boolean };
type StaticLine = { words: StaticWord[] };

/**
 * แบ่งบรรทัดของกลุ่มซับ "ครั้งเดียวต่อกลุ่ม" (ไม่ขึ้นกับเวลา)
 * สถานะ active คำนวณตอนวาดจาก start/end ที่เก็บไว้ ทำให้ไม่ต้อง layout ใหม่ทุกเฟรม
 */
function layoutGroupStatic(group: CaptionGroup, style: CaptionStyle): StaticLine[] {
  const lines: StaticLine[] = [{ words: [] }];
  const perLine = Math.max(0, Math.round(style.wordsPerLine ?? 0));
  for (const word of group.words) {
    if (word.text === LINE_BREAK) {
      lines.push({ words: [] });
      continue;
    }
    const current = lines[lines.length - 1]!;
    if (perLine > 0 && current.words.length >= perLine) lines.push({ words: [] });
    const target = lines[lines.length - 1]!;
    target.words.push({
      text: style.uppercase ? word.text.toUpperCase() : word.text,
      start: word.start,
      end: word.end,
      keyword: isKeyword(word.text),
    });
  }
  return lines.filter((line) => line.words.length);
}

function lineStyleAt(style: CaptionStyle, index: number): LineStyle {
  return style.lineStyles?.[index] ?? {};
}

/** ความยาวช่วงที่มากที่สุดในลิสต์ (cache ต่อลิสต์ เพื่อไม่ต้องวนใหม่ทุกเฟรม) */
const maxSpanCache = new WeakMap<object, number>();

function maxSpanOf(list: { start: number; end: number }[]): number {
  const cached = maxSpanCache.get(list);
  if (cached !== undefined) return cached;
  let max = 0;
  for (const item of list) max = Math.max(max, item.end - item.start);
  maxSpanCache.set(list, max);
  return max;
}

/**
 * ค้นหาช่วงเวลาแบบ binary search (ลิสต์เรียงตาม start)
 *
 * สำคัญ: เวลาคำจากการถอดเสียงจริงทำให้ "กลุ่มซับซ้อนเวลากันได้" (คำจาก chunk ที่
 * overlap กัน) การ binary search แบบเดิมที่สมมติว่าช่วงไม่ซ้อนกันจะคืน null
 * ทั้งที่มีกลุ่มครอบเวลานั้นอยู่ → ซับหายทั้งกลุ่ม จึงหา index สุดท้ายที่
 * start <= time แล้วไล่ย้อนหลังเท่าความยาวช่วงที่มากที่สุด
 */
export function findWindow<T extends { start: number; end: number }>(list: T[], time: number, pad = 0): T | null {
  if (!list.length) return null;
  let lo = 0;
  let hi = list.length - 1;
  let idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid]!.start - pad <= time) {
      idx = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const span = maxSpanOf(list);
  for (let i = idx; i >= 0; i--) {
    const item = list[i]!;
    if (time - item.start > span + pad) break;
    if (time >= item.start - pad && time <= item.end + pad) return item;
  }
  return null;
}

export type BurnRenderOptions = {
  captions?: boolean | undefined;
  smoothCuts?: boolean | undefined;
  scenes?: MotionScene[] | undefined;
  sceneElements?: MotionElement[] | undefined;
  /** สื่อ B-roll ที่โหลดไว้แล้ว ใช้วาดแทนเฟรมต้นฉบับ */
  brollTrack?: BrollTrack | undefined;
  /** emoji and motion-graphic stickers, with a layer already prepared for them */
  stickers?: Sticker[] | undefined;
  stickerLayer?: StickerLayer | undefined;
};

const FADE = 0.08; // วินาทีของ cross-fade ภาพตรงรอยตัด

export type BurnRenderer = {
  /** วาดหนึ่งเฟรม ณ เวลาต้นฉบับ time ภายใต้ segment seg */
  paint: (source: CanvasImageSource, time: number, seg: Segment) => void;
};

export function createBurnRenderer(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  groups: CaptionGroup[],
  style: CaptionStyle,
  options: BurnRenderOptions = {},
): BurnRenderer {
  const sortedGroups = [...groups].sort((a, b) => a.start - b.start);
  type LineMetric = {
    widths: number[];
    /** gap before each word of the line (0 between joined Thai/Lao words) */
    gaps: number[];
    space: number;
    total: number;
    weight: number | string;
    family: string;
    ls: LineStyle;
    gap: number;
    /** ส่วนที่ต้องวาดสังเคราะห์ (เฉพาะฟอนต์ที่ไม่มีไฟล์จริง) */
    em: TextEmphasis;
    /** font string สำหรับ canvas (รวม italic จริงถ้ามีไฟล์) */
    font: string;
  };
  type GroupLayout = { lines: StaticLine[]; metrics: LineMetric[]; blockHeight: number };
  const layoutCache = new Map<CaptionGroup, GroupLayout>();
  const fontSize = (style.size / 100) * height;
  const baseGap = (style.lineGap ?? 0.08) * fontSize;
  const lineHeight = fontSize * 1.18;
  /** Canvas letterSpacing (Chrome, Edge, Safari 17+); ignored where unsupported. */
  const letterSpacing = style.letterSpacing ? `${style.letterSpacing * fontSize}px` : "0px";
  const setSpacing = () => {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = letterSpacing;
  };
  const baseAlpha = Math.max(0.05, Math.min(1, style.opacity ?? 1));

  /** ความกว้างสูงสุดของข้อความ (ให้ตรงกับพรีวิวที่กว้าง 88% ของเฟรม) */
  const maxTextWidth = width * 0.88;

  const layoutFor = (group: CaptionGroup): GroupLayout => {
    const cached = layoutCache.get(group);
    if (cached) return cached;
    const sourceLines = layoutGroupStatic(group, style);
    const lines: StaticLine[] = [];
    const metrics: LineMetric[] = [];

    sourceLines.forEach((line, i) => {
      const ls = lineStyleAt(style, i);
      const wanted: TextEmphasis = { bold: ls.bold ?? style.bold, italic: ls.italic ?? style.italic };
      const family = ls.fontFamily ?? style.fontFamily;
      const { native, synthetic } = splitEmphasis(family, wanted);
      const weight = emphasizedWeight(ls.fontWeight ?? style.fontWeight, native.bold);
      const font = `${native.italic ? "italic " : ""}${weight} ${fontSize}px ${family}`;
      ctx.font = font;
      setSpacing();
      const space = ctx.measureText(" ").width;
      const pad = emphasisPad(fontSize, synthetic);
      const gap = (ls.gap ?? 0) * fontSize;
      const wordWidths = line.words.map((w) => ctx.measureText(w.text).width + pad);

      // ตัดบรรทัดตามความกว้างจริง เพื่อไม่ให้คำล้นออกนอกเฟรม (คำหายจากภาพ)
      let chunk: StaticWord[] = [];
      let chunkWidths: number[] = [];
      let chunkGaps: number[] = [];
      let chunkTotal = 0;
      const flush = () => {
        if (!chunk.length) return;
        lines.push({ words: chunk });
        metrics.push({ widths: chunkWidths, gaps: chunkGaps, space, total: chunkTotal, weight, family, ls, gap, em: synthetic, font });
        chunk = [];
        chunkWidths = [];
        chunkGaps = [];
        chunkTotal = 0;
      };
      line.words.forEach((word, wi) => {
        const w = wordWidths[wi]!;
        const before = (prev: StaticWord | undefined) =>
          prev && needsSpace(prev.text, word.text, style.joinWords) ? space : 0;
        const next = chunkTotal + before(chunk[chunk.length - 1]) + w;
        if (chunk.length && next > maxTextWidth) flush();
        const g = before(chunk[chunk.length - 1]);
        chunkTotal += g + w;
        chunk.push(word);
        chunkWidths.push(w);
        chunkGaps.push(g);
      });
      flush();
    });

    const blockHeight = metrics.reduce((n, m, i) => n + lineHeight + (i ? baseGap + m.gap : 0), 0);
    const layout: GroupLayout = { lines, metrics, blockHeight };
    // Measuring set the caption spacing; other overlays draw without it.
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
    layoutCache.set(group, layout);
    return layout;
  };


  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const drawCaption = (time: number) => {
    if (options.captions === false || !sortedGroups.length) return;
    const group = findWindow(sortedGroups, time, 0.02);
    if (!group || time > group.end + 0.12) return;
    const { lines, metrics, blockHeight } = layoutFor(group);
    if (!lines.length) return;

    const anim = style.animation;
    const speed = Math.max(0.25, style.animationSpeed ?? 1);
    // ความคืบหน้าของการ "เข้า" กลุ่มซับ (ตรงกับพรีวิว)
    const p = clamp01((time - group.start) / (0.18 / speed));
    const ease = 1 - Math.pow(1 - p, 3);
    const glowPulse = 0.5 + 0.5 * Math.sin((time - group.start) * Math.PI * 3);

    ctx.textBaseline = "middle";
    const centerX = (style.posX / 100) * width;
    const centerY = (style.posY / 100) * height;
    let y = centerY - blockHeight / 2 + lineHeight / 2;

    ctx.save();
    setSpacing();
    ctx.globalAlpha = baseAlpha;
    if (style.rotation) {
      ctx.translate(centerX, centerY);
      ctx.rotate((style.rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
    }

    // สไลด์2: เลื่อนทั้งบล็อกเข้าจากด้านข้าง (คำยังถูกวาดครบทุกคำ)
    const slid = anim === "slideUp2";
    if (slid) {
      ctx.save();
      ctx.translate((1 - ease) * -fontSize * 1.6, 0);
    }

    lines.forEach((line, i) => {
      const m = metrics[i]!;
      if (i) y += baseGap + m.gap;

      const left =
        style.textAlign === "left"
          ? centerX - maxTextWidth / 2
          : style.textAlign === "right"
            ? centerX + maxTextWidth / 2 - m.total

            : centerX - m.total / 2;

      if (style.plate) {
        ctx.fillStyle = withAlpha(style.plateColor, style.plateOpacity ?? 0.9);
        ctx.beginPath();
        ctx.roundRect(
          left - fontSize * 0.28,
          y - lineHeight * 0.6,
          m.total + fontSize * 0.56,
          lineHeight * 1.2,
          fontSize * (style.plateRadius ?? 0.22),
        );
        ctx.fill();
      }

      // ไฮไลต์: แถบสีม่วงธีมเลื่อนขึ้นมาจากด้านล่างของบรรทัด
      if (anim === "highlight" && ease > 0) {
        const bh = lineHeight * 1.12 * ease;
        const bottom = y + lineHeight * 0.56;
        ctx.fillStyle = ACCENT_PRIMARY_HEX;
        ctx.globalAlpha = 0.85 * baseAlpha;
        ctx.beginPath();
        ctx.roundRect(left - fontSize * 0.24, bottom - bh, m.total + fontSize * 0.48, bh, fontSize * 0.18);
        ctx.fill();
        ctx.globalAlpha = baseAlpha;
      }

      let x = left;
      ctx.font = m.font;
      line.words.forEach((word, wi) => {
        const w = m.widths[wi]!;
        const highlighted = time >= word.start - 0.01 && time <= word.end + 0.01;
        const spoken = time >= word.start - 0.01;
        const wordProgress = clamp01((time - word.start) / (0.14 / speed));
        if (highlighted && style.highlight === "box") {
          ctx.fillStyle = style.highlightColor;
          ctx.globalAlpha = baseAlpha;
          const r = fontSize * 0.16;
          const bx = x - fontSize * 0.12;
          const by = y - lineHeight * 0.56;
          const bw = w + fontSize * 0.24;
          const bh = lineHeight * 1.12;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, r);
          ctx.fill();
        }

        // คาราโอเกะ+: ขยายคำที่กำลังถูกพูด (วาดรอบจุดกึ่งกลางของคำ)
        const plusScale = anim === "karaokePlus" && highlighted ? 1 + wordProgress * 0.22 : 1;
        if (plusScale !== 1) {
          ctx.save();
          ctx.translate(x + w / 2, y);
          ctx.scale(plusScale, plusScale);
          ctx.translate(-(x + w / 2), -y);
        }

        const strokePx = strokeWidth[m.ls.stroke ?? style.stroke] * (fontSize / 64);
        if (strokePx > 0) {
          ctx.lineJoin = "round";
          ctx.miterLimit = 2;
          ctx.lineWidth = strokePx * 2 + (m.em.bold ? fontSize * 0.02 : 0);
          ctx.strokeStyle = m.ls.strokeColor ?? style.strokeColor;
          paintEmphasized(ctx, word.text, x, y, fontSize, m.em, "stroke");
        }

        const blur = shadowBlur[style.shadow] * (fontSize / 64);
        if (anim === "glow") {
          // เรืองแสง: ใช้สี accent ของธีมกระพริบเบา ๆ
          ctx.shadowBlur = fontSize * (0.26 + 0.2 * glowPulse);
          ctx.shadowColor = ACCENT_SECONDARY_HEX;
          ctx.shadowOffsetY = 0;
        } else {
          ctx.shadowBlur = blur;
          ctx.shadowColor = blur ? style.shadowColor : "transparent";
          ctx.shadowOffsetY = blur ? blur * 0.25 : 0;
        }

        const baseColor = m.ls.color ?? style.color;
        const karaokeColor = style.highlight === "none" ? ACCENT_SECONDARY_HEX : style.highlightColor;
        const karaokeLike = anim === "karaoke" || anim === "karaokePlus" || anim === "karaoke2";
        ctx.fillStyle =
          anim === "highlight" && ease > 0.5
            ? "#ffffff"
            : karaokeLike && spoken
              ? karaokeColor
              : highlighted
                ? style.highlight === "box"
                  ? style.highlightTextColor
                  : style.highlight === "color"
                    ? style.highlightColor
                    : baseColor
                : baseColor;

        if (anim === "karaoke2" && highlighted) {
          // คาราโอเกะ2: สีไล่จากบนลงล่างภายในคำที่กำลังถูกพูด
          const top = y - lineHeight * 0.6;
          const fillH = lineHeight * 1.2 * wordProgress;
          ctx.fillStyle = baseColor;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - fontSize * 0.3, top + fillH, w + fontSize * 0.6, lineHeight * 1.2 - fillH);
          ctx.clip();
          paintEmphasized(ctx, word.text, x, y, fontSize, m.em, "fill");
          ctx.restore();
          ctx.fillStyle = karaokeColor;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x - fontSize * 0.3, top, w + fontSize * 0.6, fillH);
          ctx.clip();
          paintEmphasized(ctx, word.text, x, y, fontSize, m.em, "fill");
          ctx.restore();
        } else {
          paintEmphasized(ctx, word.text, x, y, fontSize, m.em, "fill");
        }
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowColor = "transparent";
        if (plusScale !== 1) ctx.restore();
        x += w + (m.gaps[wi + 1] ?? 0);
      });


      y += lineHeight;
    });

    if (slid) ctx.restore();
    ctx.restore();
  };


  // ตารางค้นหาที่คำนวณล่วงหน้า: ไม่ต้องวน scenes/elements ทุกเฟรมอีก
  const motionWindows = (options.scenes ?? [])
    .map((scene) => {
      const element = (options.sceneElements ?? []).find(
        (e) => e.sceneId === scene.id && e.kind === "motion" && e.enabled,
      );
      return element
        ? {
            start: scene.start,
            end: scene.end,
            scene,
            intensity: element.intensity,
            motionKind: element.motionKind,
          }
        : null;
    })
    .filter((w): w is NonNullable<typeof w> => !!w)
    .sort((a, b) => a.start - b.start);

  const viralWindows = (options.scenes ?? [])
    .map((scene) => {
      const element = (options.sceneElements ?? []).find(
        (e) => e.sceneId === scene.id && e.kind === "viralText" && e.enabled,
      );
      if (!element?.text?.trim()) return null;
      const win = viralTextWindow(scene, element);
      return {
        start: win.start,
        end: win.end,
        text: element.text.trim().toUpperCase(),
        position: element.position ?? "top",
        em: { bold: element.bold, italic: element.italic } as TextEmphasis,
        offsetX: element.offsetX ?? 0,
        offsetY: element.offsetY ?? 0,
        scalePercent: element.scalePercent ?? 100,
      };
    })
    .filter((w): w is NonNullable<typeof w> => !!w)
    .sort((a, b) => a.start - b.start);

  const viralFontSize = height * 0.075;

  const drawViralText = (time: number) => {
    if (!viralWindows.length) return;
    const hit = findWindow(viralWindows, time, 0.001);
    if (!hit) return;
    const span = Math.max(0.001, hit.end - hit.start);
    const progress = Math.max(0, Math.min(1, (time - hit.start) / span));
    const fade = Math.min(0.3, span / 3);
    const inRatio = Math.min(1, (progress * span) / fade);
    const outRatio = Math.min(1, ((1 - progress) * span) / fade);
    const alpha = Math.max(0, Math.min(inRatio, outRatio));
    if (alpha <= 0) return;
    const pop = inRatio < 1 ? 0.7 + 0.3 * (1 - Math.pow(1 - inRatio, 3)) : 1;
    const y = hit.position === "middle" ? height * 0.47 : height * 0.13;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const vsplit = splitEmphasis(style.fontFamily, hit.em);
    ctx.font = `${vsplit.native.italic ? "italic " : ""}900 ${viralFontSize}px ${style.fontFamily}`;
    const userScale = Math.max(0.2, hit.scalePercent / 100);
    const px = height / VIRAL_REF_HEIGHT;
    ctx.translate(width / 2 + hit.offsetX * px, y + hit.offsetY * px);
    ctx.scale(pop * userScale, pop * userScale);
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(4, viralFontSize * 0.14) + (hit.em.bold ? viralFontSize * 0.02 : 0);
    ctx.strokeStyle = "#000000";
    paintEmphasized(ctx, hit.text, 0, 0, viralFontSize, vsplit.synthetic, "stroke");
    ctx.fillStyle = "#ffffff";
    paintEmphasized(ctx, hit.text, 0, 0, viralFontSize, vsplit.synthetic, "fill");

    ctx.restore();
    ctx.textAlign = "left";
  };

  const paint = (source: CanvasImageSource, time: number, seg: Segment) => {
    // B-roll (cutaway): ถ้าซีนนี้มีสื่อ ให้วาดสื่อแทนภาพต้นฉบับทั้งเฟรม
    const broll = options.brollTrack?.sourceAt(time) ?? null;
    const image = broll ?? source;
    const fit = broll
      ? (() => {
          const size = sourceSize(broll);
          return coverRect(size.width, size.height, width, height);
        })()
      : { x: 0, y: 0, w: width, h: height };
    // Motion (Ken Burns) applies to the image only — captions stay still.
    const mw = motionWindows.length ? findWindow(motionWindows, time, 0.001) : null;
    const motion = mw ? motionTransform(mw.scene, time, mw.intensity, mw.motionKind) : NO_MOTION;
    if (motion.scale !== 1 || motion.translateX || motion.translateY) {
      ctx.save();
      ctx.translate(width / 2 + motion.translateX * width, height / 2 + motion.translateY * height);
      ctx.scale(motion.scale, motion.scale);
      ctx.drawImage(image, fit.x - width / 2, fit.y - height / 2, fit.w, fit.h);
      ctx.restore();
    } else {
      ctx.drawImage(image, fit.x, fit.y, fit.w, fit.h);
    }
    if (options.smoothCuts !== false) {
      // ช่วงสั้นได้ fade สั้นลงตามสัดส่วน ไม่งั้นคลิป 0.2s จะดำเกือบทั้งช่วง
      const fade = Math.max(0.02, Math.min(FADE, (seg.end - seg.start) / 5));
      const into = time - seg.start;
      const left = seg.end - time;
      const edge = Math.min(into, left);
      if (edge < fade) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, 1 - edge / fade)) * 0.85;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }
    drawCaption(time);
    drawViralText(time);
    if (options.stickers?.length) options.stickerLayer?.draw(ctx, options.stickers, time, width, height);
  };

  return { paint };
}
