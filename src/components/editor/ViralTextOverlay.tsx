import { viralTextAt, type Scene, type SceneElement } from "@/lib/scenes";

type Props = {
  scenes: Scene[];
  sceneElements: SceneElement[];
  time: number;
  height: number;
};

const POP = 0.3;
const FADE = 0.3;

/** ข้อความไวรัลเด้งช่วงต้นซีน (แยกจากซับพูดปกติ) */
export function ViralTextOverlay({ scenes, sceneElements, time, height }: Props) {
  const hit = viralTextAt(time, scenes, sceneElements);
  if (!hit || height === 0) return null;

  const span = hit.span;
  const inRatio = Math.min(1, (hit.progress * span) / Math.min(POP, span / 3));
  const outRatio = Math.min(1, ((1 - hit.progress) * span) / Math.min(FADE, span / 3));
  const opacity = Math.min(inRatio, outRatio);
  const scale = 0.7 + 0.3 * (inRatio < 1 ? 1 - Math.pow(1 - inRatio, 3) : 1) + (inRatio < 1 ? 0 : 0);

  const fontSize = height * 0.075;
  const stroke = Math.max(2, fontSize * 0.07);
  const shadow = [
    `${-stroke}px ${-stroke}px 0 #000`,
    `${stroke}px ${-stroke}px 0 #000`,
    `${-stroke}px ${stroke}px 0 #000`,
    `${stroke}px ${stroke}px 0 #000`,
  ].join(", ");

  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex justify-center px-[6%]"
      style={{ top: hit.position === "middle" ? "44%" : "10%" }}
    >
      <span
        className="text-center font-extrabold uppercase leading-tight"
        style={{
          color: "#fff",
          fontSize,
          textShadow: shadow,
          opacity,
          transform: `scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        {hit.text}
      </span>
    </div>
  );
}
