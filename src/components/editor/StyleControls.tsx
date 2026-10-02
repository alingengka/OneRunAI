import { useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  animationOptions,
  captionModeOf,
  fontOptions,
  sampleTextForLanguage,
  type CaptionStyle,
  type LineStyle,
  type StrokeSize,
} from "@/lib/captions";
import { cn } from "@/lib/utils";

type Props = {
  style: CaptionStyle;
  onChange: (patch: Partial<CaptionStyle>) => void;
  scripts?: ("latin" | "th" | "lo")[];
  lineCount?: number;
  language?: string;
};

const sizes: StrokeSize[] = ["none", "small", "medium", "large"];
const sizeLabels: Record<StrokeSize, string> = {
  none: "ปิด",
  small: "บาง",
  medium: "กลาง",
  large: "หนา",
};
const effectStrength: Record<StrokeSize, number> = { none: 0, small: 1, medium: 2, large: 3 };

function Segmented<T extends string>({
  value,
  options,
  onSelect,
}: {
  value: T;
  options: { label: string; value: T }[];
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-border bg-secondary p-0.5">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelect(option.value)}
          className={cn(
            "h-8 flex-1 px-2 text-xs capitalize shadow-none",
            value === option.value ? "bg-primary/15 text-primary" : "text-muted-foreground",
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function Control({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {value && <span className="font-mono text-xs text-muted-foreground">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function StylePreview({ style, text }: { style: CaptionStyle; text: string }) {
  const shadow = effectStrength[style.shadow];
  const stroke = effectStrength[style.stroke];
  return (
    <div className="flex aspect-[2.4/1] min-h-32 items-center justify-center overflow-hidden rounded-md border border-border bg-preview px-4">
      <span
        className="max-w-full truncate text-3xl"
        style={{
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          color: style.highlight === "box" ? style.highlightTextColor : style.color,
          background: style.highlight === "box" ? style.highlightColor : undefined,
          borderRadius: style.highlight === "box" ? 4 : undefined,
          padding: style.highlight === "box" ? "2px 8px" : undefined,
          WebkitTextStroke: stroke ? `${stroke}px ${style.strokeColor}` : undefined,
          textShadow: shadow ? `0 ${shadow}px ${shadow * 2}px ${style.shadowColor}` : undefined,
          textTransform: style.uppercase ? "uppercase" : "none",
          transform: style.italic ? "skewX(-12deg)" : undefined,
        }}
      >
        {text}
      </span>
    </div>
  );
}

export function StyleControls({ style, onChange, scripts, lineCount = 3, language }: Props) {
  const [activeLine, setActiveLine] = useState(0);
  const fonts =
    scripts && scripts.length
      ? fontOptions.filter((font) => font.scripts.some((script) => scripts.includes(script)))
      : fontOptions;
  const line: LineStyle = style.lineStyles?.[activeLine] ?? {};
  const patchLine = (patch: Record<string, unknown>) => {
    const merged: Record<string, unknown> = { ...line };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete merged[key];
      else merged[key] = value;
    }
    onChange({ lineStyles: { ...(style.lineStyles ?? {}), [activeLine]: merged as LineStyle } });
  };

  return (
    <div className="space-y-6">
      <StylePreview style={style} text={sampleTextForLanguage(language)} />

      <Control label="ฟอนต์">
        <select
          value={style.fontFamily}
          onChange={(event) => onChange({ fontFamily: event.target.value })}
          className="h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm text-foreground"
        >
          {fonts.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>
      </Control>

      <Control label="ขนาด" value={`${style.size.toFixed(1)}%`}>
        <Slider
          value={[style.size]}
          min={3}
          max={12}
          step={0.1}
          onValueChange={([value]) => onChange({ size: value ?? 6 })}
        />
      </Control>

      <Control label="รูปแบบตัวอักษร">
        <div className="grid grid-cols-4 gap-2">
          <Button
            type="button"
            variant={style.bold ? "secondary" : "outline"}
            aria-pressed={!!style.bold}
            onClick={() => onChange({ bold: !style.bold })}
            className={cn(style.bold && "border-primary bg-primary/15 text-primary")}
          >
            <strong>B</strong>
          </Button>
          <Button
            type="button"
            variant={style.italic ? "secondary" : "outline"}
            aria-pressed={!!style.italic}
            onClick={() => onChange({ italic: !style.italic })}
            className={cn("italic", style.italic && "border-primary bg-primary/15 text-primary")}
          >
            I
          </Button>
          <Button
            type="button"
            variant={style.shadow !== "none" ? "secondary" : "outline"}
            aria-pressed={style.shadow !== "none"}
            onClick={() => onChange({ shadow: style.shadow === "none" ? "small" : "none" })}
            className={cn(style.shadow !== "none" && "border-primary bg-primary/15 text-primary")}
          >
            เงา
          </Button>
          <Button
            type="button"
            variant={style.stroke !== "none" ? "secondary" : "outline"}
            aria-pressed={style.stroke !== "none"}
            onClick={() => onChange({ stroke: style.stroke === "none" ? "small" : "none" })}
            className={cn(style.stroke !== "none" && "border-primary bg-primary/15 text-primary")}
          >
            ขอบ
          </Button>
        </div>
      </Control>

      <div className="grid grid-cols-2 gap-4">
        <Control label="สีตัวอักษร">
          <Input
            type="color"
            value={style.color}
            onChange={(event) => onChange({ color: event.target.value })}
            className="h-10 cursor-pointer p-1"
          />
        </Control>
        <Control label={style.stroke !== "none" ? "สีขอบ" : "สีเงา"}>
          <Input
            type="color"
            value={style.stroke !== "none" ? style.strokeColor : style.shadowColor}
            onChange={(event) =>
              onChange(
                style.stroke !== "none"
                  ? { strokeColor: event.target.value }
                  : { shadowColor: event.target.value },
              )
            }
            className="h-10 cursor-pointer p-1"
          />
        </Control>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Control label="ความหนาขอบ" value={sizeLabels[style.stroke]}>
          <Segmented
            value={style.stroke}
            options={sizes.map((size) => ({ label: sizeLabels[size], value: size }))}
            onSelect={(value) => onChange({ stroke: value })}
          />
        </Control>
        <Control label="ความหนาเงา" value={sizeLabels[style.shadow]}>
          <Segmented
            value={style.shadow}
            options={sizes.map((size) => ({ label: sizeLabels[size], value: size }))}
            onSelect={(value) => onChange({ shadow: value })}
          />
        </Control>
      </div>

      <Accordion type="single" collapsible className="border-t border-border">
        <AccordionItem value="advanced" className="border-b-0">
          <AccordionTrigger className="hover:no-underline">การตั้งค่าขั้นสูง</AccordionTrigger>
          <AccordionContent className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Control label="ตัวพิมพ์ใหญ่">
                <Segmented
                  value={style.uppercase ? "yes" : "no"}
                  options={[
                    { label: "เปิด", value: "yes" },
                    { label: "ปิด", value: "no" },
                  ]}
                  onSelect={(value) => onChange({ uppercase: value === "yes" })}
                />
              </Control>
              <Control label="ตำแหน่งด่วน">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onChange({ posX: 50, posY: 78 })}
                  >
                    ล่าง
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onChange({ posX: 50, posY: 50 })}
                  >
                    กลาง
                  </Button>
                </div>
              </Control>
            </div>

            <Control
              label="จำนวนคำต่อซับ"
              value={
                captionModeOf(style) === "sentence"
                  ? "ทั้งประโยค"
                  : captionModeOf(style) === "word"
                    ? "ทีละคำ"
                    : `${style.wordsPerGroup} คำ`
              }
            >
              <Slider
                value={[captionModeOf(style) === "word" ? 1 : style.wordsPerGroup]}
                min={1}
                max={8}
                step={1}
                onValueChange={([value]) =>
                  onChange({
                    wordsPerGroup: value ?? 1,
                    captionMode: (value ?? 1) === 1 ? "word" : "fixed",
                  })
                }
              />
            </Control>
            <Control
              label="จำนวนคำต่อบรรทัด"
              value={style.wordsPerLine ? `${style.wordsPerLine} คำ` : "อัตโนมัติ"}
            >
              <Slider
                value={[style.wordsPerLine ?? 0]}
                min={0}
                max={4}
                step={1}
                onValueChange={([value]) => onChange({ wordsPerLine: value ?? 0 })}
              />
            </Control>
            <Control label="จัดวางข้อความ">
              <Segmented
                value={style.textAlign ?? "center"}
                options={[
                  { label: "ซ้าย", value: "left" as const },
                  { label: "กลาง", value: "center" as const },
                  { label: "ขวา", value: "right" as const },
                ]}
                onSelect={(value) => onChange({ textAlign: value })}
              />
            </Control>
            <div className="grid grid-cols-2 gap-4">
              <Control label="ตำแหน่ง Y" value={`${Math.round(style.posY)}%`}>
                <Slider
                  value={[style.posY]}
                  min={5}
                  max={95}
                  step={1}
                  onValueChange={([value]) => onChange({ posY: value ?? 68 })}
                />
              </Control>
              <Control label="ตำแหน่ง X" value={`${Math.round(style.posX)}%`}>
                <Slider
                  value={[style.posX]}
                  min={10}
                  max={90}
                  step={1}
                  onValueChange={([value]) => onChange({ posX: value ?? 50 })}
                />
              </Control>
            </div>
            <Control label="แอนิเมชัน">
              <div className="grid grid-cols-3 gap-2">
                {animationOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={style.animation === option.value ? "secondary" : "outline"}
                    onClick={() => onChange({ animation: option.value })}
                    className={cn(
                      style.animation === option.value &&
                        "border-primary bg-primary/15 text-primary",
                    )}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </Control>
            <Control label="ความเร็วแอนิเมชัน" value={`${(style.animationSpeed ?? 1).toFixed(2)}x`}>
              <Slider
                value={[style.animationSpeed ?? 1]}
                min={0.25}
                max={3}
                step={0.05}
                onValueChange={([value]) => onChange({ animationSpeed: value ?? 1 })}
              />
            </Control>
            <div className="grid grid-cols-2 gap-4">
              <Control label="พื้นหลังคำบรรยาย">
                <Segmented
                  value={style.plate ? "yes" : "no"}
                  options={[
                    { label: "เปิด", value: "yes" },
                    { label: "ปิด", value: "no" },
                  ]}
                  onSelect={(value) => onChange({ plate: value === "yes" })}
                />
              </Control>
              <Control label="สีพื้นหลัง">
                <Input
                  type="color"
                  value={style.plateColor}
                  onChange={(event) => onChange({ plateColor: event.target.value })}
                  className="h-9 cursor-pointer p-1"
                />
              </Control>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Control label="ไฮไลต์คำ">
                <Segmented
                  value={style.highlight}
                  options={[
                    { label: "ปิด", value: "none" as const },
                    { label: "สี", value: "color" as const },
                    { label: "กล่อง", value: "box" as const },
                  ]}
                  onSelect={(value) => onChange({ highlight: value })}
                />
              </Control>
              <Control label="สีไฮไลต์">
                <Input
                  type="color"
                  value={style.highlightColor}
                  onChange={(event) => onChange({ highlightColor: event.target.value })}
                  className="h-9 cursor-pointer p-1"
                />
              </Control>
            </div>
            <Control
              label="ระยะห่างบรรทัด"
              value={`${((style.lineGap ?? 0.08) * 100).toFixed(0)}%`}
            >
              <Slider
                value={[style.lineGap ?? 0.08]}
                min={-0.1}
                max={0.8}
                step={0.02}
                onValueChange={([value]) => onChange({ lineGap: value ?? 0.08 })}
              />
            </Control>

            <div className="space-y-4 rounded-md border border-border p-3">
              <Control label="สไตล์แยกรายบรรทัด">
                <div className="flex gap-2">
                  {Array.from({ length: Math.max(2, lineCount) }, (_, index) => index).map(
                    (index) => (
                      <Button
                        key={index}
                        type="button"
                        size="sm"
                        variant={activeLine === index ? "secondary" : "outline"}
                        onClick={() => setActiveLine(index)}
                        className={cn(
                          "flex-1",
                          activeLine === index && "border-primary bg-primary/15 text-primary",
                        )}
                      >
                        บรรทัด {index + 1}
                        {style.lineStyles?.[index] ? " •" : ""}
                      </Button>
                    ),
                  )}
                </div>
              </Control>
              <Control label="ฟอนต์บรรทัดนี้">
                <select
                  value={line.fontFamily ?? ""}
                  onChange={(event) => patchLine({ fontFamily: event.target.value || undefined })}
                  className="h-9 w-full rounded-md border border-border bg-secondary px-2 text-sm"
                >
                  <option value="">ตามสไตล์หลัก</option>
                  {fonts.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </Control>
              <div className="grid grid-cols-2 gap-4">
                <Control label="รูปแบบบรรทัดนี้">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant={(line.bold ?? style.bold) ? "secondary" : "outline"}
                      onClick={() =>
                        patchLine({ bold: (line.bold ?? style.bold) ? undefined : true })
                      }
                    >
                      B
                    </Button>
                    <Button
                      size="sm"
                      variant={(line.italic ?? style.italic) ? "secondary" : "outline"}
                      onClick={() =>
                        patchLine({ italic: (line.italic ?? style.italic) ? undefined : true })
                      }
                      className="italic"
                    >
                      I
                    </Button>
                  </div>
                </Control>
                <Control label="สีบรรทัดนี้">
                  <Input
                    type="color"
                    value={line.color ?? style.color}
                    onChange={(event) => patchLine({ color: event.target.value })}
                    className="h-9 cursor-pointer p-1"
                  />
                </Control>
              </div>
              <Control label="ความหนาฟอนต์" value={`${line.fontWeight ?? style.fontWeight}`}>
                <Slider
                  value={[line.fontWeight ?? style.fontWeight]}
                  min={300}
                  max={900}
                  step={100}
                  onValueChange={([value]) => patchLine({ fontWeight: value ?? 700 })}
                />
              </Control>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const next = { ...(style.lineStyles ?? {}) };
                  delete next[activeLine];
                  onChange({ lineStyles: next });
                }}
              >
                ล้างสไตล์ของบรรทัด {activeLine + 1}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
