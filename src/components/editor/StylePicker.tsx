import { useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { sampleTextForLanguage, stylePresets, type CaptionStyle } from "@/lib/captions";
import { loadCustomStyles, removeCustomStyle, saveCustomStyle } from "@/lib/style-library";
import { cn } from "@/lib/utils";

type Mode = "fixed" | "animation" | "mine";

type Props = {
  activeId: string;
  activeStyle: CaptionStyle;
  onSelect: (style: CaptionStyle) => void;
  onChange: (patch: Partial<CaptionStyle>) => void;
  language?: string;
};

const strokeWidth = { none: 0, small: 1, medium: 2, large: 3 } as const;

function PresetPreview({ preset, text }: { preset: CaptionStyle; text: string }) {
  const shadow = strokeWidth[preset.shadow];
  const stroke = strokeWidth[preset.stroke];

  return (
    <span
      className="max-w-full truncate px-2 text-xl"
      style={{
        fontFamily: preset.fontFamily,
        fontWeight: preset.fontWeight,
        color: preset.highlight === "box" ? preset.highlightTextColor : preset.color,
        background: preset.highlight === "box" ? preset.highlightColor : undefined,
        borderRadius: preset.highlight === "box" ? 4 : undefined,
        textTransform: preset.uppercase ? "uppercase" : "none",
        WebkitTextStroke: stroke ? `${stroke}px ${preset.strokeColor}` : undefined,
        textShadow: shadow ? `0 ${shadow}px ${shadow * 2}px ${preset.shadowColor}` : undefined,
        transform: preset.italic ? "skewX(-12deg)" : undefined,
      }}
    >
      {text}
    </span>
  );
}

export function StylePicker({ activeId, activeStyle, onSelect, onChange, language }: Props) {
  const [mode, setMode] = useState<Mode>("fixed");
  const sampleText = sampleTextForLanguage(language);
  const [customStyles, setCustomStyles] = useState<CaptionStyle[]>(() =>
    typeof window === "undefined" ? [] : loadCustomStyles(),
  );
  const presets =
    mode === "fixed"
      ? stylePresets.filter((preset) => preset.animation === "none" || preset.animation === "fade")
      : mode === "animation"
        ? stylePresets.filter(
            (preset) => preset.animation !== "none" && preset.animation !== "fade",
          )
        : customStyles;

  return (
    <div className="space-y-5 pb-3">
      <div
        className="grid grid-cols-3 border-b border-border"
        role="tablist"
        aria-label="หมวดสไตล์"
      >
        {(
          [
            ["fixed", "สไตล์คงที่"],
            ["animation", "อนิเมชัน"],
            ["mine", "ของฉัน"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            variant="ghost"
            onClick={() => setMode(key)}
            className={cn(
              "relative h-11 rounded-none px-2 text-xs text-muted-foreground shadow-none sm:text-sm",
              mode === key &&
                "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary",
            )}
          >
            {label}
          </Button>
        ))}
      </div>

      {mode === "animation" && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/50 p-2.5">
          <p className="text-xs text-muted-foreground">รูปแบบการขึ้นคำ</p>
          <div className="flex rounded-md bg-background p-0.5">
            <Button
              type="button"
              size="sm"
              variant={activeStyle.wordsPerGroup === 1 ? "secondary" : "ghost"}
              onClick={() => onChange({ wordsPerGroup: 1 })}
              className="h-7"
            >
              ทีละคำ
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeStyle.wordsPerGroup !== 1 ? "secondary" : "ghost"}
              onClick={() => onChange({ wordsPerGroup: Math.max(2, activeStyle.wordsPerGroup) })}
              className="h-7"
            >
              ทั้งประโยค
            </Button>
          </div>
        </div>
      )}

      {mode === "mine" && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-secondary/40 p-3">
          <span className="text-xs text-muted-foreground">บันทึกสไตล์ที่กำลังใช้อยู่</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCustomStyles(saveCustomStyle(activeStyle))}
          >
            <Save /> บันทึก
          </Button>
        </div>
      )}

      {mode === "mine" && !presets.length ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          ยังไม่มีสไตล์ที่บันทึก
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {presets.map((preset) => (
            <article key={preset.id} className="min-w-0">
              <div
                className={cn(
                  "group relative flex aspect-[1.75/1] min-h-24 items-center justify-center overflow-hidden rounded-md border bg-preview transition-colors",
                  activeId === preset.id
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(preset)}
                  className="absolute inset-0 z-10 cursor-pointer"
                  aria-label={`ใช้สไตล์ ${preset.name}`}
                />
                <PresetPreview preset={preset} text={sampleText} />
                {mode === "animation" && (
                  <span className="absolute right-2 top-2 rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">
                    ใช้ได้
                  </span>
                )}
                {mode === "mine" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1 z-20 h-7 w-7 bg-background/70"
                    onClick={() => setCustomStyles(removeCustomStyle(preset.id))}
                    aria-label={`ลบสไตล์ ${preset.name}`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-foreground">{preset.name}</p>
            </article>
          ))}
        </div>
      )}

      <div className="sticky bottom-0 grid grid-cols-2 gap-4 border-t border-border bg-card/95 pb-1 pt-4 backdrop-blur">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium">ตำแหน่ง</span>
            <Input
              type="number"
              value={Math.round(activeStyle.posY)}
              min={5}
              max={95}
              onChange={(event) => onChange({ posY: Number(event.target.value) })}
              className="h-8 w-16 text-right"
              aria-label="ตำแหน่งแนวตั้งเปอร์เซ็นต์"
            />
          </div>
          <Slider
            value={[activeStyle.posY]}
            min={5}
            max={95}
            step={1}
            onValueChange={([value]) => onChange({ posY: value ?? 68 })}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium">ขนาด</span>
            <Input
              type="number"
              value={activeStyle.size.toFixed(1)}
              min={3}
              max={12}
              step={0.1}
              onChange={(event) => onChange({ size: Number(event.target.value) })}
              className="h-8 w-16 text-right"
              aria-label="ขนาดคำบรรยายเปอร์เซ็นต์"
            />
          </div>
          <Slider
            value={[activeStyle.size]}
            min={3}
            max={12}
            step={0.1}
            onValueChange={([value]) => onChange({ size: value ?? 6 })}
          />
        </div>
      </div>
    </div>
  );
}
