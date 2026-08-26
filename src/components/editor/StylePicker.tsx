import { stylePresets, type CaptionStyle } from "@/lib/captions";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function StylePicker({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (style: CaptionStyle) => void;
}) {
  const [mode, setMode] = useState<"fixed" | "animation" | "mine">("fixed");
  const presets = mode === "fixed"
    ? stylePresets.filter((preset) => preset.animation === "none" || preset.animation === "fade")
    : mode === "animation"
      ? stylePresets.filter((preset) => preset.animation !== "none" && preset.animation !== "fade")
      : [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 rounded-lg bg-secondary p-1">
        {([['fixed', 'สไตล์คงที่'], ['animation', 'แอนิเมชัน'], ['mine', 'ของฉัน']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setMode(key)} className={cn("rounded-md px-2 py-2 text-xs font-medium", mode === key ? "bg-card shadow-sm" : "text-muted-foreground")}>{label}</button>
        ))}
      </div>
      {mode === "animation" && <p className="text-xs text-muted-foreground">เลือกสไตล์เคลื่อนไหว แล้วกำหนดทีละคำ/ทั้งประโยคและความเร็วใน Customize</p>}
      {mode === "mine" && <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">สไตล์ที่บันทึกเองจะแสดงที่นี่ในเวอร์ชันถัดไป</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {presets.map((preset) => (
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
    </div>
  );
}
