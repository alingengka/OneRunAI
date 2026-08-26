import { LINE_BREAK, type Word } from "./captions";
import type { Segment } from "./media/audio";

export type WordReport = {
  index: number;
  text: string;
  start: number;
  end: number;
  confidence: number | null;
  label: "high" | "review" | "low";
  reasons: string[];
};

export type SpanReport = {
  start: number;
  end: number;
  words: WordReport[];
  score: number | null;
  low: number;
  review: number;
  worst: string | null;
};

export type AccuracyReport = {
  overall: number | null;
  spans: SpanReport[];
  problems: WordReport[];
  counts: { high: number; review: number; low: number };
};

const LAO = /[\u0e80-\u0eff]/;
const THAI = /[\u0e00-\u0e7f]/;

function reasonsFor(word: Word, previous: Word | undefined, segments: Segment[], duration: number, language: string): string[] {
  const reasons: string[] = [];
  const length = word.end - word.start;
  const confidence = typeof word.confidence === "number" ? word.confidence : null;
  if (confidence !== null && confidence < 0.52) reasons.push("โมเดลมั่นใจต่ำในเสียงช่วงนี้");
  else if (confidence !== null && confidence < 0.78) reasons.push("เสียงคลุมเครือ ควรฟังตรวจ");
  const onSpeech = segments.some((s) => Math.min(s.end, word.end) - Math.max(s.start, word.start) > length * 0.5);
  if (segments.length && !onSpeech) reasons.push("เวลาของคำไม่ทับช่วงที่มีเสียงพูด");
  if (length < 0.06) reasons.push("ช่วงคำสั้นผิดปกติ (อาจ alignment เพี้ยน)");
  if (length > 2.4) reasons.push("ช่วงคำยาวผิดปกติ (อาจรวมหลายคำ)");
  if (word.start < 0 || word.end > duration + 0.02) reasons.push("เวลาอยู่นอกความยาวคลิป");
  if (previous && word.start < previous.end - 0.01) reasons.push("เวลาซ้อนทับคำก่อนหน้า");
  if (previous && word.start - previous.end > 1.2) reasons.push("มีช่องว่างยาวก่อนคำนี้");
  if (language === "lo") {
    const lao = (word.text.match(/[\u0e80-\u0eff]/g) ?? []).length;
    const thai = (word.text.match(/[\u0e00-\u0e7f]/g) ?? []).length - lao;
    if (THAI.test(word.text) && !LAO.test(word.text)) reasons.push("ถอดออกมาเป็นอักษรไทยแทนอักษรลาว");
    else if (thai > 0 && lao > 0) reasons.push("มีอักษรไทยปนในคำภาษาลาว");
  }
  return reasons;
}

export function buildAccuracyReport(
  words: Word[],
  segments: Segment[],
  duration: number,
  language: string,
  spanSeconds = 5,
): AccuracyReport {
  const reports: WordReport[] = [];
  words.forEach((word, index) => {
    if (word.text === LINE_BREAK) return;
    const confidence = typeof word.confidence === "number" ? word.confidence : null;
    const reasons = reasonsFor(word, words[index - 1], segments, duration, language);
    const label: WordReport["label"] =
      word.confidenceLabel ?? (confidence === null ? (reasons.length ? "review" : "high") : confidence >= 0.78 ? "high" : confidence >= 0.52 ? "review" : "low");
    reports.push({ index, text: word.text, start: word.start, end: word.end, confidence, label, reasons });
  });

  const scored = reports.filter((report) => report.confidence !== null);
  const overall = scored.length ? scored.reduce((sum, report) => sum + (report.confidence ?? 0), 0) / scored.length : null;
  const total = Math.max(duration, reports.at(-1)?.end ?? 0);
  const spans: SpanReport[] = [];
  for (let start = 0; start < total; start += spanSeconds) {
    const end = Math.min(total, start + spanSeconds);
    const inside = reports.filter((report) => report.start >= start - 0.001 && report.start < end);
    if (!inside.length) continue;
    const spanScored = inside.filter((report) => report.confidence !== null);
    const worstWord = [...inside].sort((a, b) => (a.confidence ?? 1) - (b.confidence ?? 1))[0];
    spans.push({
      start,
      end,
      words: inside,
      score: spanScored.length ? spanScored.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / spanScored.length : null,
      low: inside.filter((report) => report.label === "low").length,
      review: inside.filter((report) => report.label === "review").length,
      worst: worstWord?.reasons[0] ?? null,
    });
  }

  return {
    overall,
    spans,
    problems: reports.filter((report) => report.label !== "high" || report.reasons.length),
    counts: {
      high: reports.filter((report) => report.label === "high").length,
      review: reports.filter((report) => report.label === "review").length,
      low: reports.filter((report) => report.label === "low").length,
    },
  };
}
