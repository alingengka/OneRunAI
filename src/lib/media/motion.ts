import type { Scene } from "@/lib/scenes";

export type MotionTransform = {
  scale: number;
  /** สัดส่วนของความกว้าง/สูงเฟรม (-1..1) */
  translateX: number;
  translateY: number;
};

export const NO_MOTION: MotionTransform = { scale: 1, translateX: 0, translateY: 0 };

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export type MotionKind = "zoom-in" | "zoom-out" | "pan-left" | "pan-right";

export function motionKindForScene(index: number): MotionKind {
  return (["zoom-in", "zoom-out", "pan-left", "pan-right"] as const)[Math.abs(index) % 4]!;
}

/**
 * Ken Burns แบบเบา ๆ: ซูมเข้า/ออก หรือแพนซ้าย/ขวา ตลอดความยาวซีน
 * ใช้ ease-in-out เพื่อให้เริ่ม/จบนุ่มนวล และสลับทิศตาม scene.index
 */
export function motionTransform(
  scene: Pick<Scene, "index" | "start" | "end">,
  time: number,
  intensity = 0.7,
): MotionTransform {
  const length = Math.max(0.001, scene.end - scene.start);
  const progress = Math.max(0, Math.min(1, (time - scene.start) / length));
  const eased = easeInOut(progress);
  const amount = Math.max(0, Math.min(1, intensity));
  const zoom = 0.12 * amount; // สูงสุด +12%
  const pan = 0.06 * amount; // สูงสุด 6% ของเฟรม

  switch (motionKindForScene(scene.index)) {
    case "zoom-in":
      return { scale: 1 + zoom * eased, translateX: 0, translateY: 0 };
    case "zoom-out":
      return { scale: 1 + zoom * (1 - eased), translateX: 0, translateY: 0 };
    case "pan-left":
      return { scale: 1 + zoom * 0.6, translateX: -pan * (eased - 0.5) * 2, translateY: 0 };
    case "pan-right":
    default:
      return { scale: 1 + zoom * 0.6, translateX: pan * (eased - 0.5) * 2, translateY: 0 };
  }
}

export type MotionScene = Pick<Scene, "id" | "index" | "start" | "end">;
export type MotionElement = {
  sceneId: string;
  kind: string;
  enabled: boolean;
  intensity: number;
  text?: string;
  position?: "top" | "middle";
};

/** หา transform ณ เวลานั้นจากรายการซีน + element ที่เปิด motion ไว้ */
export function motionAt(
  time: number,
  scenes: MotionScene[] | undefined,
  elements: MotionElement[] | undefined,
): MotionTransform {
  if (!scenes?.length || !elements?.length) return NO_MOTION;
  const scene = scenes.find((s) => time >= s.start - 0.001 && time <= s.end + 0.001);
  if (!scene) return NO_MOTION;
  const element = elements.find((e) => e.sceneId === scene.id && e.kind === "motion" && e.enabled);
  if (!element) return NO_MOTION;
  return motionTransform(scene, time, element.intensity);
}
