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
    return { id: `${index}-${start.toFixed(2)}`, index, start, end, segments: segs, text };
  });
}

export function sceneDuration(scene: Scene) {
  return scene.segments.reduce((n, s) => n + (s.end - s.start), 0);
}

export function isInScenes(time: number, scenes: Scene[]) {
  return scenes.some((scene) => time >= scene.start - 0.001 && time <= scene.end + 0.001);
}
