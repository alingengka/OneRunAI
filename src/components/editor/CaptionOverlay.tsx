import { type CaptionGroup, type CaptionStyle, isKeyword, shadowBlur, strokeWidth } from "@/lib/captions";

type Props = {
  group: CaptionGroup | null;
  time: number;
  style: CaptionStyle;
  height: number;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function CaptionOverlay({ group, time, style, height }: Props) {
  if (!group || height === 0) return null;

  const fontSize = (style.size / 100) * height;
  const stroke = strokeWidth[style.stroke] * (fontSize / 60);
  const blur = shadowBlur[style.shadow] * (fontSize / 60);
  const activeIndex = group.words.findIndex((w) => time >= w.start && time < w.end);
  const shownIndex = activeIndex === -1 ? group.words.length - 1 : activeIndex;

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
  if (perLine > 0) {
    for (let i = 0; i < indexed.length; i += perLine) lines.push(indexed.slice(i, i + perLine));
  } else {
    lines.push(indexed);
  }
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

  return (
    <div
      className="pointer-events-none absolute select-none"
      style={{
        left: `${style.posX}%`,
        top: `${style.posY}%`,
        transform: containerTransform,
        width: "88%",
        textAlign: style.textAlign ?? "center",
        lineHeight: 1.15,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize,
        color: style.color,
        textShadow,
        textTransform: style.uppercase ? "uppercase" : "none",
        opacity: containerOpacity,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ display: "block" }}>
          <span
            style={{
              display: "inline-block",
              background: style.plate ? style.plateColor : undefined,
              padding: style.plate ? `${fontSize * 0.12}px ${fontSize * 0.28}px` : undefined,
              borderRadius: style.plate ? fontSize * 0.22 : undefined,
              marginTop: li > 0 ? fontSize * 0.08 : undefined,
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

              const wordProgress = clamp01((time - word.start) / 0.14);
              let wordTransform: string | undefined;
              if (active && anim === "flip") {
                wordTransform = `perspective(600px) rotateX(${(1 - wordProgress) * 80}deg)`;
              } else if (active && anim === "karaoke") {
                wordTransform = `scale(${1 + wordProgress * 0.08})`;
              } else if (active && (anim === "pop" || anim === "bounce")) {
                wordTransform = "translateY(-3%)";
              }

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
                    transition: anim === "none" ? undefined : "color 80ms linear",
                  }}
                >
                  {word.text}
                </span>
              );
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
