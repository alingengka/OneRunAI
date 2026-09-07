import { useEffect, useState } from "react";
import { type CaptionGroup, type CaptionStyle, LINE_BREAK, emphasizedWeight, isKeyword, shadowBlur, strokeWidth } from "@/lib/captions";

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
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const boldStroke = (fontSize: number) => `${Math.max(1, Math.round(fontSize * 0.035))}px currentColor`;

export function CaptionOverlay({ group, time, style, height, safeArea, onPositionChange, onEditText }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

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

  const textShadow = [
    stroke > 0
      ? `${-stroke}px ${-stroke}px 0 ${style.strokeColor}, ${stroke}px ${-stroke}px 0 ${style.strokeColor}, ${-stroke}px ${stroke}px 0 ${style.strokeColor}, ${stroke}px ${stroke}px 0 ${style.strokeColor}`
      : "",
    blur > 0 ? `0 ${blur / 3}px ${blur}px ${style.shadowColor}` : "",
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
  } else {
    lines.push(indexed);
  }
  const renderLines = lines.filter((l) => l.length > 0);
  // 0 -> 1 progress of the group entrance (speed multiplier: higher = faster)
  const speed = Math.max(0.25, style.animationSpeed ?? 1);
  const p = clamp01((time - group.start) / (0.18 / speed));

  let containerTransform = "translate(-50%, -50%)";
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
  }

  // TikTok keeps its own UI on the right edge and bottom bar; stay clear of it.
  const width = safeArea ? "72%" : "88%";
  const minX = safeArea ? 20 : 8;
  const maxX = safeArea ? 62 : 92;
  const minY = safeArea ? 12 : 5;
  const maxY = safeArea ? 74 : 95;
  const posX = clamp(style.posX, minX, maxX);
  const posY = clamp(style.posY, minY, maxY);

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
        width,
        textAlign: style.textAlign ?? "center",
        lineHeight: 1.15,
        fontFamily: style.fontFamily,
        fontWeight: emphasizedWeight(style.fontWeight, style.bold),
        fontStyle: style.italic ? "italic" : "normal",
        fontSize,
        color: style.color,
        textShadow,
        textTransform: style.uppercase ? "uppercase" : "none",
        opacity: containerOpacity,
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
          }}
        >
          <span
            style={{
              display: "inline-block",
              maxWidth: "100%",
              background: style.plate ? style.plateColor : undefined,
              padding: style.plate ? `${fontSize * 0.12}px ${fontSize * 0.28}px` : undefined,
              borderRadius: style.plate ? fontSize * 0.22 : undefined,
              marginTop: li > 0 ? fontSize * gap : undefined,
            }}
          >
            {line.map(({ word, i }) => {
              const active = i === shownIndex;
              const spoken = time >= word.start;

              // typewriter: hide words not yet reached
              if (anim === "typewriter" && !spoken) return null;

              const emphasize =
                anim === "karaoke"
                  ? spoken && style.highlight !== "none"
                  : active && (style.highlight !== "none" || isKeyword(word.text));
              const boxed = emphasize && style.highlight === "box";

              const wordProgress = clamp01((time - word.start) / (0.14 / speed));
              let wordTransform: string | undefined;
              if (active && anim === "flip") {
                wordTransform = `perspective(600px) rotateX(${(1 - wordProgress) * 80}deg)`;
              } else if (active && anim === "karaoke") {
                wordTransform = `scale(${1 + wordProgress * 0.08})`;
              } else if (active && (anim === "pop" || anim === "bounce")) {
                wordTransform = "translateY(-3%)";
              }

              const effectiveBold = ls.bold ?? style.bold;

              return (
                <span
                  key={`${word.start}-${i}`}
                  style={{
                    display: "inline-block",
                    margin: `0 ${fontSize * 0.09}px`,
                    padding: boxed ? `0 ${fontSize * 0.1}px` : undefined,
                    borderRadius: boxed ? fontSize * 0.12 : undefined,
                    background: boxed ? style.highlightColor : undefined,
                    color: boxed
                      ? style.highlightTextColor
                      : emphasize && style.highlight === "color"
                        ? style.highlightColor
                        : undefined,
                    transform: wordTransform,
                    transition:
                      anim === "none" ? undefined : `color ${Math.round(80 / speed)}ms linear`,
                    WebkitTextStroke: effectiveBold ? boldStroke(fontSize) : undefined,
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
    </div>
  );
}
