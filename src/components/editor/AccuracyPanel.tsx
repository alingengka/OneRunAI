import { useMemo, useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildAccuracyReport } from "@/lib/accuracy-report";
import type { Word } from "@/lib/captions";
import type { Segment } from "@/lib/media/audio";

type Props = {
  words: Word[];
  segments: Segment[];
  duration: number;
  language: string;
  busy: boolean;
  onPreview: (start: number, end: number) => void;
  onRetranscribe: (start: number, end: number) => void;
  onRetranscribeAllWeak: () => void;
};

const TONE: Record<string, string> = {
  high: "border-primary/40 bg-primary/10",
  review: "border-muted-foreground/40 bg-secondary",
  low: "border-destructive bg-destructive/10",
};

export function AccuracyPanel({ words, segments, duration, language, busy, onPreview, onRetranscribe, onRetranscribeAllWeak }: Props) {
  const [only, setOnly] = useState(true);
  const report = useMemo(
    () => buildAccuracyReport(words, segments, duration, language),
    [words, segments, duration, language],
  );
  const spans = only ? report.spans.filter((span) => span.low + span.review > 0) : report.spans;

  if (!words.length) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีซับให้วิเคราะห์ — กด “สร้างซับด้วย AI” ก่อน</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">ความแม่นยำโดยรวม</p>
            <p className="text-xs text-muted-foreground">
              {report.overall === null ? "ยังไม่มีคะแนนความมั่นใจ" : `เฉลี่ย ${Math.round(report.overall * 100)}%`} ·
              {" "}มั่นใจสูง {report.counts.high} · ควรตรวจ {report.counts.review} · ต่ำ {report.counts.low}
            </p>
          </div>
          <Button size="sm" disabled={busy || !report.problems.length} onClick={onRetranscribeAllWeak}>
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> ถอดใหม่เฉพาะจุดอ่อน
          </Button>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((report.overall ?? 0) * 100)}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">รายละเอียดต่อช่วงเวลา (ทุก 5 วินาที)</p>
        <Button size="sm" variant="ghost" onClick={() => setOnly((value) => !value)}>
          {only ? "แสดงทุกช่วง" : "แสดงเฉพาะช่วงที่ควรแก้"}
        </Button>
      </div>

      <div className="space-y-3">
        {spans.map((span) => (
          <div key={span.start} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">
                {span.start.toFixed(1)}s – {span.end.toFixed(1)}s
                <span className="ml-2 text-xs text-muted-foreground">
                  {span.score === null ? "ไม่มีคะแนน" : `${Math.round(span.score * 100)}%`} · ต่ำ {span.low} · ตรวจ {span.review}
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => onPreview(span.start, span.end)}>
                  <Play className="h-3 w-3" /> ฟัง
                </Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRetranscribe(span.start, span.end)}>
                  <RefreshCw className={cn("h-3 w-3", busy && "animate-spin")} /> ถอดใหม่ช่วงนี้
                </Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {span.words.map((word) => (
                <button
                  key={`${word.index}-${word.start}`}
                  type="button"
                  onClick={() => onPreview(word.start, word.end)}
                  title={word.reasons.join(" · ") || "ปกติ"}
                  className={cn("rounded-md border px-2 py-1 text-xs", TONE[word.label])}
                >
                  {word.text}
                  <span className="ml-1 font-mono text-[9px] text-muted-foreground">
                    {word.confidence === null ? "—" : `${Math.round(word.confidence * 100)}%`}
                  </span>
                </button>
              ))}
            </div>
            {span.words.some((word) => word.reasons.length) && (
              <ul className="mt-2 space-y-1 border-l-2 border-destructive pl-3 text-[11px] text-muted-foreground">
                {span.words
                  .filter((word) => word.reasons.length)
                  .slice(0, 6)
                  .map((word) => (
                    <li key={`r-${word.index}`}>
                      <span className="font-medium text-foreground">{word.text}</span> — {word.reasons.join(" · ")}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        ))}
        {!spans.length && <p className="text-sm text-muted-foreground">ไม่พบช่วงที่ต้องแก้ไข</p>}
      </div>
    </div>
  );
}
