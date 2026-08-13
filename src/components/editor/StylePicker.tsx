import { stylePresets, type CaptionStyle } from "@/lib/captions";
import { cn } from "@/lib/utils";

export function StylePicker({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (style: CaptionStyle) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {stylePresets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onSelect(preset)}
          className={cn(
            "flex h-14 items-center justify-center rounded-xl border bg-secondary px-2 transition-all hover:scale-[1.02]",
            activeId === preset.id ? "border-primary ring-2 ring-primary/40" : "border-border",
          )}
        >
          <span
            className="truncate text-sm"
            style={{
              fontFamily: preset.fontFamily,
              fontWeight: preset.fontWeight,
              color: preset.highlight === "box" ? preset.highlightTextColor : preset.color,
              background: preset.highlight === "box" ? preset.highlightColor : undefined,
              padding: preset.highlight === "box" ? "0 6px" : undefined,
              borderRadius: 4,
              textTransform: preset.uppercase ? "uppercase" : "none",
              WebkitTextStroke:
                preset.stroke === "none" ? undefined : `1px ${preset.strokeColor}`,
            }}
          >
            {preset.name}
          </span>
        </button>
      ))}
    </div>
  );
}
