import { animationOptions, fontOptions, type CaptionStyle, type LineStyle, type StrokeSize } from "@/lib/captions";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  style: CaptionStyle;
  onChange: (patch: Partial<CaptionStyle>) => void;
  scripts?: ("latin" | "th" | "lo")[];
  /** จำนวนบรรทัดที่กำลังแสดงบนพรีวิว */
  lineCount?: number;
};

const sizes: StrokeSize[] = ["none", "small", "medium", "large"];



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

export function StyleControls({ style, onChange, scripts, lineCount = 3 }: Props) {
  const [activeLine, setActiveLine] = useState(0);
  const fonts =
    scripts && scripts.length
      ? fontOptions.filter((f) => f.scripts.some((s) => scripts.includes(s)))
      : fontOptions;
  const line: LineStyle = style.lineStyles?.[activeLine] ?? {};
  const patchLine = (patch: Record<string, unknown>) => {
    const merged: Record<string, unknown> = { ...line };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete merged[k];
      else merged[k] = v;
    }
    onChange({ lineStyles: { ...(style.lineStyles ?? {}), [activeLine]: merged as LineStyle } });
  };
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

      <Row
        label={
          style.wordsPerLine
            ? `จัดเรียงบรรทัด — ${style.wordsPerLine} คำ/บรรทัด`
            : "จัดเรียงบรรทัด — บรรทัดเดียว"
        }
      >
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ wordsPerLine: n })}
              className={cn(
                "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                (style.wordsPerLine ?? 0) === n
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {n === 0 ? "อัตโนมัติ" : n}
            </button>
          ))}
        </div>
      </Row>

      <Row label="จัดวางข้อความ">
        <Segmented
          value={style.textAlign ?? "center"}
          options={[
            { label: "ซ้าย", value: "left" as const },
            { label: "กลาง", value: "center" as const },
            { label: "ขวา", value: "right" as const },
          ]}
          onSelect={(v) => onChange({ textAlign: v })}
        />
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

      <Row label={`ความเร็ว Animation — ${(style.animationSpeed ?? 1).toFixed(2)}x`}>
        <div className="space-y-2">
          <Slider
            value={[style.animationSpeed ?? 1]}
            min={0.25}
            max={3}
            step={0.05}
            onValueChange={([v]) => onChange({ animationSpeed: v ?? 1 })}
          />
          <div className="flex gap-2">
            {[0.5, 1, 1.5, 2, 3].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ animationSpeed: s })}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                  (style.animationSpeed ?? 1) === s
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {s}x
              </button>
            ))}
          </div>
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

      <Row label={`ระยะห่างบรรทัด — ${((style.lineGap ?? 0.08) * 100).toFixed(0)}%`}>
        <Slider
          value={[style.lineGap ?? 0.08]}
          min={-0.1}
          max={0.8}
          step={0.02}
          onValueChange={([v]) => onChange({ lineGap: v ?? 0.08 })}
        />
      </Row>

      <div className="space-y-3 rounded-xl border border-border p-3">
        <Row label="สไตล์แยกรายบรรทัด">
          <div className="flex gap-2">
            {Array.from({ length: Math.max(2, lineCount) }, (_, i) => i).map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveLine(i)}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                  activeLine === i
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                บรรทัด {i + 1}
                {style.lineStyles?.[i] ? " •" : ""}
              </button>
            ))}
          </div>
        </Row>

        <div className="grid grid-cols-2 gap-4">
          <Row label="ฟอนต์บรรทัดนี้">
            <select
              value={line.fontFamily ?? ""}
              onChange={(e) => patchLine({ fontFamily: e.target.value || undefined })}
              className="h-9 w-full rounded-lg border border-border bg-secondary px-2 text-sm"
            >
              <option value="">ตามสไตล์หลัก</option>
              {fonts.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="สีตัวอักษร">
            <Input
              type="color"
              value={line.color ?? style.color}
              onChange={(e) => patchLine({ color: e.target.value })}
              className="h-9 cursor-pointer p-1"
            />
          </Row>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Row label="ขอบตัวอักษร">
            <Segmented
              value={line.stroke ?? style.stroke}
              options={sizes.map((s) => ({ label: s, value: s }))}
              onSelect={(v) => patchLine({ stroke: v })}
            />
          </Row>
          <Row label="สีขอบ">
            <Input
              type="color"
              value={line.strokeColor ?? style.strokeColor}
              onChange={(e) => patchLine({ strokeColor: e.target.value })}
              className="h-9 cursor-pointer p-1"
            />
          </Row>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Row label={`ความหนา — ${line.fontWeight ?? style.fontWeight}`}>
            <Slider
              value={[line.fontWeight ?? style.fontWeight]}
              min={300}
              max={900}
              step={100}
              onValueChange={([v]) => patchLine({ fontWeight: v ?? 700 })}
            />
          </Row>
          <Row label={`ระยะบรรทัดนี้ — ${(((line.gap ?? style.lineGap ?? 0.08)) * 100).toFixed(0)}%`}>
            <Slider
              value={[line.gap ?? style.lineGap ?? 0.08]}
              min={-0.1}
              max={0.8}
              step={0.02}
              onValueChange={([v]) => patchLine({ gap: v ?? 0.08 })}
            />
          </Row>
        </div>

        <button
          type="button"
          onClick={() => {
            const next = { ...(style.lineStyles ?? {}) };
            delete next[activeLine];
            onChange({ lineStyles: next });
          }}
          className="w-full rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          ล้างสไตล์ของบรรทัด {activeLine + 1}
        </button>
      </div>

    </div>
  );
}
