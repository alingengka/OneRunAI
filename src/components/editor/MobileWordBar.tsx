import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  CornerDownLeft,
  Palette,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Word } from "@/lib/captions";
import { editWordAt, lineBreakAfter, newWordAfter, removeWordAt } from "@/lib/word-actions";
import { ColorSwatches } from "./ColorSwatches";

type Props = {
  words: Word[];
  index: number;
  duration: number;
  /** Start and end of the caption line holding the word, for re-transcribing. */
  lineRange: { start: number; end: number };
  busy: boolean;
  onChange: (words: Word[]) => void;
  onSelect: (index: number | null) => void;
  onPreview: (start: number, end: number) => void;
  onRetranscribe: (start: number, end: number) => void;
};

/**
 * Height of the on-screen keyboard. iOS keeps the layout viewport full height
 * and shrinks only the visual viewport, so a fixed sheet has to be lifted by
 * the difference to sit right above the keyboard.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/**
 * Phone toolbar for the selected word (CapCut-style): it replaces the bottom
 * menu, so nothing covers the preview or the timeline while editing.
 */
export function MobileWordBar({
  words,
  index,
  duration,
  lineRange,
  busy,
  onChange,
  onSelect,
  onPreview,
  onRetranscribe,
}: Props) {
  const word = words[index];
  const [sheet, setSheet] = useState<"text" | "color" | null>(null);
  const [draft, setDraft] = useState(word?.text ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboard = useKeyboardInset();

  // A different word was picked: close any sheet and start from its text.
  useEffect(() => {
    setSheet(null);
    setDraft(words[index]?.text ?? "");
    // Only when the selection moves, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    if (sheet === "text") inputRef.current?.focus();
  }, [sheet]);

  if (!word) return null;

  const saveText = () => {
    const text = draft.trim();
    if (text && text !== word.text) onChange(editWordAt(words, index, { text }, duration));
    setSheet(null);
  };

  const tools: {
    id: string;
    label: string;
    icon: LucideIcon;
    run: () => void;
    danger?: boolean;
    spin?: boolean;
  }[] = [
    {
      id: "text",
      label: "แก้คำ",
      icon: Pencil,
      run: () => {
        setDraft(word.text);
        setSheet("text");
      },
    },
    {
      id: "color",
      label: "สีคำ",
      icon: Palette,
      run: () => setSheet(sheet === "color" ? null : "color"),
    },
    {
      id: "delete",
      label: "ลบ",
      icon: Trash2,
      danger: true,
      run: () => {
        onChange(removeWordAt(words, index));
        onSelect(null);
      },
    },
    { id: "play", label: "ฟัง", icon: Play, run: () => onPreview(word.start, word.end) },
    {
      id: "break",
      label: "ขึ้นบรรทัด",
      icon: CornerDownLeft,
      run: () => onChange(lineBreakAfter(words, index, duration)),
    },
    {
      id: "add",
      label: "เพิ่มคำ",
      icon: Plus,
      run: () => {
        onChange(newWordAfter(words, index, duration));
        onSelect(index + 1);
      },
    },
    {
      id: "redo",
      label: "ถอดใหม่",
      icon: RefreshCw,
      spin: busy,
      run: () => onRetranscribe(lineRange.start, lineRange.end),
    },
  ];

  return (
    <>
      {sheet === "text" && (
        <div
          className="fixed inset-x-0 z-50 border-t border-border bg-card px-3 pb-3 pt-2 shadow-[0_-12px_32px_-16px_rgba(0,0,0,0.5)] lg:hidden"
          style={{ bottom: keyboard > 0 ? keyboard : "calc(3.5rem + env(safe-area-inset-bottom))" }}
        >
          <p className="mb-1.5 text-xs text-muted-foreground">
            แก้คำ · {word.start.toFixed(2)}–{word.end.toFixed(2)} วิ
          </p>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveText();
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={saveText}
              enterKeyHint="done"
              aria-label="ข้อความของคำ"
              className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-base outline-none focus:border-primary"
            />
            <button
              type="submit"
              aria-label="บันทึกคำ"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
            >
              <Check className="h-5 w-5" />
            </button>
          </form>
        </div>
      )}

      {sheet === "color" && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 border-t border-border bg-card px-3 pb-3 pt-2 lg:hidden">
          <p className="mb-1.5 text-xs text-muted-foreground">สีของคำ “{word.text}”</p>
          <ColorSwatches
            label="สีของคำนี้"
            value={word.color}
            resetLabel="ตามสไตล์"
            onChange={(color) => onChange(editWordAt(words, index, { color }, duration))}
          />
        </div>
      )}

      <nav
        aria-label={`เครื่องมือของคำ ${word.text}`}
        className="fixed inset-x-0 bottom-0 z-50 flex h-14 items-stretch border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="เลิกเลือกคำ"
          className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border text-[11px] text-muted-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
          กลับ
        </button>
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tools.map(({ id, label, icon: Icon, run, danger, spin }) => (
            <button
              key={id}
              type="button"
              onClick={run}
              aria-pressed={sheet === id ? true : undefined}
              className={cn(
                "flex min-w-[3.6rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px]",
                danger ? "text-destructive" : sheet === id ? "text-primary" : "text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", spin && "animate-spin")} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
