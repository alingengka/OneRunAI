import type { Segment } from "./media/audio";

/**
 * CapCut-style cuts of the source video: `cuts` are the times the person
 * split the video at, `removed` the time ranges they deleted (left out of
 * the preview and the export, joined with a hard cut).
 */
export type VideoEdit = { cuts: number[]; removed: Segment[] };
export type VideoPart = { start: number; end: number; removed: boolean };

/** No piece shorter than this is made by a split. */
export const MIN_PART = 0.15;

export const emptyVideoEdit = (): VideoEdit => ({ cuts: [], removed: [] });

/** The pieces between the cuts, each marked when it lies in a removed range. */
export function videoParts(duration: number, edit: VideoEdit): VideoPart[] {
  if (duration <= 0) return [];
  const bounds = [
    0,
    ...edit.cuts.filter((t) => t > 0 && t < duration).sort((a, b) => a - b),
    duration,
  ];
  const parts: VideoPart[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i]!;
    const end = bounds[i + 1]!;
    if (end - start < 1e-6) continue;
    const mid = (start + end) / 2;
    parts.push({ start, end, removed: edit.removed.some((r) => mid > r.start && mid < r.end) });
  }
  return parts;
}

/** Index of the piece at time `t`, or -1. */
export function partAt(parts: VideoPart[], t: number): number {
  return parts.findIndex((p, i) => t >= p.start && (t < p.end || i === parts.length - 1));
}

/** The edit with a cut at `t`, or null when it would leave a sliver (or is off the video). */
export function splitVideo(edit: VideoEdit, t: number, duration: number): VideoEdit | null {
  if (t < MIN_PART || t > duration - MIN_PART) return null;
  if (edit.cuts.some((c) => Math.abs(c - t) < MIN_PART)) return null;
  return { ...edit, cuts: [...edit.cuts, t].sort((a, b) => a - b) };
}

/** Joins overlapping or touching ranges. */
export function mergeRanges(ranges: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const r of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 1e-6) last.end = Math.max(last.end, r.end);
    else out.push({ start: r.start, end: r.end });
  }
  return out;
}

/** The edit with this piece deleted. */
export function removePart(edit: VideoEdit, part: Segment): VideoEdit {
  return { ...edit, removed: mergeRanges([...edit.removed, { start: part.start, end: part.end }]) };
}

/** The edit with this piece brought back (a removed range may shrink or split around it). */
export function restorePart(edit: VideoEdit, part: Segment): VideoEdit {
  const removed: Segment[] = [];
  for (const r of edit.removed) {
    if (part.end <= r.start || part.start >= r.end) {
      removed.push(r);
      continue;
    }
    if (r.start < part.start - 1e-6) removed.push({ start: r.start, end: part.start });
    if (r.end > part.end + 1e-6) removed.push({ start: part.end, end: r.end });
  }
  return { ...edit, removed };
}
