import { stylePresets, type CaptionStyle } from "@/lib/captions";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { loadCustomStyles, removeCustomStyle, saveCustomStyle } from "@/lib/style-library";
import { Save, Trash2 } from "lucide-react";

export function StylePicker({
  activeId,
  activeStyle,
  onSelect,
}: {
  activeId: string;
  activeStyle: CaptionStyle;
  onSelect: (style: CaptionStyle) => void;
}) {
  const [mode, setMode] = useState<"fixed" | "animation" | "mine">("fixed");
  const [customStyles, setCustomStyles] = useState<CaptionStyle[]>(() => typeof window === "undefined" ? [] : loadCustomStyles());
  const presets = mode === "fixed"
    ? stylePresets.filter((preset) => preset.animation === "none" || preset.animation === "fade")
    : mode === "animation"
      ? stylePresets.filter((preset) => preset.animation !== "none" && preset.animation !== "fade")
      : customStyles;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 rounded-lg bg-secondary p-1">
        {([['fixed', 'สไตล์คงที่'], ['animation', 'แอนิเมชัน'], ['mine', 'ของฉัน']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setMode(key)} className={cn("rounded-md px-2 py-2 text-xs font-medium", mode === key ? "bg-card shadow-sm" : "text-muted-foreground")}>{label}</button>
        ))}
      </div>
      {mode === "animation" && <p className="text-xs text-muted-foreground">เลือกสไตล์เคลื่อนไหว แล้วกำหนดทีละคำ/ทั้งประโยคและความเร็วใน Customize</p>}
      {mode === "mine" && (
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="text-xs text-muted-foreground">บันทึกค่าฟอนต์ สี ขอบ ตำแหน่ง และ animation ปัจจุบัน</span>
          <Button size="sm" variant="secondary" onClick={() => setCustomStyles(saveCustomStyle(activeStyle))}><Save className="h-3.5 w-3.5" /> บันทึกสไตล์</Button>
        </div>
      )}
      {mode === "mine" && !presets.length && <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">ยังไม่มีสไตล์ที่บันทึก</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {presets.map((preset) => (
        <div
          key={preset.id}
          className={cn(
            "relative flex h-14 items-center justify-center rounded-xl border bg-secondary px-2 transition-all hover:scale-[1.02]",
            activeId === preset.id ? "border-primary ring-2 ring-primary/40" : "border-border",
          )}
        >
          <button type="button" onClick={() => onSelect(preset)} className="absolute inset-0" aria-label={`ใช้สไตล์ ${preset.name}`} />
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
          {mode === "mine" && <Button size="icon" variant="ghost" className="absolute right-0.5 top-0.5 h-6 w-6" onClick={() => setCustomStyles(removeCustomStyle(preset.id))} aria-label={`ลบสไตล์ ${preset.name}`}><Trash2 className="h-3 w-3" /></Button>}
        </div>
      ))}
      </div>
    </div>
  );
}
