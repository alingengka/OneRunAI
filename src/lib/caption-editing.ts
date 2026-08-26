import type { Word } from "./captions";

export type SyncIssue = {
  index: number;
  start: number;
  end: number;
  reason: string;
};

export function findSyncIssues(words: Word[], duration: number): SyncIssue[] {
  return words.flatMap((word, index) => {
    const previous = words[index - 1];
    const length = word.end - word.start;
    const reasons: string[] = [];
    if (word.start < 0 || word.end > duration + 0.02) reasons.push("เวลาอยู่นอกคลิป");
    if (length < 0.06) reasons.push("สั้นเกินไป");
    if (length > 2.4) reasons.push("ยาวเกินไป");
    if (previous && word.start < previous.end - 0.01) reasons.push("เวลาทับคำก่อนหน้า");
    if (previous && word.start - previous.end > 1.2) reasons.push("มีช่องว่างยาว");
    return reasons.length ? [{ index, start: word.start, end: word.end, reason: reasons.join(" · ") }] : [];
  });
}

export function normalizeWordTimes(words: Word[], duration: number): Word[] {
  return words.map((word, index) => {
    const previousEnd = index ? words[index - 1]?.end ?? 0 : 0;
    const nextStart = words[index + 1]?.start ?? duration;
    const start = Math.max(previousEnd, Math.min(word.start, duration));
    const end = Math.max(start + 0.06, Math.min(word.end, nextStart, duration));
    return { ...word, start, end };
  });
}

export function wordsToTranscript(words: Word[]): string {
  return words
    .map((word) => (word.text === "\u2028" ? "\n" : word.text))
    .join(" ")
    .replace(/ ?\n ?/g, "\n");
}

// ── รีซิงก์ข้อความที่แก้บนพรีวิวให้ตรงกับช่วงเสียงพูดจริง ─────────────────
import { LINE_BREAK, tokenizeWords, alignWordsToSegments } from "./captions";
import type { Segment } from "./media/audio";

/** สร้างคำจากหลายแถว โดยกระจายเวลาไปตามช่วงเสียงพูดจริงในช่วงเวลานั้น */
export function buildRowWords(
  rows: string[],
  start: number,
  end: number,
  segments: Segment[],
): Word[] {
  const span = Math.max(0.12, end - start);
  const local = segments
    .map((s) => ({ start: Math.max(s.start, start), end: Math.min(s.end, end) }))
    .filter((s) => s.end - s.start > 0.02);
  const useSegs = local.length ? local : [{ start, end: start + span }];

  const joined = rows.join(" ");
  const aligned = alignWordsToSegments(joined, useSegs, span);
  const counts = rows.map((r) => tokenizeWords(r).length);

  const out: Word[] = [];
  let cursor = 0;
  counts.forEach((count, rowIndex) => {
    if (rowIndex > 0) {
      const t = aligned[cursor]?.start ?? end;
      out.push({ text: LINE_BREAK, start: t, end: t });
    }
    for (let i = 0; i < count; i++) {
      const w = aligned[cursor + i];
      if (w) out.push(w);
    }
    cursor += count;
  });
  return out;
}

export type SyncStatus = { score: number; label: string; tone: "good" | "ok" | "bad" };

/** ประเมินความแม่นยำของการซิงก์ซับกับเสียงพูด */
export function syncAccuracy(words: Word[], segments: Segment[], duration: number): SyncStatus {
  const visible = words.filter((w) => w.text !== LINE_BREAK);
  if (!visible.length) return { score: 0, label: "ยังไม่มีซับ", tone: "bad" };
  if (!segments.length) return { score: 0, label: "ยังไม่ได้วิเคราะห์เสียง", tone: "bad" };

  const onSpeech = visible.filter((w) =>
    segments.some(
      (s) => Math.min(s.end, w.end) - Math.max(s.start, w.start) > (w.end - w.start) * 0.5,
    ),
  ).length;
  const coverage = onSpeech / visible.length;
  const issues = findSyncIssues(words, duration).length;
  const penalty = Math.min(0.4, (issues / visible.length) * 0.6);
  const score = Math.max(0, Math.min(1, coverage - penalty));
  const pct = Math.round(score * 100);
  if (score >= 0.85) return { score, label: `ตรงเสียงพูด ~${pct}%`, tone: "good" };
  if (score >= 0.6) return { score, label: `พอใช้ ~${pct}% (${issues} จุดควรตรวจ)`, tone: "ok" };
  return { score, label: `ยังไม่ตรง ~${pct}% (${issues} จุดควรตรวจ)`, tone: "bad" };
}
