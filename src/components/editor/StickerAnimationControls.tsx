import type { Sticker, StickerAnimIn, StickerAnimOut } from "@/lib/media/stickers";
import { cn } from "@/lib/utils";

const IN_OPTIONS: { id: StickerAnimIn; label: string }[] = [
  { id: "none", label: "ไม่มี" },
  { id: "fade", label: "Fade in" },
  { id: "pop", label: "เด้ง" },
  { id: "slide", label: "เลื่อนขึ้น" },
];

const OUT_OPTIONS: { id: StickerAnimOut; label: string }[] = [
  { id: "none", label: "ไม่มี" },
  { id: "fade", label: "Fade out" },
  { id: "shrink", label: "ย่อหาย" },
  { id: "slide", label: "เลื่อนลง" },
];

/** Entrance / exit animation of one sticker (same in the preview and the export). */
export function StickerAnimationControls({
  sticker,
  onChange,
}: {
  sticker: Sticker;
  onChange: (id: string, patch: Partial<Sticker>) => void;
}) {
  return (
    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
      <Choices
        label="แอนิเมชันตอนเข้า"
        options={IN_OPTIONS}
        value={sticker.animIn ?? "none"}
        onPick={(animIn) => onChange(sticker.id, { animIn })}
      />
      <Choices
        label="แอนิเมชันตอนออก"
        options={OUT_OPTIONS}
        value={sticker.animOut ?? "none"}
        onPick={(animOut) => onChange(sticker.id, { animOut })}
      />
    </div>
  );
}

function Choices<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onPick: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="space-y-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            onClick={() => onPick(option.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition",
              value === option.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
