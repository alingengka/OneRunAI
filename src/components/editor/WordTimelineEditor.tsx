import { useMemo, useState } from "react";
import { Merge, Play, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { findSyncIssues, normalizeWordTimes } from "@/lib/caption-editing";
import type { Word } from "@/lib/captions";

type Props = {
  words: Word[];
  duration: number;
  onChange: (words: Word[]) => void;
  onPreview: (start: number, end: number) => void;
  onRetryIssues: (issues: ReturnType<typeof findSyncIssues>) => void;
  retrying: boolean;
};

export function WordTimelineEditor({ words, duration, onChange, onPreview, onRetryIssues, retrying }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const issues = useMemo(() => findSyncIssues(words, duration), [words, duration]);
  const first = selected.length ? Math.min(...selected) : -1;
  const last = selected.length ? Math.max(...selected) : -1;
  const active = first >= 0 ? words[first] : undefined;

  const update = (index: number, patch: Partial<Word>) => {
    const next = words.map((word, i) => (i === index ? { ...word, ...patch } : word));
    onChange(normalizeWordTimes(next, duration));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">ไทม์ไลน์ระดับคำ</p>
          <p className="text-xs text-muted-foreground">คลิกคำเพื่อแก้ หรือ Shift+คลิกเพื่อเลือกเป็นช่วง</p>
        </div>
        <Button size="sm" variant="secondary" disabled={!words.length || retrying} onClick={() => onRetryIssues(issues)}>
          {retrying ? "กำลังตรวจ…" : "ตรวจซิงก์แล้วลองใหม่"}
        </Button>
      </div>

      {issues.length > 0 && (
        <div className="space-y-2 border-l-2 border-destructive pl-3">
          <p className="text-xs font-medium text-destructive">พบช่วงที่ควรตรวจ {issues.length} จุด</p>
          <div className="flex flex-wrap gap-2">
            {issues.slice(0, 12).map((issue) => (
              <Button key={`${issue.index}-${issue.start}`} size="sm" variant="outline" onClick={() => onPreview(issue.start, issue.end)}>
                <Play className="h-3 w-3" /> {issue.start.toFixed(2)}s · {issue.reason}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-preview p-3">
        <div className="flex flex-wrap gap-2">
          {words.map((word, index) => (
            <button
              key={`${index}-${word.start}`}
              type="button"
              onClick={(event) => {
                if (event.shiftKey && first >= 0) {
                  const from = Math.min(first, index);
                  const to = Math.max(first, index);
                  setSelected(Array.from({ length: to - from + 1 }, (_, i) => from + i));
                } else setSelected([index]);
                onPreview(word.start, word.end);
              }}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs shadow-sm transition-colors",
                selected.includes(index)
                  ? "border-primary bg-primary/15 ring-1 ring-primary/30"
                  : "border-primary/25 bg-card hover:border-primary/60 hover:bg-accent",
                issues.some((issue) => issue.index === index) && "border-destructive",
                word.confidenceLabel === "review" && "border-muted-foreground",
                word.confidenceLabel === "low" && "border-destructive bg-destructive/10",
              )}
              title={typeof word.confidence === "number" ? `ความมั่นใจ ${Math.round(word.confidence * 100)}%` : undefined}
            >
              {word.text}
              <span className="ml-1 font-mono text-[9px] text-muted-foreground">{word.start.toFixed(2)}</span>
              {typeof word.confidence === "number" && (
                <span className="ml-1 text-[9px] text-muted-foreground">{Math.round(word.confidence * 100)}%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {active && (
        <div className="grid gap-3 sm:grid-cols-[1fr_110px_110px]">
          <div className="space-y-1.5">
            <Label>ข้อความที่เลือก</Label>
            <Input value={selected.map((i) => words[i]?.text ?? "").join(" ")} onChange={(event) => {
              if (selected.length !== 1) return;
              update(first, { text: event.target.value });
            }} />
          </div>
          <div className="space-y-1.5"><Label>เริ่ม (วินาที)</Label><Input type="number" step="0.01" value={active.start.toFixed(2)} onChange={(e) => update(first, { start: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>จบ (วินาที)</Label><Input type="number" step="0.01" value={(words[last]?.end ?? active.end).toFixed(2)} onChange={(e) => update(last, { end: Number(e.target.value) })} /></div>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={selected.length !== 1 || !active?.text.includes(" ")} onClick={() => {
          const selectedWord = words[first];
          if (!selectedWord) return;
          const parts = selectedWord.text.split(/\s+/).filter(Boolean);
          if (parts.length < 2) return;
          const span = selectedWord.end - selectedWord.start;
          const replacements = parts.map((text, i) => ({ text, start: selectedWord.start + span * i / parts.length, end: selectedWord.start + span * (i + 1) / parts.length }));
          onChange([...words.slice(0, first), ...replacements, ...words.slice(first + 1)]);
          setSelected([]);
        }}><Scissors className="h-3.5 w-3.5" /> แยกคำ</Button>
        <Button size="sm" variant="secondary" disabled={selected.length < 2} onClick={() => {
          const merged = { text: words.slice(first, last + 1).map((w) => w.text).join(" "), start: words[first]?.start ?? 0, end: words[last]?.end ?? 0 };
          onChange([...words.slice(0, first), merged, ...words.slice(last + 1)]);
          setSelected([first]);
        }}><Merge className="h-3.5 w-3.5" /> รวมคำ</Button>
      </div>
    </div>
  );
}