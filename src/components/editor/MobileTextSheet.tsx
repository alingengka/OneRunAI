import { X } from "lucide-react";
import type { ClipEditing } from "./Inspector";
import { useKeyboardInset } from "./MobileWordBar";
import { TextClipEditor } from "./TextClipEditor";

type Props = {
  clip: ClipEditing;
  autoFocus?: boolean;
};

/**
 * Phone editor for a text clip (CapCut-style): a sheet over the bottom of
 * the screen, lifted above the keyboard, so the preview stays visible while
 * typing and styling.
 */
export function MobileTextSheet({ clip, autoFocus }: Props) {
  const keyboard = useKeyboardInset();
  return (
    <div
      role="dialog"
      aria-label="แก้ข้อความ"
      className="fixed inset-x-0 z-50 flex max-h-[56dvh] flex-col rounded-t-2xl border-t border-border bg-card shadow-[0_-16px_40px_-16px_rgba(0,0,0,0.6)] lg:hidden"
      style={{ bottom: keyboard, paddingBottom: keyboard ? 0 : "env(safe-area-inset-bottom)" }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-1.5">
        <span className="text-sm font-semibold">{clip.title}</span>
        <button
          type="button"
          onClick={clip.onDone}
          aria-label="ปิด"
          className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
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
          autoFocus={!!autoFocus}
        />
      </div>
    </div>
  );
}
