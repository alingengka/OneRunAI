import {
  CornerDownLeft,
  MousePointerClick,
  Play,
  Plus,
  RefreshCw,
  Scissors,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CaptionStyle, Word } from "@/lib/captions";
import type { Sticker } from "@/lib/media/stickers";
import { editWordAt, lineBreakAfter, newWordAfter, removeWordAt } from "@/lib/word-actions";
import { ColorSwatches } from "./ColorSwatches";
import { CaptionColorControls, CaptionLayoutControls } from "./CaptionLayoutControls";
import { TextClipEditor } from "./TextClipEditor";

export type ClipEditing = {
  key: string;
  title: string;
  text: string;
  look: CaptionStyle;
  live: boolean;
  onText: (text: string) => void;
  onStyle: (patch: Partial<CaptionStyle>) => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDone: () => void;
};

type Props = {
  words: Word[];
  duration: number;
  selectedWord: number | null;
  /** Caption line around the selected word. */
  lineRange: { start: number; end: number };
  sticker: Sticker | null;
  stickerLabel: string;
  style: CaptionStyle;
  busy: boolean;
  onWordsChange: (words: Word[]) => void;
  onSelectWord: (index: number | null) => void;
  onPreview: (start: number, end: number) => void;
  onRetranscribe: (start: number, end: number) => void;
  onStickerChange: (id: string, patch: Partial<Sticker>) => void;
  onStickerRemove: (id: string) => void;
  onStickerDuplicate: (id: string) => void;
  onStickerSplit: (id: string) => void;
  onOpenStickers: () => void;
  onStyleChange: (patch: Partial<CaptionStyle>) => void;
<<<<<<< HEAD
  /** closes the panel (clears the selection) */
  onClose?: (() => void) | undefined;
=======
>>>>>>> origin/claude/happy-fermat-13d9xo
  /** the selected text clip (caption line or free text), edited CapCut-style */
  clip?: ClipEditing | null | undefined;
  className?: string;
};

/**
 * Desktop right panel (CapCut-style): settings for whatever is selected on the
 * timeline, or the caption look when nothing is.
 */
export function Inspector({
  words,
  duration,
  selectedWord,
  lineRange,
  sticker,
  stickerLabel,
  style,
  busy,
  onWordsChange,
  onSelectWord,
  onPreview,
  onRetranscribe,
  onStickerChange,
  onStickerRemove,
  onStickerDuplicate,
  onStickerSplit,
  onOpenStickers,
  onStyleChange,
<<<<<<< HEAD
  onClose,
=======
>>>>>>> origin/claude/happy-fermat-13d9xo
  clip,
  className,
}: Props) {
  const word = selectedWord != null ? words[selectedWord] : undefined;
  const edit = (patch: Partial<Word>) => {
    if (selectedWord == null) return;
    onWordsChange(editWordAt(words, selectedWord, patch, duration));
  };

  return (
    <aside
      aria-label="ตั้งค่าสิ่งที่เลือก"
      className={cn(
        "studio-panel relative min-h-0 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-4",
        className,
      )}
    >
<<<<<<< HEAD
      {onClose && (clip || word || sticker) && (
        <button
          type="button"
          aria-label="ปิดหน้าต่าง"
          title="ปิด (Esc)"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
=======
>>>>>>> origin/claude/happy-fermat-13d9xo
      {clip ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{clip.title}</p>
          <TextClipEditor
            key={clip.key}
            text={clip.text}
            look={clip.look}
            live={clip.live}
            onText={clip.onText}
            onStyle={clip.onStyle}
            onSplit={clip.onSplit}
            onDuplicate={clip.onDuplicate}
            onDelete={clip.onDelete}
            onDone={clip.onDone}
          />
          <p className="text-xs text-muted-foreground">
            ลากบนพรีวิวเพื่อย้าย ใช้มุมเพื่อหมุนหรือย่อขยาย ลากแถบม่วงบนไทม์ไลน์เพื่อเปลี่ยนเวลา
          </p>
        </div>
      ) : word && selectedWord != null ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">คำที่เลือก</p>
            <p className="mt-1 truncate text-lg font-bold">{word.text}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inspector-word" className="text-xs text-muted-foreground">
              ข้อความ
            </Label>
            <Input
              id="inspector-word"
              value={word.text}
              onChange={(event) => edit({ text: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">สีของคำนี้</span>
            <ColorSwatches
              label="สีของคำนี้"
              value={word.color}
              resetLabel="ตามสไตล์"
              onChange={(color) => edit({ color })}
            />
          </div>
          <div className="grid gap-1 border-t border-border pt-3">
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => onPreview(word.start, word.end)}
            >
              <Play className="mr-2 h-4 w-4" /> ฟังคำนี้
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => onWordsChange(lineBreakAfter(words, selectedWord, duration))}
            >
              <CornerDownLeft className="mr-2 h-4 w-4" /> ขึ้นบรรทัดใหม่หลังคำนี้
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => {
                onWordsChange(newWordAfter(words, selectedWord, duration));
                onSelectWord(selectedWord + 1);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> เพิ่มคำหลังคำนี้
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              disabled={busy}
              onClick={() => onRetranscribe(lineRange.start, lineRange.end)}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} />
              ถอดเสียงบรรทัดนี้ใหม่
            </Button>
            <Button
              variant="ghost"
              className="justify-start text-destructive hover:text-destructive"
              onClick={() => {
                onWordsChange(removeWordAt(words, selectedWord));
                onSelectWord(null);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> ลบคำ
            </Button>
          </div>
        </div>
      ) : sticker ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              สติกเกอร์ที่เลือก
            </p>
            <p className="mt-1 text-2xl">{stickerLabel}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            ลากสติกเกอร์บนพรีวิวเพื่อย้าย ใช้มุมเพื่อหมุนหรือย่อขยาย
          </p>
          <div className="grid gap-1 border-t border-border pt-3">
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => onStickerSplit(sticker.id)}
            >
              <Scissors className="mr-2 h-4 w-4" /> ตัดที่ตำแหน่งเส้นเวลา
            </Button>
            <Button variant="ghost" className="justify-start" onClick={onOpenStickers}>
              <MousePointerClick className="mr-2 h-4 w-4" /> เปลี่ยนสติกเกอร์ / ปรับเพิ่ม
            </Button>
            <Button
              variant="ghost"
              className="justify-start text-destructive hover:text-destructive"
              onClick={() => onStickerRemove(sticker.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> ลบสติกเกอร์
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">สไตล์ซับ</p>
            <p className="mt-1 text-xs text-muted-foreground">
              คลิกคำหรือสติกเกอร์บนไทม์ไลน์ด้านล่างเพื่อแก้ไขทีละชิ้น
            </p>
          </div>
          <CaptionColorControls style={style} onChange={onStyleChange} />
          <CaptionLayoutControls style={style} onChange={onStyleChange} />
        </div>
      )}
    </aside>
  );
}
