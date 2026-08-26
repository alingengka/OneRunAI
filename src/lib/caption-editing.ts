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
  return words.map((word) => word.text).join(" ");
}