import { animationOptions, fontOptions, type CaptionStyle, type StrokeSize } from "@/lib/captions";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  style: CaptionStyle;
  onChange: (patch: Partial<CaptionStyle>) => void;
};

const sizes: StrokeSize[] = ["none", "small", "medium", "large"];
const fonts = fontOptions;


function Segmented<T extends string>({
  value,
  options,
  onSelect,
}: {
  value: T;
  options: { label: string; value: T }[];
  onSelect: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-secondary p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onSelect(o.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors",
            value === o.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function StyleControls({ style, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Row label="Font family">
          <select
            value={style.fontFamily}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
            className="h-9 w-full rounded-lg border border-border bg-secondary px-2 text-sm"
          >
            {fonts.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Uppercase">
          <Segmented
            value={style.uppercase ? "yes" : "no"}
            options={[
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ]}
            onSelect={(v) => onChange({ uppercase: v === "yes" })}
          />
        </Row>
      </div>

      <Row label={`Karaoke — ขึ้นทีละ ${style.wordsPerGroup} คำ`}>
        <div className="space-y-2">
          <div className="flex gap-2">
            {[1, 2, 3, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange({ wordsPerGroup: n })}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                  style.wordsPerGroup === n
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {n} คำ
              </button>
            ))}
          </div>
          <Slider
            value={[style.wordsPerGroup]}
            min={1}
            max={8}
            step={1}
            onValueChange={([v]) => onChange({ wordsPerGroup: v ?? 1 })}
          />
        </div>
      </Row>


      <div className="grid grid-cols-2 gap-4">
        <Row label={`Size — ${style.size.toFixed(1)}%`}>
          <Slider
            value={[style.size]}
            min={3}
            max={12}
            step={0.1}
            onValueChange={([v]) => onChange({ size: v ?? 6 })}
          />
        </Row>
        <Row label="Font color">
          <Input
            type="color"
            value={style.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="h-9 cursor-pointer p-1"
          />
        </Row>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Row label="Stroke weight">
          <Segmented
            value={style.stroke}
            options={sizes.map((s) => ({ label: s, value: s }))}
            onSelect={(v) => onChange({ stroke: v })}
          />
        </Row>
        <Row label="Stroke color">
          <Input
            type="color"
            value={style.strokeColor}
            onChange={(e) => onChange({ strokeColor: e.target.value })}
            className="h-9 cursor-pointer p-1"
          />
        </Row>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Row label="Shadow">
          <Segmented
            value={style.shadow}
            options={sizes.map((s) => ({ label: s, value: s }))}
            onSelect={(v) => onChange({ shadow: v })}
          />
        </Row>
        <Row label="Shadow color">
          <Input
            type="color"
            value={style.shadowColor}
            onChange={(e) => onChange({ shadowColor: e.target.value })}
            className="h-9 cursor-pointer p-1"
          />
        </Row>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Row label="Keyword highlight">
          <Segmented
            value={style.highlight}
            options={[
              { label: "None", value: "none" as const },
              { label: "Color", value: "color" as const },
              { label: "Box", value: "box" as const },
            ]}
            onSelect={(v) => onChange({ highlight: v })}
          />
        </Row>
        <Row label="Highlight color">
          <Input
            type="color"
            value={style.highlightColor}
            onChange={(e) => onChange({ highlightColor: e.target.value })}
            className="h-9 cursor-pointer p-1"
          />
        </Row>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Row label={`Position Y — ${Math.round(style.posY)}%`}>
          <Slider
            value={[style.posY]}
            min={5}
            max={95}
            step={1}
            onValueChange={([v]) => onChange({ posY: v ?? 68 })}
          />
        </Row>
        <Row label={`Position X — ${Math.round(style.posX)}%`}>
          <Slider
            value={[style.posX]}
            min={10}
            max={90}
            step={1}
            onValueChange={([v]) => onChange({ posX: v ?? 50 })}
          />
        </Row>
      </div>

      <Row label="Animation">
        <div className="grid grid-cols-3 gap-2">
          {animationOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange({ animation: o.value })}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                style.animation === o.value
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Row>

      <div className="grid grid-cols-2 gap-4">
        <Row label="Background plate">
          <Segmented
            value={style.plate ? "yes" : "no"}
            options={[
              { label: "Yes", value: "yes" },
              { label: "No", value: "no" },
            ]}
            onSelect={(v) => onChange({ plate: v === "yes" })}
          />
        </Row>
        <Row label="Plate color">
          <Input
            type="color"
            value={style.plateColor}
            onChange={(e) => onChange({ plateColor: e.target.value })}
            className="h-9 cursor-pointer p-1"
          />
        </Row>
      </div>

    </div>
  );
}
