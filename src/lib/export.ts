import type { Segment } from "./media/audio";
import type { CaptionGroup } from "./captions";

export function keptDuration(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + (s.end - s.start), 0);
}

/** Map a source timestamp onto the trimmed (silence-removed) timeline. */
export function mapToTrimmed(t: number, segments: Segment[]): number {
  let acc = 0;
  for (const s of segments) {
    if (t < s.start) return acc;
    if (t <= s.end) return acc + (t - s.start);
    acc += s.end - s.start;
  }
  return acc;
}

function ts(seconds: number, comma = true): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${comma ? "," : "."}${pad(ms, 3)}`;
}

function tc(seconds: number, fps = 30): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const f = Math.floor((total - Math.floor(total)) * fps);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

export function buildSrt(groups: CaptionGroup[], remap?: (t: number) => number): string {
  const f = remap ?? ((t: number) => t);
  return groups
    .map((g, i) => {
      const text = g.words.map((w) => w.text).join(" ");
      return `${i + 1}\n${ts(f(g.start))} --> ${ts(Math.max(f(g.end), f(g.start) + 0.3))}\n${text}\n`;
    })
    .join("\n");
}

export function buildEdl(segments: Segment[], clipName: string, fps = 30): string {
  const header = `TITLE: ${clipName}\nFCM: NON-DROP FRAME\n\n`;
  let recordCursor = 0;
  const events = segments.map((s, i) => {
    const dur = s.end - s.start;
    const line =
      `${String(i + 1).padStart(3, "0")}  AX       V     C        ` +
      `${tc(s.start, fps)} ${tc(s.end, fps)} ${tc(recordCursor, fps)} ${tc(recordCursor + dur, fps)}\n` +
      `* FROM CLIP NAME: ${clipName}\n`;
    recordCursor += dur;
    return line;
  });
  return header + events.join("\n");
}

export function buildCutListJson(params: {
  clipName: string;
  duration: number;
  keep: Segment[];
  removed: Segment[];
  groups: CaptionGroup[];
}): string {
  return JSON.stringify(
    {
      version: 1,
      target: "capcut",
      source: { name: params.clipName, duration: params.duration },
      keepSegments: params.keep,
      removedSilences: params.removed,
      captions: params.groups.map((g) => ({
        start: g.start,
        end: g.end,
        text: g.words.map((w) => w.text).join(" "),
        words: g.words,
      })),
    },
    null,
    2,
  );
}

export function download(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
