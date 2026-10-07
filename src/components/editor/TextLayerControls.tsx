import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fontOptions } from "@/lib/captions";
import { DEFAULT_TEXT_FONT, type Sticker } from "@/lib/media/stickers";
import { ColorSwatches } from "./ColorSwatches";

type Props = {
  sticker: Sticker;
  onChange: (patch: Partial<Sticker>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  autoFocus?: boolean;
  className?: string;
};

/** Ready-made looks, like CapCut's text styles row. */
const LOOKS: { label: string; patch: Partial<Sticker> }[] = [
  { label: "ขาว", patch: { color: "#ffffff", stroke: undefined, background: undefined } },
  { label: "ขอบดำ", patch: { color: "#ffffff", stroke: "#111111", background: undefined } },
  { label: "เหลือง", patch: { color: "#ffd21f", stroke: "#111111", background: undefined } },
  { label: "ป้ายดำ", patch: { color: "#ffffff", stroke: undefined, background: "#000000cc" } },
  { label: "ป้ายขาว", patch: { color: "#111111", stroke: undefined, background: "#ffffff" } },
  { label: "ป้ายเหลือง", patch: { color: "#111111", stroke: undefined, background: "#ffd21f" } },
];

/** Settings for one free text layer: words, font, look, size and opacity. */
export function TextLayerControls({
  sticker,
  onChange,
  onDuplicate,
  onRemove,
  autoFocus,
  className,
}: Props) {
  return (
    <div className={cn("space-y-4", className)}>
      <Textarea
        value={sticker.asset}
        autoFocus={autoFocus}
        rows={2}
        aria-label="ข้อความ"
        placeholder="พิมพ์ข้อความ"
        onChange={(event) => onChange({ asset: event.target.value })}
        className="text-base"
      />

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">สไตล์</span>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {LOOKS.map(({ label, patch }) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange(patch)}
              className="shrink-0 rounded-md border border-border bg-black/80 px-2.5 py-1.5 text-sm font-extrabold"
              style={{
                color: patch.color,
                background: patch.background ?? "#2a2a2a",
                WebkitTextStroke: patch.stroke ? `1px ${patch.stroke}` : undefined,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs text-muted-foreground">ฟอนต์</span>
        <select
          value={sticker.font || DEFAULT_TEXT_FONT}
          onChange={(event) => onChange({ font: event.target.value })}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value={DEFAULT_TEXT_FONT}>Noto Sans (ລາວ/ไทย/EN)</option>
          {fontOptions.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">สีตัวอักษร</span>
        <ColorSwatches
          label="สีตัวอักษร"
          value={sticker.color}
          onChange={(color) => onChange({ color: color ?? "#ffffff" })}
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">ขอบตัวอักษร</span>
        <ColorSwatches
          label="ขอบตัวอักษร"
          value={sticker.stroke}
          resetLabel="ไม่มี"
          onChange={(stroke) => onChange({ stroke })}
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">พื้นหลัง</span>
        <ColorSwatches
          label="พื้นหลังข้อความ"
          value={sticker.background}
          resetLabel="ไม่มี"
          onChange={(background) => onChange({ background })}
        />
      </div>

      <div className="space-y-2">
        <span className="flex justify-between text-xs text-muted-foreground">
          <span>ขนาด</span>
          <span className="font-mono text-foreground">{sticker.size.toFixed(1)}</span>
        </span>
        <Slider
          value={[sticker.size]}
          min={2}
          max={20}
          step={0.5}
          aria-label="ขนาดข้อความ"
          onValueChange={([size]) => onChange({ size: size ?? 6 })}
        />
      </div>
      <div className="space-y-2">
        <span className="flex justify-between text-xs text-muted-foreground">
          <span>ความทึบ</span>
          <span className="font-mono text-foreground">
            {Math.round((sticker.opacity ?? 1) * 100)}%
          </span>
        </span>
        <Slider
          value={[(sticker.opacity ?? 1) * 100]}
          min={10}
          max={100}
          step={5}
          aria-label="ความทึบของข้อความ"
          onValueChange={([value]) => onChange({ opacity: (value ?? 100) / 100 })}
        />
      </div>

      <div className="flex gap-2 border-t border-border pt-3">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onDuplicate}>
          <Copy className="mr-1.5 h-4 w-4" /> ทำซ้ำ
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> ลบข้อความ
        </Button>
      </div>
    </div>
  );
}
