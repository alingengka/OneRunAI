/**
 * ตัววาดเฟรม "วิดีโอ + ซับ + motion + viral text" ที่ใช้ร่วมกันระหว่าง
 * เส้นทาง export แบบ WebCodecs (หลัก) และ MediaRecorder (สำรอง)
 * โค้ดวาดทั้งหมดอยู่ที่นี่ที่เดียว เพื่อให้สองเส้นทางได้ภาพเหมือนกันเป๊ะ
 */
import type { Segment } from "./audio";
import { motionTransform, NO_MOTION, type MotionElement, type MotionScene } from "./motion";
import { viralTextWindow } from "../scenes";
import {
  ITALIC_SKEW,
  LINE_BREAK,
  emphasizedWeight,
  isKeyword,
  splitEmphasis,
  shadowBlur,
  strokeWidth,
  type CaptionGroup,
  type CaptionStyle,
  type LineStyle,
  type TextEmphasis,
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
      const space = ctx.measureText(" ").width;
      const pad = emphasisPad(fontSize, synthetic);
      const gap = (ls.gap ?? 0) * fontSize;
      const wordWidths = line.words.map((w) => ctx.measureText(w.text).width + pad);

      // ตัดบรรทัดตามความกว้างจริง เพื่อไม่ให้คำล้นออกนอกเฟรม (คำหายจากภาพ)
      let chunk: StaticWord[] = [];
      let chunkWidths: number[] = [];
      let chunkTotal = 0;
      const flush = () => {
        if (!chunk.length) return;
        lines.push({ words: chunk });
        metrics.push({ widths: chunkWidths, space, total: chunkTotal, weight, family, ls, gap, em: synthetic, font });
        chunk = [];
        chunkWidths = [];
        chunkTotal = 0;
      };
      line.words.forEach((word, wi) => {
        const w = wordWidths[wi]!;
        const next = chunkTotal + (chunk.length ? space : 0) + w;
        if (chunk.length && next > maxTextWidth) flush();
        chunkTotal += (chunk.length ? space : 0) + w;
        chunk.push(word);
        chunkWidths.push(w);
      });
      flush();
    });

    const blockHeight = metrics.reduce((n, m, i) => n + lineHeight + (i ? baseGap + m.gap : 0), 0);
    const layout: GroupLayout = { lines, metrics, blockHeight };
    layoutCache.set(group, layout);
    return layout;
  };


  const drawCaption = (time: number) => {
    if (options.captions === false || !sortedGroups.length) return;
    const group = findWindow(sortedGroups, time, 0.02);
    if (!group || time > group.end + 0.12) return;
    const { lines, metrics, blockHeight } = layoutFor(group);
    if (!lines.length) return;

    ctx.textBaseline = "middle";
    const centerX = (style.posX / 100) * width;
    let y = (style.posY / 100) * height - blockHeight / 2 + lineHeight / 2;

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
        ctx.fillStyle = style.plateColor;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(left - fontSize * 0.28, y - lineHeight * 0.6, m.total + fontSize * 0.56, lineHeight * 1.2);
        ctx.globalAlpha = 1;
      }

      let x = left;
      ctx.font = m.font;
      line.words.forEach((word, wi) => {
        const w = m.widths[wi]!;
        const highlighted = time >= word.start - 0.01 && time <= word.end + 0.01;
        if (highlighted && style.highlight === "box") {
          ctx.fillStyle = style.highlightColor;
          ctx.globalAlpha = 1;
          const r = fontSize * 0.16;
          const bx = x - fontSize * 0.12;
          const by = y - lineHeight * 0.56;
          const bw = w + fontSize * 0.24;
          const bh = lineHeight * 1.12;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, r);
          ctx.fill();
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
        ctx.shadowBlur = blur;
        ctx.shadowColor = blur ? style.shadowColor : "transparent";
        ctx.shadowOffsetY = blur ? blur * 0.25 : 0;

        ctx.fillStyle = highlighted
          ? style.highlight === "box"
            ? style.highlightTextColor
            : style.highlight === "color"
              ? style.highlightColor
              : (m.ls.color ?? style.color)
          : (m.ls.color ?? style.color);
        paintEmphasized(ctx, word.text, x, y, fontSize, m.em, "fill");
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowColor = "transparent";
        x += w + m.space;
      });


      y += lineHeight;
    });
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
    ctx.translate(width / 2 + hit.offsetX, y + hit.offsetY);
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
    // Motion (Ken Burns) applies to the image only — captions stay still.
    const mw = motionWindows.length ? findWindow(motionWindows, time, 0.001) : null;
    const motion = mw ? motionTransform(mw.scene, time, mw.intensity, mw.motionKind) : NO_MOTION;
    if (motion.scale !== 1 || motion.translateX || motion.translateY) {
      ctx.save();
      ctx.translate(width / 2 + motion.translateX * width, height / 2 + motion.translateY * height);
      ctx.scale(motion.scale, motion.scale);
      ctx.drawImage(source, -width / 2, -height / 2, width, height);
      ctx.restore();
    } else {
      ctx.drawImage(source, 0, 0, width, height);
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
  };

  return { paint };
}
