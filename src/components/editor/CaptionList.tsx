import { memo, useEffect, useRef } from "react";
import { CornerDownLeft, Play, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { LINE_BREAK, type CaptionGroup, type Word } from "@/lib/captions";
import { editWordAt, lineBreakAfter, newWordAfter, removeWordAt } from "@/lib/word-actions";
import { ColorSwatches } from "./ColorSwatches";

type Props = {
  groups: CaptionGroup[];
  /** Full word list; groups hold the same word objects. */
  words: Word[];
  duration: number;
  /** index of the caption shown at the playhead, -1 for none */
  activeIndex: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
  onSeek: (time: number) => void;
  onPreview: (start: number, end: number) => void;
  onChange: (words: Word[]) => void;
  onRetranscribe: (start: number, end: number) => void;
  busy: boolean;
  /**
   * Open the per-word popover on selection (desktop). On phones the word
   * toolbar at the bottom edits the selected word instead.
   */
  popoverEdit?: boolean;
};

function fmtTime(t: number) {
  return t.toFixed(2);
}

/** Caption lines with per-word editing in a popover (Submagic-style). */
function CaptionListView({
  groups,
  words,
  duration,
  activeIndex,
  selected,
  onSelect,
  onSeek,
  onPreview,
  onChange,
  onRetranscribe,
  busy,
  popoverEdit = true,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedWord = selected != null ? words[selected] : undefined;

  // Scroll the line holding the selected word into view.
  useEffect(() => {
    if (selected == null) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-word-index="${selected}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const editWord = (index: number, patch: Partial<Word>) => {
    onChange(editWordAt(words, index, patch, duration));
  };

  const removeAt = (index: number) => {
    onChange(removeWordAt(words, index));
    onSelect(null);
  };

  if (!groups.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        ยังไม่มีซับ — อัปโหลดคลิปแล้วกด “สร้างซับด้วย AI” ในเมนูเครื่องมือ AI
      </p>
    );
  }

  return (
    <div ref={listRef} className="space-y-1.5">
      {groups.map((group, gi) => {
        const active = gi === activeIndex;
        return (
          <div
            key={`${gi}-${group.start}`}
            className={cn(
              "rounded-xl border px-3 py-2.5 transition-colors",
              active
                ? "border-primary/50 bg-primary/10"
                : "border-transparent hover:bg-secondary/60",
            )}
          >
            <button
              type="button"
              onClick={() => onSeek(group.start)}
              className="mb-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              {fmtTime(group.start)} – {fmtTime(group.end)}
            </button>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold leading-relaxed">
              {group.words.map((word) => {
                const index = words.indexOf(word);
                if (index < 0) return null;
                if (word.text === LINE_BREAK) {
                  return (
                    <button
                      key={`br-${index}`}
                      type="button"
                      aria-label="ลบการขึ้นบรรทัดใหม่"
                      title="ลบการขึ้นบรรทัดใหม่"
                      onClick={() => removeAt(index)}
                      className="rounded px-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <CornerDownLeft className="h-3.5 w-3.5" />
                    </button>
                  );
                }
                const isSelected = selected === index;
                return (
                  <Popover
                    key={`${index}-${word.start}`}
                    open={isSelected && popoverEdit}
                    onOpenChange={(open) => {
                      if (!open && isSelected) onSelect(null);
                    }}
                  >
                    <PopoverAnchor asChild>
                      <button
                        type="button"
                        data-word-index={index}
                        onClick={() => {
                          onSelect(index);
                          onSeek(word.start);
                        }}
                        className={cn(
                          "rounded-md px-1 transition-colors",
                          isSelected
                            ? "bg-amber-400/15 text-amber-800 outline outline-2 outline-amber-400 dark:text-amber-100"
                            : "hover:bg-secondary",
                          !isSelected &&
                            word.confidenceLabel === "low" &&
                            "underline decoration-amber-500 decoration-wavy underline-offset-[6px]",
                        )}
                        title={
                          typeof word.confidence === "number"
                            ? `ความมั่นใจ ${Math.round(word.confidence * 100)}%`
                            : undefined
                        }
                      >
                        <span
                          style={
                            word.color
                              ? {
                                  textDecorationLine: "underline",
                                  textDecorationColor: word.color,
                                  textDecorationThickness: 3,
                                  textUnderlineOffset: 6,
                                }
                              : undefined
                          }
                        >
                          {word.text}
                        </span>
                      </button>
                    </PopoverAnchor>
                    {isSelected && popoverEdit && selectedWord && (
                      <PopoverContent
                        align="start"
                        className="w-80 space-y-3"
                        onOpenAutoFocus={(event) => event.preventDefault()}
                        onInteractOutside={(event) => {
                          // Dragging the word's edges on the timeline keeps it selected.
                          const target = event.target as HTMLElement | null;
                          if (target?.closest("[data-word-track]")) event.preventDefault();
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">แก้คำ</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label="ปิด"
                            onClick={() => onSelect(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`word-text-${index}`}
                            className="text-xs text-muted-foreground"
                          >
                            ข้อความ
                          </Label>
                          <Input
                            id={`word-text-${index}`}
                            value={selectedWord.text}
                            onChange={(event) => editWord(index, { text: event.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`word-start-${index}`}
                              className="text-xs text-muted-foreground"
                            >
                              เริ่ม (วินาที)
                            </Label>
                            <Input
                              id={`word-start-${index}`}
                              type="number"
                              step="0.01"
                              value={selectedWord.start.toFixed(2)}
                              onChange={(event) =>
                                editWord(index, { start: Number(event.target.value) })
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label
                              htmlFor={`word-end-${index}`}
                              className="text-xs text-muted-foreground"
                            >
                              จบ (วินาที)
                            </Label>
                            <Input
                              id={`word-end-${index}`}
                              type="number"
                              step="0.01"
                              value={selectedWord.end.toFixed(2)}
                              onChange={(event) =>
                                editWord(index, { end: Number(event.target.value) })
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground">สีของคำนี้</span>
                          <ColorSwatches
                            label="สีของคำนี้"
                            value={selectedWord.color}
                            resetLabel="ตามสไตล์"
                            onChange={(color) => editWord(index, { color })}
                          />
                        </div>
                        <div className="grid gap-1 border-t border-border pt-2">
                          <Button
                            variant="ghost"
                            className="justify-start"
                            onClick={() => onPreview(selectedWord.start, selectedWord.end)}
                          >
                            <Play className="mr-2 h-4 w-4" /> ฟังคำนี้
                          </Button>
                          <Button
                            variant="ghost"
                            className="justify-start"
                            onClick={() => onChange(lineBreakAfter(words, index, duration))}
                          >
                            <CornerDownLeft className="mr-2 h-4 w-4" /> ขึ้นบรรทัดใหม่หลังคำนี้
                          </Button>
                          <Button
                            variant="ghost"
                            className="justify-start"
                            onClick={() => {
                              onChange(newWordAfter(words, index, duration));
                              onSelect(index + 1);
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" /> เพิ่มคำหลังคำนี้
                          </Button>
                          <Button
                            variant="ghost"
                            className="justify-start"
                            disabled={busy}
                            onClick={() => onRetranscribe(group.start, group.end)}
                          >
                            <RefreshCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} />
                            ถอดเสียงบรรทัดนี้ใหม่
                          </Button>
                          <Button
                            variant="ghost"
                            className="justify-start text-destructive hover:text-destructive"
                            onClick={() => removeAt(index)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> ลบคำ
                          </Button>
                        </div>
                      </PopoverContent>
                    )}
                  </Popover>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Re-renders only when the captions, selection or active line change, not
 * on every playback frame. Handlers come from the editor and only matter
 * together with those values, so a stale handler is never called with
 * stale data.
 */
export const CaptionList = memo(CaptionListView, (prev, next) =>
  (Object.keys(next) as (keyof Props)[]).every(
    (key) => typeof next[key] === "function" || prev[key] === next[key],
  ),
);
