import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { RotateCw } from "lucide-react";
import { ACCENT_PRIMARY_HEX, ACCENT_SECONDARY_HEX, type CaptionGroup, type CaptionStyle, LINE_BREAK, emphasizedWeight, fontRealFaces, isKeyword, shadowBlur, strokeWidth, withAlpha, needsSpace, balancedSplitIndex } from "@/lib/captions";


type Props = {
  group: CaptionGroup | null;
  time: number;
  style: CaptionStyle;
  height: number;
  /** keep text inside TikTok's safe area (UI overlay on the right/bottom) */
  safeArea?: boolean;
  onPositionChange?: (position: { posX: number; posY: number }) => void;
  /** edit the current caption text inline; "\n" separates rows */
  onEditText?: (text: string) => void;
  /** resize / rotate from the on-video handles */
  onTransform?: (patch: { size?: number; rotation?: number }) => void;
  /** show the resize and rotate handles (hidden while playing) */
  showHandles?: boolean;
};

type Gesture =
  | { kind: "resize"; cx: number; cy: number; startDist: number; startSize: number }
  | { kind: "rotate"; cx: number; cy: number };

/** Snaps an angle to the nearest quarter turn when it is within 4°. */
function snapAngle(deg: number): number {
  const normalized = ((deg + 540) % 360) - 180;
  for (const target of [-180, -90, 0, 90, 180]) {
    if (Math.abs(normalized - target) <= 4) return target === -180 ? 180 : target;
  }
  return Math.round(normalized);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const boldStroke = (fontSize: number) => `${Math.max(1, Math.round(fontSize * 0.035))}px currentColor`;

export function CaptionOverlay({ group, time, style, height, safeArea, onPositionChange, onEditText, onTransform, showHandles }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [gesture, setGesture] = useState<Gesture | null>(null);

  useEffect(() => {
    if (!editing) setDraft("");
  }, [editing]);

  if (!group || height === 0) return null;

  const fontSize = (style.size / 100) * height;
  const stroke = strokeWidth[style.stroke] * (fontSize / 60);
  const blur = shadowBlur[style.shadow] * (fontSize / 60);
  const visibleWords = group.words.filter((w) => w.text !== LINE_BREAK);
  const activeIndex = group.words.findIndex((w) => w.text !== LINE_BREAK && time >= w.start && time < w.end);
  const shownIndex = activeIndex === -1 ? group.words.length - 1 : activeIndex;

  const groupText = group.words
    .map((w) => (w.text === LINE_BREAK ? "\n" : w.text))
    .join(" ")
    .replace(/ ?\n ?/g, "\n")
    .trim();

  const glowPulse = 0.5 + 0.5 * Math.sin((time - group.start) * Math.PI * 3);
  const glowShadow =
    style.animation === "glow"
      ? `0 0 ${fontSize * (0.1 + 0.1 * glowPulse)}px ${ACCENT_SECONDARY_HEX}, 0 0 ${fontSize * (0.26 + 0.2 * glowPulse)}px ${ACCENT_PRIMARY_HEX}`
      : "";

  const textShadow = [
    stroke > 0
      ? `${-stroke}px ${-stroke}px 0 ${style.strokeColor}, ${stroke}px ${-stroke}px 0 ${style.strokeColor}, ${-stroke}px ${stroke}px 0 ${style.strokeColor}, ${stroke}px ${stroke}px 0 ${style.strokeColor}`
      : "",
    blur > 0 ? `0 ${blur / 3}px ${blur}px ${style.shadowColor}` : "",
    glowShadow,
  ]
    .filter(Boolean)
    .join(", ");


  const anim = style.animation;

  const perLine = Math.max(0, Math.round(style.wordsPerLine ?? 0));
  const indexed = group.words.map((word, i) => ({ word, i }));
  const lines: { word: (typeof group.words)[number]; i: number }[][] = [];
  const hasManualBreak = group.words.some((w) => w.text === LINE_BREAK);
  if (hasManualBreak) {
    let currentLine: typeof indexed = [];
    for (const item of indexed) {
      if (item.word.text === LINE_BREAK) {
        lines.push(currentLine);
        currentLine = [];
      } else currentLine.push(item);
    }
    lines.push(currentLine);
  } else if (perLine > 0) {
    for (let i = 0; i < indexed.length; i += perLine) lines.push(indexed.slice(i, i + perLine));
  } else if (style.splitLines === 2 && indexed.length > 1) {
    const at = balancedSplitIndex(indexed.map((item) => item.word.text));
    lines.push(indexed.slice(0, at), indexed.slice(at));
  } else {
    lines.push(indexed);
  }
  const renderLines = lines.filter((l) => l.length > 0);
  // 0 -> 1 progress of the group entrance (speed multiplier: higher = faster)
  const speed = Math.max(0.25, style.animationSpeed ?? 1);
  const p = clamp01((time - group.start) / (0.18 / speed));

  const rotation = style.rotation ?? 0;
  let containerTransform = `translate(-50%, -50%)${rotation ? ` rotate(${rotation}deg)` : ""}`;
  let containerOpacity = 1;

  if (anim === "pop") {
    containerTransform += ` scale(${0.9 + p * 0.1})`;
    containerOpacity = 0.3 + p * 0.7;
  } else if (anim === "fade") {
    containerOpacity = clamp01((time - group.start) / (0.3 / speed));
  } else if (anim === "slideUp") {
    containerTransform += ` translateY(${(1 - p) * fontSize * 0.7}px)`;
    containerOpacity = p;
  } else if (anim === "zoom") {
    containerTransform += ` scale(${0.6 + p * 0.4})`;
    containerOpacity = p;
  } else if (anim === "bounce") {
    const b = p < 1 ? 1 + Math.sin(p * Math.PI) * 0.18 : 1;
    containerTransform += ` scale(${b})`;
  } else if (anim === "shake") {
    const s = p < 1 ? Math.sin(p * Math.PI * 6) * fontSize * 0.06 : 0;
    containerTransform += ` translateX(${s}px)`;
  } else if (anim === "slideUp2") {
    // สไลด์2: เข้าจากด้านข้าง + overshoot (ต่างจาก slideUp ที่เข้าจากด้านล่างแบบ linear)
    const ease = 1 - Math.pow(1 - p, 3);
    containerTransform += ` translateX(${(1 - ease) * -fontSize * 1.6}px) scale(${0.96 + ease * 0.04})`;
    containerOpacity = ease;
  }


  // TikTok keeps its own UI on the right edge and bottom bar; stay clear of it.
  const width = safeArea ? "72%" : "88%";
  const minX = safeArea ? 20 : 8;
  const maxX = safeArea ? 62 : 92;
  const minY = safeArea ? 12 : 5;
  const maxY = safeArea ? 74 : 95;
  const posX = clamp(style.posX, minX, maxX);
  const posY = clamp(style.posY, minY, maxY);

  const beginGesture = (event: ReactPointerEvent<HTMLElement>, kind: Gesture["kind"]) => {
    event.preventDefault();
    event.stopPropagation();
    const box = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!box) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    setGesture(
      kind === "resize"
        ? {
            kind,
            cx,
            cy,
            startDist: Math.max(8, Math.hypot(event.clientX - cx, event.clientY - cy)),
            startSize: style.size,
          }
        : { kind, cx, cy },
    );
  };
  const moveGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (!gesture || !onTransform) return;
    event.stopPropagation();
    const dx = event.clientX - gesture.cx;
    const dy = event.clientY - gesture.cy;
    if (gesture.kind === "resize") {
      const size = (gesture.startSize * Math.hypot(dx, dy)) / gesture.startDist;
      onTransform({ size: Math.round(clamp(size, 2, 16) * 10) / 10 });
    } else {
      // the handle sits above the text, so straight up is 0°
      onTransform({ rotation: snapAngle((Math.atan2(dy, dx) * 180) / Math.PI + 90) });
    }
  };
  const endGesture = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    setGesture(null);
  };

  if (editing && onEditText) {
    return (
      <div
        className="absolute z-30"
        style={{ left: `${posX}%`, top: `${posY}%`, transform: "translate(-50%, -50%)", width }}
      >
        <textarea
          autoFocus
          aria-label="แก้ไขข้อความซับบนพรีวิว"
          value={draft || groupText}
          rows={Math.max(2, renderLines.length + 1)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            const value = (draft || groupText).trim();
            if (value && value !== groupText) onEditText(value);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") { setEditing(false); return; }
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) event.currentTarget.blur();
          }}
          className="w-full resize-none rounded-md border border-primary bg-background/95 p-2 text-center text-sm text-foreground outline-none"
        />
        <p className="mt-1 text-center text-[10px] text-primary-foreground/80">
          ขึ้นบรรทัดใหม่ = แยกแถว · Ctrl/⌘+Enter เพื่อบันทึก
        </p>
      </div>
    );
  }

  return (
    <div
      className={onPositionChange || onEditText ? "absolute z-30 cursor-move select-none touch-none" : "pointer-events-none absolute select-none"}
      role={onPositionChange ? "slider" : undefined}
      aria-label={onPositionChange ? "ตำแหน่งข้อความบนวิดีโอ" : undefined}
      onDoubleClick={onEditText ? (event) => {
        event.preventDefault();
        event.stopPropagation();
        setDraft(groupText);
        setEditing(true);
      } : undefined}
      onPointerDown={onPositionChange ? (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
      } : undefined}
      onPointerMove={onPositionChange ? (event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const frame = event.currentTarget.parentElement?.getBoundingClientRect();
        if (!frame) return;
        onPositionChange({
          posX: clamp(((event.clientX - frame.left) / frame.width) * 100, minX, maxX),
          posY: clamp(((event.clientY - frame.top) / frame.height) * 100, minY, maxY),
        });
      } : undefined}
      style={{
        left: `${posX}%`,
        top: `${posY}%`,
        transform: containerTransform,
        // centered text hugs its lines so the handles frame the words, not the whole row
        ...((style.textAlign ?? "center") === "center" ? { width: "max-content", maxWidth: width } : { width }),
        textAlign: style.textAlign ?? "center",
        lineHeight: 1.15,
        fontFamily: style.fontFamily,
        fontWeight: emphasizedWeight(style.fontWeight, style.bold),
        fontStyle: style.italic ? "italic" : "normal",
        fontSize,
        color: style.color,
        textShadow,
        textTransform: style.uppercase ? "uppercase" : "none",
        opacity: containerOpacity * (style.opacity ?? 1),
        letterSpacing: style.letterSpacing ? `${style.letterSpacing}em` : undefined,
        overflowWrap: "break-word",
        wordBreak: "break-word",
      }}
    >
      {renderLines.map((line, li) => {
        const ls = style.lineStyles?.[li] ?? {};
        const lineStroke = strokeWidth[ls.stroke ?? style.stroke] * (fontSize / 60);
        const lineStrokeColor = ls.strokeColor ?? style.strokeColor;
        const lineTextShadow = [
          lineStroke > 0
            ? `${-lineStroke}px ${-lineStroke}px 0 ${lineStrokeColor}, ${lineStroke}px ${-lineStroke}px 0 ${lineStrokeColor}, ${-lineStroke}px ${lineStroke}px 0 ${lineStrokeColor}, ${lineStroke}px ${lineStroke}px 0 ${lineStrokeColor}`
            : "",
          blur > 0 ? `0 ${blur / 3}px ${blur}px ${style.shadowColor}` : "",
        ]
          .filter(Boolean)
          .join(", ");
        const gap = ls.gap ?? style.lineGap ?? 0.08;
        return (
        <div
          key={li}
          style={{
            display: "block",
            fontFamily: ls.fontFamily ?? style.fontFamily,
            fontWeight: emphasizedWeight(ls.fontWeight ?? style.fontWeight, ls.bold ?? style.bold),
            fontStyle: (ls.italic ?? style.italic) ? "italic" : "normal",
            color: ls.color ?? style.color,
            textShadow: lineTextShadow,
            fontSize: ls.scale ? fontSize * ls.scale : undefined,
          }}
        >
          <span
            style={{
              display: "inline-block",
              maxWidth: "100%",
              background: style.plate
                ? withAlpha(style.plateColor, style.plateOpacity ?? 0.9)
                : anim === "highlight"
                  ? `linear-gradient(to top, ${ACCENT_PRIMARY_HEX} ${(1 - Math.pow(1 - p, 3)) * 100}%, transparent ${(1 - Math.pow(1 - p, 3)) * 100}%)`
                  : undefined,
              padding:
                style.plate || anim === "highlight"
                  ? `${fontSize * 0.12}px ${fontSize * 0.28}px`
                  : undefined,
              borderRadius: style.plate
                ? fontSize * (style.plateRadius ?? 0.22)
                : anim === "highlight"
                  ? fontSize * 0.22
                  : undefined,
              marginTop: li > 0 ? fontSize * gap : undefined,
            }}
          >
            {line.map(({ word, i }, wordInLine) => {
              const prevWord = line[wordInLine - 1]?.word;
              const gapBefore =
                prevWord && needsSpace(prevWord.text, word.text, style.joinWords) ? fontSize * 0.25 : 0;
              const active = i === shownIndex;
              const spoken = time >= word.start;

              // typewriter: hide words not yet reached
              if (anim === "typewriter" && !spoken) return null;

              const karaokeLike = anim === "karaoke" || anim === "karaokePlus" || anim === "karaoke2";
              const emphasize = karaokeLike
                ? spoken && style.highlight !== "none"
                : active && (style.highlight !== "none" || isKeyword(word.text));
              const boxed = emphasize && style.highlight === "box";

              const wordProgress = clamp01((time - word.start) / (0.14 / speed));
              let wordTransform: string | undefined;
              if (active && anim === "flip") {
                wordTransform = `perspective(600px) rotateX(${(1 - wordProgress) * 80}deg)`;
              } else if (active && anim === "karaoke") {
                wordTransform = `scale(${1 + wordProgress * 0.08})`;
              } else if (active && anim === "karaokePlus") {
                // คาราโอเกะ+: ขยายเด่นกว่าเดิม พร้อมยกขึ้นเล็กน้อยตอนคำถูกพูด
                wordTransform = `scale(${1 + wordProgress * 0.22}) translateY(${-wordProgress * 4}%)`;
              } else if (active && (anim === "pop" || anim === "bounce")) {
                wordTransform = "translateY(-3%)";
              }

              const effectiveBold = ls.bold ?? style.bold;
              const lineFamily = ls.fontFamily ?? style.fontFamily;
              const syntheticBold = effectiveBold && !fontRealFaces(lineFamily).bold;

              // คาราโอเกะ2: สีไล่จากบนลงล่างตามจังหวะคำ (ต่างจากคาราโอเกะเดิมที่เปลี่ยนทั้งคำ)
              const k2Fill = active && anim === "karaoke2";
              const k2Color = style.highlight === "none" ? ACCENT_SECONDARY_HEX : style.highlightColor;

              return (
                <span
                  key={`${word.start}-${i}`}
                  style={{
                    display: "inline-block",
                    marginLeft: gapBefore,
                    padding: boxed ? `0 ${fontSize * 0.1}px` : undefined,
                    borderRadius: boxed ? fontSize * 0.12 : undefined,
                    background: k2Fill
                      ? `linear-gradient(to bottom, ${k2Color} ${wordProgress * 100}%, ${ls.color ?? style.color} ${wordProgress * 100}%)`
                      : boxed
                        ? style.highlightColor
                        : undefined,
                    WebkitBackgroundClip: k2Fill ? "text" : undefined,
                    backgroundClip: k2Fill ? "text" : undefined,
                    color: k2Fill
                      ? "transparent"
                      : boxed
                        ? style.highlightTextColor
                        : emphasize && (anim === "karaoke2" || style.highlight === "color")
                          ? (style.highlight === "none" ? ACCENT_SECONDARY_HEX : style.highlightColor)
                          : undefined,
                    transform: wordTransform,
                    transition:
                      anim === "none" ? undefined : `color ${Math.round(80 / speed)}ms linear`,
                    WebkitTextStroke: syntheticBold ? boldStroke(fontSize) : undefined,
                  }}
                >
                  {word.text}
                </span>

              );
            })}
          </span>
        </div>
        );
      })}
      {visibleWords.length === 0 && null}
      {onTransform && (showHandles || gesture) && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1.5 rounded-md border border-dashed border-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          />
          <span
            role="button"
            aria-label="ลากเพื่อหมุนข้อความ"
            title="ลากเพื่อหมุน (ดับเบิลคลิกเพื่อตั้งตรง)"
            onPointerDown={(event) => beginGesture(event, "rotate")}
            onPointerMove={moveGesture}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onTransform({ rotation: 0 });
            }}
            className="absolute -top-10 left-1/2 grid h-8 w-8 before:absolute before:-inset-3 before:content-[''] -translate-x-1/2 cursor-grab touch-none place-items-center rounded-full bg-white text-black shadow-md"
            style={{ textShadow: "none" }}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </span>
          <span
            role="button"
            aria-label="ลากเพื่อย่อหรือขยายข้อความ"
            title="ลากเพื่อย่อ/ขยาย"
            onPointerDown={(event) => beginGesture(event, "resize")}
            onPointerMove={moveGesture}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            className="absolute -bottom-3.5 -right-3.5 h-7 w-7 before:absolute before:-inset-3 before:content-[''] cursor-nwse-resize touch-none rounded-full border-2 border-primary bg-white shadow-md"
          />
        </>
      )}
    </div>
  );
}
