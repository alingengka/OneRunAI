import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const TEXT_SWATCHES = [
  "#ffffff",
  "#ffd400",
  "#ff9500",
  "#ff3b30",
  "#ff5fa2",
  "#a855f7",
  "#6cc4ff",
  "#22c55e",
  "#111111",
];

type Props = {
  value: string | undefined;
  onChange: (color: string | undefined) => void;
  /** label for the "no override" chip; omit to hide it */
  resetLabel?: string | undefined;
  label: string;
};

/** A row of tap-friendly color chips plus a custom color picker. */
export function ColorSwatches({ value, onChange, resetLabel, label }: Props) {
  const current = value?.toLowerCase();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {resetLabel && (
        <button
          type="button"
          role="radio"
          aria-checked={!current}
          onClick={() => onChange(undefined)}
          className={cn(
            "h-8 rounded-full border px-2.5 text-xs",
            !current ? "border-primary text-foreground" : "border-border text-muted-foreground",
          )}
        >
          {resetLabel}
        </button>
      )}
      {TEXT_SWATCHES.map((color) => {
        const on = current === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={color}
            onClick={() => onChange(color)}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full border shadow-sm transition active:scale-95",
              on ? "border-primary ring-2 ring-primary/40" : "border-border",
            )}
            style={{ background: color }}
          >
            {on && (
              <Check
                className="h-4 w-4"
                style={{ color: color === "#ffffff" || color === "#ffd400" ? "#111" : "#fff" }}
              />
            )}
          </button>
        );
      })}
      <label
        className="relative grid h-8 w-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-border"
        title="เลือกสีเอง"
        style={{
          background:
            "conic-gradient(#ff3b30, #ffd400, #22c55e, #6cc4ff, #a855f7, #ff5fa2, #ff3b30)",
        }}
      >
        <span className="sr-only">เลือกสีเอง</span>
        <input
          type="color"
          value={current && /^#[0-9a-f]{6}$/.test(current) ? current : "#ffffff"}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
