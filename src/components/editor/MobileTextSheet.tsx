import { Check } from "lucide-react";
import type { Sticker } from "@/lib/media/stickers";
import { useKeyboardInset } from "./MobileWordBar";
import { TextLayerControls } from "./TextLayerControls";

type Props = {
  sticker: Sticker;
  onChange: (patch: Partial<Sticker>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
};

/**
 * Phone editor for a text layer (CapCut-style): a sheet over the bottom of
 * the screen, lifted above the keyboard, so the preview stays visible while
 * typing and styling.
 */
export function MobileTextSheet({ sticker, onChange, onDuplicate, onRemove, onClose }: Props) {
  const keyboard = useKeyboardInset();
  return (
    <div
      role="dialog"
      aria-label="แก้ข้อความ"
      className="fixed inset-x-0 z-50 flex max-h-[52dvh] flex-col rounded-t-2xl border-t border-border bg-card shadow-[0_-16px_40px_-16px_rgba(0,0,0,0.6)] lg:hidden"
      style={{ bottom: keyboard, paddingBottom: keyboard ? 0 : "env(safe-area-inset-bottom)" }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-semibold">ข้อความ</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="เสร็จ"
          className="flex h-9 items-center gap-1 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground"
        >
          <Check className="h-4 w-4" /> เสร็จ
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
        <TextLayerControls
          sticker={sticker}
          onChange={onChange}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          autoFocus={sticker.asset === "ข้อความ"}
        />
      </div>
    </div>
  );
}
