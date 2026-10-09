import { useEffect, useState } from "react";
import { Check, Copy, Scissors, Trash2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { animationOptions, fontOptions, type CaptionStyle, type StrokeSize } from "@/lib/captions";
import { ColorSwatches } from "./ColorSwatches";

type Props = {
  /** the clip's words as one text ("\n" between rows) */
  text: string;
  /** the look the clip is drawn with (shared style + its own settings) */
  look: CaptionStyle;
  /** caption lines re-time their words on commit; free texts update as you type */
  live: boolean;
  onText: (text: string) => void;
  onStyle: (patch: Partial<CaptionStyle>) => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** ✓ next to the text box */
  onDone?: (() => void) | undefined;
  autoFocus?: boolean;
  className?: string;
};

type Tab = "font" | "style" | "animation";
type StylePart = "text" | "stroke" | "glow" | "plate" | "shadow";

/** Ready-made looks, like CapCut's row of "Aa" styles. */
const LOOKS: {
  label: string;
  preview: { color: string; bg?: string; stroke?: string };
  patch: Partial<CaptionStyle>;
}[] = [
  {
    label: "ขาว",
    preview: { color: "#ffffff" },
    patch: {
      color: "#ffffff",
      stroke: "none",
      plate: false,
      shadow: "small",
      glowColor: undefined,
    },
  },
  {
    label: "ขอบดำ",
    preview: { color: "#ffffff", stroke: "#111111" },
    patch: {
      color: "#ffffff",
      stroke: "medium",
      strokeColor: "#111111",
      plate: false,
      glowColor: undefined,
    },
  },
  {
    label: "เหลือง",
    preview: { color: "#ffd21f", stroke: "#111111" },
    patch: {
      color: "#ffd21f",
      stroke: "medium",
      strokeColor: "#111111",
      plate: false,
      glowColor: undefined,
    },
  },
  {
    label: "ป้ายดำ",
    preview: { color: "#ffffff", bg: "#000000" },
    patch: {
      color: "#ffffff",
      stroke: "none",
      plate: true,
      plateColor: "#000000",
      plateOpacity: 0.85,
      glowColor: undefined,
    },
  },
  {
    label: "ป้ายขาว",
    preview: { color: "#111111", bg: "#ffffff" },
    patch: {
      color: "#111111",
      stroke: "none",
      plate: true,
      plateColor: "#ffffff",
      plateOpacity: 1,
      glowColor: undefined,
    },
  },
  {
    label: "ป้ายเหลือง",
    preview: { color: "#111111", bg: "#ffd21f" },
    patch: {
      color: "#111111",
      stroke: "none",
      plate: true,
      plateColor: "#ffd21f",
      plateOpacity: 1,
      glowColor: undefined,
    },
  },
  {
    label: "นีออน",
    preview: { color: "#ffffff" },
    patch: { color: "#ffffff", stroke: "none", plate: false, glowColor: "#a855f7" },
  },
];

const SIZES: { value: StrokeSize; label: string }[] = [
  { value: "small", label: "บาง" },
  { value: "medium", label: "กลาง" },
  { value: "large", label: "หนา" },
];

/**
 * CapCut-style text editor shared by the desktop panel and the phone sheet:
 * the text box with ✓ on top, then Font / Style / Animation tabs.
 */
export function TextClipEditor({
  text,
  look,
  live,
  onText,
  onStyle,
  onSplit,
  onDuplicate,
  onDelete,
  onDone,
  autoFocus,
  className,
}: Props) {
  const [draft, setDraft] = useState(text);
  const [tab, setTab] = useState<Tab>("style");
  const [part, setPart] = useState<StylePart>("text");
  // a different clip (or an undo) brings its own text
  useEffect(() => setDraft(text), [text]);

  const commit = () => {
    const value = draft.trim();
    if (value && value !== text.trim()) onText(value);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start gap-2">
        <textarea
          value={draft}
          autoFocus={autoFocus}
          rows={2}
          aria-label="ข้อความ"
          placeholder="พิมพ์ข้อความ"
          onChange={(event) => {
            setDraft(event.target.value);
            if (live && event.target.value.trim()) onText(event.target.value);
          }}
          onBlur={() => !live && commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              commit();
              onDone?.();
            }
          }}
          className="min-h-[2.75rem] min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary"
        />
        <button
          type="button"
          aria-label="เสร็จ"
          title="เสร็จ (Ctrl+Enter)"
          onClick={() => {
            commit();
            onDone?.();
          }}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
        >
          <Check className="h-5 w-5" />
        </button>
      </div>

      <div role="tablist" aria-label="ตั้งค่าข้อความ" className="flex border-b border-border">
        {(
          [
            ["font", "ฟอนต์"],
            ["style", "สไตล์"],
            ["animation", "Animation"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px flex-1 border-b-2 px-2 py-2 text-sm transition-colors",
              tab === key
                ? "border-primary font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "font" && (
        <div className="grid grid-cols-2 gap-2">
          {fontOptions.map((font) => (
            <button
              key={font.value}
              type="button"
              aria-pressed={look.fontFamily === font.value}
              onClick={() => onStyle({ fontFamily: font.value })}
              className={cn(
                "truncate rounded-lg border px-2.5 py-2 text-left text-sm",
                look.fontFamily === font.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              style={{ fontFamily: font.value }}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}

      {tab === "style" && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {LOOKS.map(({ label, preview, patch }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => onStyle(patch)}
                className="grid h-11 min-w-[3.25rem] shrink-0 place-items-center rounded-lg border border-border px-2 text-base font-extrabold"
                style={{
                  color: preview.color,
                  background: preview.bg ?? "#2a2a2a",
                  WebkitTextStroke: preview.stroke ? `1px ${preview.stroke}` : undefined,
                  textShadow: patch.glowColor
                    ? `0 0 4px ${patch.glowColor}, 0 0 9px ${patch.glowColor}`
                    : undefined,
                }}
              >
                Aa
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">
            {(
              [
                ["text", "สีตัวอักษร"],
                ["stroke", "ขอบ"],
                ["glow", "เรืองแสง"],
                ["plate", "พื้นหลัง"],
                ["shadow", "เงา"],
              ] as [StylePart, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={part === key}
                onClick={() => setPart(key)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs",
                  part === key
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {part === "text" && (
            <ColorSwatches
              label="สีตัวอักษร"
              value={look.color}
              onChange={(color) => onStyle({ color: color ?? "#ffffff" })}
            />
          )}
          {part === "stroke" && (
            <div className="space-y-2">
              <ColorSwatches
                label="สีขอบ"
                value={look.stroke === "none" ? undefined : look.strokeColor}
                resetLabel="ไม่มี"
                onChange={(color) =>
                  onStyle(
                    color
                      ? {
                          strokeColor: color,
                          stroke: look.stroke === "none" ? "medium" : look.stroke,
                        }
                      : { stroke: "none" },
                  )
                }
              />
              <Thickness value={look.stroke} onChange={(stroke) => onStyle({ stroke })} />
            </div>
          )}
          {part === "glow" && (
            <ColorSwatches
              label="สีเรืองแสง"
              value={look.glowColor}
              resetLabel="ไม่มี"
              onChange={(glowColor) => onStyle({ glowColor })}
            />
          )}
          {part === "plate" && (
            <ColorSwatches
              label="สีพื้นหลัง"
              value={look.plate ? look.plateColor : undefined}
              resetLabel="ไม่มี"
              onChange={(color) =>
                onStyle(
                  color
                    ? { plate: true, plateColor: color, plateOpacity: look.plateOpacity ?? 0.9 }
                    : { plate: false },
                )
              }
            />
          )}
          {part === "shadow" && (
            <div className="space-y-2">
              <ColorSwatches
                label="สีเงา"
                value={look.shadow === "none" ? undefined : look.shadowColor}
                resetLabel="ไม่มี"
                onChange={(color) =>
                  onStyle(
                    color
                      ? {
                          shadowColor: color,
                          shadow: look.shadow === "none" ? "medium" : look.shadow,
                        }
                      : { shadow: "none" },
                  )
                }
              />
              <Thickness value={look.shadow} onChange={(shadow) => onStyle({ shadow })} />
            </div>
          )}

          <SliderRow
            label="ขนาด"
            value={look.size}
            display={look.size.toFixed(1)}
            min={2}
            max={16}
            step={0.1}
            onChange={(size) => onStyle({ size })}
          />
          <SliderRow
            label="ความทึบ"
            value={(look.opacity ?? 1) * 100}
            display={`${Math.round((look.opacity ?? 1) * 100)}%`}
            min={10}
            max={100}
            step={5}
            onChange={(value) => onStyle({ opacity: value / 100 })}
          />
        </div>
      )}

      {tab === "animation" && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5">
            {animationOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={look.animation === option.value}
                onClick={() => onStyle({ animation: option.value })}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs",
                  look.animation === option.value
                    ? "border-primary bg-primary/10 font-semibold text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">ไฮไลต์คำที่กำลังพูด</span>
            <ColorSwatches
              label="สีไฮไลต์คำที่กำลังพูด"
              value={look.highlight === "none" ? undefined : look.highlightColor}
              resetLabel="ปิด"
              onChange={(color) =>
                onStyle(
                  color
                    ? {
                        highlightColor: color,
                        highlight: look.highlight === "none" ? "color" : look.highlight,
                      }
                    : { highlight: "none" },
                )
              }
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 border-t border-border pt-3">
        <ActionButton icon={Scissors} label="ตัด" onClick={onSplit} />
        <ActionButton icon={Copy} label="ทำซ้ำ" onClick={onDuplicate} />
        <ActionButton icon={Trash2} label="ลบ" onClick={onDelete} danger />
      </div>
    </div>
  );
}

function Thickness({ value, onChange }: { value: StrokeSize; onChange: (v: StrokeSize) => void }) {
  return (
    <div className="flex gap-1.5">
      {SIZES.map((size) => (
        <button
          key={size.value}
          type="button"
          aria-pressed={value === size.value}
          onClick={() => onChange(size.value)}
          className={cn(
            "flex-1 rounded-md border px-2 py-1.5 text-xs",
            value === size.value
              ? "border-primary bg-primary/10 font-semibold"
              : "border-border text-muted-foreground",
          )}
        >
          {size.label}
        </button>
      ))}
    </div>
  );
}

function SliderRow(props: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="flex justify-between text-xs text-muted-foreground">
        <span>{props.label}</span>
        <span className="font-mono text-foreground">{props.display}</span>
      </span>
      <Slider
        value={[props.value]}
        min={props.min}
        max={props.max}
        step={props.step}
        aria-label={props.label}
        onValueChange={([v]) => props.onChange(v ?? props.value)}
      />
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-secondary text-sm",
        danger ? "text-destructive" : "text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
