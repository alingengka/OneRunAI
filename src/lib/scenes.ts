import { LINE_BREAK, type Word } from "@/lib/captions";
import type { Segment } from "@/lib/media/audio";

export type Scene = {
  id: string;
  index: number;
  start: number;
  end: number;
  segments: Segment[];
  text: string;
};

export type SceneElementKind = "broll" | "motion" | "sound" | "viralText";

export type SceneElement = {
  id: string;
  sceneId: string;
  kind: SceneElementKind;
  label: string;
  enabled: boolean;
  intensity: number;
  /** ข้อความสำหรับ viral text */
  text?: string;
  position?: "top" | "middle";
  /** วินาทีนับจากต้นซีนที่จะเริ่มโชว์ (default 0) */
  offset?: number;
  /** ความยาวที่โชว์ (default 2.5 วินาที) */
  durationSec?: number;
  /** ตัวหนาสังเคราะห์ */
  bold?: boolean | undefined;
  /** ตัวเอียงสังเคราะห์ */
  italic?: boolean | undefined;
};

/** เปิด/ปิดตัวหนา-ตัวเอียงของ element (ใช้กับ viral text) */
export function updateSceneElementFormat(
  elements: SceneElement[],
  id: string,
  patch: { bold?: boolean; italic?: boolean },
): SceneElement[] {
  return elements.map((element) => (element.id === id ? { ...element, ...patch } : element));
}

export function addSceneElement(elements: SceneElement[], sceneId: string, kind: SceneElementKind): SceneElement[] {
  const labels: Record<SceneElementKind, string> = {
    broll: "B-roll",
    motion: "Motion",
    sound: "Sound",
    viralText: "Viral text",
  };
  const existing = elements.find((element) => element.sceneId === sceneId && element.kind === kind);
  if (existing) return elements.map((element) => element.id === existing.id ? { ...element, enabled: true } : element);
  const created: SceneElement = { id: `${sceneId}-${kind}`, sceneId, kind, label: labels[kind], enabled: true, intensity: 0.7 };
  if (kind === "viralText") {
    created.text = "";
    created.position = "top";
    created.offset = 0;
    created.durationSec = 2.5;
  }
  return [...elements, created];
}

export function updateSceneElementText(elements: SceneElement[], id: string, text: string): SceneElement[] {
  return elements.map((element) => (element.id === id ? { ...element, text } : element));
}

export function updateSceneElementTiming(
  elements: SceneElement[],
  id: string,
  offset: number,
  durationSec: number,
): SceneElement[] {
  return elements.map((element) =>
    element.id === id
      ? { ...element, offset: Math.max(0, offset), durationSec: Math.max(0.1, durationSec) }
      : element,
  );
}

export type SceneWindow = { id: string; start: number; end: number; segments?: Segment[] };

export type ViralTiming = { offset?: number; durationSec?: number };

/** ช่วงเวลาที่ viral text โผล่ (เลือกจังหวะเองได้ผ่าน offset/durationSec) */
export function viralTextWindow(scene: SceneWindow, element?: ViralTiming) {
  const sceneLength = Math.max(0, scene.end - scene.start);
  const offset = Math.min(Math.max(0, element?.offset ?? 0), sceneLength);
  const start = scene.start + offset;
  const requested = Math.max(0, element?.durationSec ?? 2.5);
  const fallbackLength = scene.segments?.length
    ? scene.segments.reduce((n, s) => n + (s.end - s.start), 0)
    : sceneLength;
  const span = element?.durationSec === undefined && element?.offset === undefined
    ? Math.min(2.5, Math.max(0, fallbackLength))
    : requested;
  const end = Math.min(scene.end, start + span);
  return { start, end: Math.max(start, end) };
}


/**
 * รวมช่วงพูดที่อยู่ติดกันเป็น "ซีน" เพื่อให้ผู้ใช้มองงานเป็นก้อน
 * (เหมือน Scenes panel ในเครื่องมือระดับโปร) แทนที่จะเห็นเป็นช่วงเสียงย่อย ๆ
 */
export function buildScenes(segments: Segment[], words: Word[], gap = 0.9): Scene[] {
  if (!segments.length) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const groups: Segment[][] = [];
  for (const seg of sorted) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (last && prev && seg.start - prev.end <= gap) last.push(seg);
    else groups.push([seg]);
  }
  return groups.map((segs, index) => {
    const start = segs[0]!.start;
    const end = segs[segs.length - 1]!.end;
    const text = words
      .filter((w) => w.text !== LINE_BREAK && w.start < end + 0.05 && w.end > start - 0.05)
      .map((w) => w.text)
      .join(" ");
    return { id: `scene-${index}`, index, start, end, segments: segs, text };
  });
}

export function sceneDuration(scene: Scene) {
  return scene.segments.reduce((n, s) => n + (s.end - s.start), 0);
}

export function isInScenes(time: number, scenes: Scene[]) {
  return scenes.some((scene) => time >= scene.start - 0.001 && time <= scene.end + 0.001);
}

export type ViralTextHit = {
  text: string;
  position: "top" | "middle";
  bold?: boolean | undefined;
  italic?: boolean | undefined;
  /** 0..1 ความคืบหน้าใน window */
  progress: number;
  /** ความยาว window เป็นวินาที */
  span: number;
};

/** หา viral text ที่ควรโชว์ ณ เวลานั้น */
export function viralTextAt(
  time: number,
  scenes: SceneWindow[] | undefined,
  elements:
    | ({
        sceneId: string;
        kind: string;
        enabled: boolean;
        text?: string;
        position?: "top" | "middle";
        bold?: boolean | undefined;
        italic?: boolean | undefined;
      } & ViralTiming)[]
    | undefined,
): ViralTextHit | null {
  if (!scenes?.length || !elements?.length) return null;
  for (const scene of scenes) {
    const element = elements.find((e) => e.sceneId === scene.id && e.kind === "viralText" && e.enabled);
    if (!element?.text?.trim()) continue;
    const win = viralTextWindow(scene, element);
    if (time < win.start - 0.001 || time > win.end + 0.001) continue;
    const span = Math.max(0.001, win.end - win.start);
    return {
      text: element.text.trim(),
      position: element.position ?? "top",
      bold: element.bold,
      italic: element.italic,
      progress: Math.max(0, Math.min(1, (time - win.start) / span)),
      span,
    };
  }
  return null;
}
