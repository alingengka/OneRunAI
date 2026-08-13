import { type CaptionGroup, type CaptionStyle, isKeyword, shadowBlur, strokeWidth } from "@/lib/captions";

type Props = {
  group: CaptionGroup | null;
  time: number;
  style: CaptionStyle;
  height: number;
};

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

  const pop = style.animation ? Math.min(1, (time - group.start) / 0.14) : 1;

  return (
    <div
      className="pointer-events-none absolute select-none"
      style={{
        left: `${style.posX}%`,
        top: `${style.posY}%`,
        transform: `translate(-50%, -50%) scale(${0.92 + pop * 0.08})`,
        width: "88%",
        textAlign: "center",
        lineHeight: 1.05,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize,
        color: style.color,
        textShadow,
        textTransform: style.uppercase ? "uppercase" : "none",
        opacity: style.animation ? 0.25 + pop * 0.75 : 1,
      }}
    >
      {group.words.map((word, i) => {
        const active = i === shownIndex;
        const emphasize = active && (style.highlight !== "none" || isKeyword(word.text));
        const boxed = emphasize && style.highlight === "box";
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
              transform: active && style.animation ? "translateY(-2%)" : undefined,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
}
