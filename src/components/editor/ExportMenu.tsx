import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ExportResolution } from "@/lib/media/burn-render";

export type ExportType = "captions" | "clean" | "srt";

export type ExportSettings = {
  resolution: ExportResolution;
  fps: number;
  type: ExportType;
};

const QUALITY: { value: ExportResolution; label: string; short: string }[] = [
  { value: "source", label: "ต้นฉบับ", short: "ต้นฉบับ" },
  { value: "4k", label: "Ultra HD (4K)", short: "4K" },
  { value: "1080", label: "Full HD (1080p)", short: "1080p" },
  { value: "720", label: "HD (720p)", short: "720p" },
];

const FPS = [24, 25, 29.97, 30, 60];

const TYPES: { value: ExportType; label: string }[] = [
  { value: "captions", label: "พร้อมซับ" },
  { value: "clean", label: "ไม่มีซับ" },
  { value: "srt", label: "ไฟล์ซับ (.srt)" },
];

const PRESET_KEY = "onerun-export-preset";

export function loadExportPreset(): ExportSettings | null {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    return raw ? (JSON.parse(raw) as ExportSettings) : null;
  } catch {
    return null;
  }
}

function savePreset(settings: ExportSettings | null) {
  try {
    if (settings) localStorage.setItem(PRESET_KEY, JSON.stringify(settings));
    else localStorage.removeItem(PRESET_KEY);
  } catch {
    // storage blocked: the preset just is not remembered
  }
}

type Props = {
  settings: ExportSettings;
  onChange: (patch: Partial<ExportSettings>) => void;
  onExport: () => void;
  busy: boolean;
  disabled: boolean;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

const triggerClass =
  "h-9 w-auto gap-1.5 border-0 bg-transparent px-1 text-sm shadow-none focus:ring-0 focus-visible:ring-1";

/** Header export button with a compact settings popover (Klipr-style). */
export function ExportMenu({ settings, onChange, onExport, busy, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    setRemember(loadExportPreset() !== null);
  }, []);

  useEffect(() => {
    if (remember) savePreset(settings);
  }, [remember, settings]);

  const quality = QUALITY.find((q) => q.value === settings.resolution) ?? QUALITY[0]!;
  const badge = settings.type === "srt" ? "SRT" : `${quality.short} • ${settings.fps}fps`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button className="px-3 sm:px-4" aria-label="ส่งออก">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
          ) : (
            <Download className="h-4 w-4 sm:mr-2" />
          )}
          <span className="hidden sm:inline">ส่งออก</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(340px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <h2 className="text-base font-bold">ส่งออกวิดีโอ</h2>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
            {badge}
          </span>
        </div>
        <div className="px-4">
          <Row label="คุณภาพ">
            <Select
              value={settings.resolution}
              disabled={settings.type === "srt"}
              onValueChange={(value) => onChange({ resolution: value as ExportResolution })}
            >
              <SelectTrigger className={triggerClass} aria-label="คุณภาพ">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {QUALITY.map((q) => (
                  <SelectItem key={q.value} value={q.value}>
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="FPS">
            <Select
              value={String(settings.fps)}
              disabled={settings.type === "srt"}
              onValueChange={(value) => onChange({ fps: Number(value) })}
            >
              <SelectTrigger className={triggerClass} aria-label="FPS">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {FPS.map((fps) => (
                  <SelectItem key={fps} value={String(fps)}>
                    {fps}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="ประเภท">
            <Select
              value={settings.type}
              onValueChange={(value) => onChange({ type: value as ExportType })}
            >
              <SelectTrigger className={triggerClass} aria-label="ประเภท">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label="จำค่าที่ตั้งไว้">
            <Switch
              checked={remember}
              aria-label="จำค่าที่ตั้งไว้"
              onCheckedChange={(checked) => {
                setRemember(checked);
                if (!checked) savePreset(null);
              }}
            />
          </Row>
          {settings.resolution === "4k" && settings.type !== "srt" && (
            <p className="pt-2 text-xs text-muted-foreground">
              4K ใช้เวลาเรนเดอร์นานกว่ามาก แนะนำ 1080p สำหรับ TikTok / Reels
            </p>
          )}
        </div>
        <div className="p-4">
          <Button
            className="h-11 w-full text-base"
            disabled={disabled || busy}
            onClick={() => {
              setOpen(false);
              onExport();
            }}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ส่งออก
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
