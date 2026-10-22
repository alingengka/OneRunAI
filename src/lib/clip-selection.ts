/** A clip's place on the timeline (seconds). */
export type TimedClip = { id: string; start: number; end: number };

/**
 * How far a set of selected clips may move together (seconds, negative is
 * earlier). Caption lines share one row and stay in order, so a selected
 * line stops at the nearest line that is not selected; free texts may
 * overlap anything and only stay inside the video.
 */
export function groupMoveLimits(
  captions: TimedClip[],
  texts: TimedClip[],
  selectedCaptions: ReadonlySet<string>,
  selectedTexts: ReadonlySet<string>,
  duration: number,
): { min: number; max: number } {
  let min = -Infinity;
  let max = Infinity;
  const lines = [...captions].sort((a, b) => a.start - b.start);
  lines.forEach((line, i) => {
    if (!selectedCaptions.has(line.id)) return;
    let before = i - 1;
    while (before >= 0 && selectedCaptions.has(lines[before]!.id)) before--;
    let after = i + 1;
    while (after < lines.length && selectedCaptions.has(lines[after]!.id)) after++;
    min = Math.max(min, (before >= 0 ? lines[before]!.end : 0) - line.start);
    max = Math.min(max, (after < lines.length ? lines[after]!.start : duration) - line.end);
  });
  for (const text of texts) {
    if (!selectedTexts.has(text.id)) continue;
    min = Math.max(min, -text.start);
    max = Math.min(max, duration - text.end);
  }
  if (min === -Infinity) min = 0;
  if (max === Infinity) max = 0;
  // already squeezed (overlapping input): stay put rather than jump
  return min <= max ? { min, max } : { min: 0, max: 0 };
}

/** Clips whose span meets [t0, t1] and whose row meets [r0, r1] (a box drawn on the timeline). */
export function clipsInBox<T extends TimedClip & { row: number }>(
  clips: T[],
  t0: number,
  t1: number,
  r0: number,
  r1: number,
): T[] {
  const [a, b] = t0 <= t1 ? [t0, t1] : [t1, t0];
  const [lo, hi] = r0 <= r1 ? [r0, r1] : [r1, r0];
  return clips.filter((c) => c.start < b && c.end > a && c.row >= lo && c.row <= hi);
}
