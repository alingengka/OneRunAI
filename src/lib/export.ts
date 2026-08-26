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
      const text = g.words.map((w) => (w.text === "\u2028" ? "\n" : w.text)).join(" ").replace(/ ?\n ?/g, "\n");
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
        text: g.words.map((w) => (w.text === "\u2028" ? "\n" : w.text)).join(" ").replace(/ ?\n ?/g, "\n"),
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
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}


/** Final Cut Pro XML with the kept (non-silent) segments as a cut timeline.
 *  CapCut desktop / Premiere / Resolve can import this to get the same cuts. */
export function buildFcpxml(params: {
  clipName: string;
  duration: number;
  keep: Segment[];
  fps?: number;
  width?: number;
  height?: number;
}): string {
  const fps = params.fps ?? 30;
  const w = params.width ?? 1080;
  const h = params.height ?? 1920;
  const frames = (t: number) => Math.max(0, Math.round(t * fps));
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
  const name = esc(params.clipName);

  let rec = 0;
  const items = params.keep
    .map((s, i) => {
      const dur = frames(s.end) - frames(s.start);
      const start = rec;
      rec += dur;
      return `        <clipitem id="clip-${i + 1}">
          <name>${name}</name>
          <duration>${frames(params.duration)}</duration>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <start>${start}</start>
          <end>${start + dur}</end>
          <in>${frames(s.start)}</in>
          <out>${frames(s.end)}</out>
          <file id="file-1">
            <name>${name}</name>
            <pathurl>./${name}</pathurl>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <duration>${frames(params.duration)}</duration>
            <media><video><samplecharacteristics><width>${w}</width><height>${h}</height></samplecharacteristics></video><audio><channelcount>2</channelcount></audio></media>
          </file>
        </clipitem>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="seq-1">
    <name>${name} (silence removed)</name>
    <duration>${rec}</duration>
    <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
    <media>
      <video>
        <format><samplecharacteristics><width>${w}</width><height>${h}</height></samplecharacteristics></format>
        <track>
${items}
        </track>
      </video>
    </media>
  </sequence>
</xmeml>
`;
}
