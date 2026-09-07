import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  sceneDuration,
  viralTextWindow,
  type Scene,
  type SceneElement,
  type SceneElementKind,
} from "@/lib/scenes";
import { motionKindForScene, type MotionKind } from "@/lib/media/motion";
import {
  AudioLines,
  Clock,
  Eye,
  Image as ImageIcon,
  Move,
  Plus,
  Play,
  RotateCcw,
  Scissors,
  Sparkles,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

const VIRAL_PRESETS = [
  "ห้ามพลาด!! / ຫ້າມພາດ!!",
  "อันนี้คือจริง?! / ອັນນີ້ແມ່ນຈິງ?!",
  "ลองดูนี่เลย / ລອງເບິ່ງນີ້ເລີຍ",
  "รู้ยัง? / ຮູ້ບໍ?",
  "3 วิสุดท้ายสำคัญ / 3 ວິນາທີສຸດທ້າຍ",
];

const KIND_ICON: Record<SceneElementKind, typeof Type> = {
  broll: ImageIcon,
  motion: Sparkles,
  sound: AudioLines,
  viralText: Type,
};

const MEDIA_KINDS: { kind: SceneElementKind; label: string }[] = [
  { kind: "broll", label: "B-roll" },
];
const EFFECT_KINDS: { kind: SceneElementKind; label: string }[] = [
  { kind: "motion", label: "Motion" },
  { kind: "sound", label: "Sound" },
  { kind: "viralText", label: "Viral text" },
];

const MOTION_PATTERNS: { kind: MotionKind; label: string; icon: typeof ZoomIn }[] = [
  { kind: "zoom-in", label: "ซูมเข้า", icon: ZoomIn },
  { kind: "zoom-out", label: "ซูมออก", icon: ZoomOut },
  { kind: "pan-left", label: "แพนซ้าย", icon: Move },
  { kind: "pan-right", label: "แพนขวา", icon: Move },
];

type Props = {
  scenes: Scene[];
  dropped: string[];
  activeTime: number;
  onToggle: (id: string, keep: boolean) => void;
  onPreview: (start: number, end: number) => void;
  onSeek: (time: number) => void;
  elements: SceneElement[];
  onAddElement: (sceneId: string, kind: SceneElementKind) => void;
  onToggleElement: (id: string) => void;
  onUpdateElementText: (id: string, text: string) => void;
  onUpdateElementTiming: (id: string, offset: number, durationSec: number) => void;
  onUpdateElementFormat: (id: string, patch: { bold?: boolean; italic?: boolean }) => void;
};

function clock(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function ScenesPanel({
  scenes,
  dropped,
  activeTime,
  onToggle,
  onPreview,
  onSeek,
  elements,
  onAddElement,
  onToggleElement,
  onUpdateElementText,
  onUpdateElementTiming,
  onUpdateElementFormat,
}: Props) {
  if (!scenes.length) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        อัปโหลดคลิปแล้วกดวิเคราะห์เสียง ระบบจะแบ่งคลิปเป็นซีนให้อัตโนมัติ
      </p>
    );
  }
  const keptTotal = scenes
    .filter((s) => !dropped.includes(s.id))
    .reduce((n, s) => n + sceneDuration(s), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border pb-4 text-xs">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">ลำดับซีน</p>
          <p className="mt-1 text-muted-foreground">
            {scenes.length} ซีน · ความยาวที่ใช้จริง {keptTotal.toFixed(1)} วินาที
          </p>
        </div>
        <span className="hidden text-right text-muted-foreground sm:block">
          ปิดสวิตช์เพื่อตัดซีนออก
        </span>
      </div>

      {scenes.map((scene) => {
        const off = dropped.includes(scene.id);
        const active = activeTime >= scene.start && activeTime <= scene.end;
        const sceneElements = elements.filter((element) => element.sceneId === scene.id);
        const enabledElements = sceneElements.filter((element) => element.enabled);
        const motionKind = motionKindForScene(scene.index);
        const hasMotion = enabledElements.some((element) => element.kind === "motion");
        const missing = (list: { kind: SceneElementKind; label: string }[]) =>
          list.filter(({ kind }) => !enabledElements.some((element) => element.kind === kind));
        const mediaLeft = missing(MEDIA_KINDS);
        const effectsLeft = missing(EFFECT_KINDS);

        return (
          <article
            key={scene.id}
            className={cn(
              "overflow-hidden rounded-xl border transition-colors",
              off ? "border-border bg-muted/40 opacity-60" : "border-border bg-card",
              active && !off && "border-primary/70 ring-1 ring-primary/20",
            )}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4">
              <Button
                variant="ghost"
                onClick={() => onSeek(scene.start)}
                className="h-auto min-w-0 flex-col items-start justify-start gap-1.5 whitespace-normal p-0 text-left hover:bg-transparent"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary">
                    {scene.index + 1}
                  </span>
                  <span className="font-mono text-[11px] font-medium text-muted-foreground">
                    {clock(scene.start)} – {clock(scene.end)}
                  </span>
                </span>
                <span className="block text-sm font-medium leading-6 text-foreground">
                  {scene.text || (
                    <span className="font-normal text-muted-foreground">
                      — ยังไม่มีซับในซีนนี้ —
                    </span>
                  )}
                </span>
              </Button>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onPreview(scene.start, scene.end)}
                  aria-label="เล่นซีนนี้"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Switch
                  checked={!off}
                  onCheckedChange={(keep) => onToggle(scene.id, keep)}
                  aria-label={`ใช้ซีนที่ ${scene.index + 1}`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border bg-secondary/25 px-4 py-3">
              {enabledElements.map((element) => {
                const Icon = KIND_ICON[element.kind];
                return (
                  <span
                    key={element.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 pl-2.5 pr-1 text-xs font-medium text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {element.label}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-full"
                      onClick={() => onPreview(scene.start, scene.end)}
                      aria-label={`ดูตัวอย่าง ${element.label} ของซีนที่ ${scene.index + 1}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-full"
                      onClick={() => onToggleElement(element.id)}
                      aria-label={`ปิด ${element.label} ของซีนที่ ${scene.index + 1}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                );
              })}
              {!enabledElements.length && (
                <span className="text-xs text-muted-foreground">ยังไม่มีฟีเจอร์ในซีนนี้</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto h-8 w-8 border border-dashed border-border"
                    aria-label={`เพิ่มฟีเจอร์ให้ซีนที่ ${scene.index + 1}`}
                    title="เพิ่มฟีเจอร์"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {!mediaLeft.length && !effectsLeft.length && (
                    <DropdownMenuItem disabled>เพิ่มครบทุกฟีเจอร์แล้ว</DropdownMenuItem>
                  )}
                  {mediaLeft.length > 0 && (
                    <>
                      <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground">
                        Media
                      </DropdownMenuLabel>
                      {mediaLeft.map(({ kind, label }) => {
                        const Icon = KIND_ICON[kind];
                        return (
                          <DropdownMenuItem
                            key={kind}
                            onSelect={() => onAddElement(scene.id, kind)}
                          >
                            <Icon /> {label}
                          </DropdownMenuItem>
                        );
                      })}
                    </>
                  )}
                  {mediaLeft.length > 0 && effectsLeft.length > 0 && <DropdownMenuSeparator />}
                  {effectsLeft.length > 0 && (
                    <>
                      <DropdownMenuLabel className="text-[11px] uppercase text-muted-foreground">
                        Effects
                      </DropdownMenuLabel>
                      {effectsLeft.map(({ kind, label }) => {
                        const Icon = KIND_ICON[kind];
                        return (
                          <DropdownMenuItem
                            key={kind}
                            onSelect={() => onAddElement(scene.id, kind)}
                          >
                            <Icon /> {label}
                          </DropdownMenuItem>
                        );
                      })}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {hasMotion && (
              <div className="space-y-2 border-t border-border px-4 py-3">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                  แพทเทิร์นการเคลื่อนกล้องของซีนนี้
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MOTION_PATTERNS.map(({ kind, label, icon: Icon }) => {
                    const on = kind === motionKind;
                    return (
                      <div
                        key={kind}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 rounded-lg border bg-preview p-3 text-center",
                          on
                            ? "border-primary/70 ring-1 ring-primary/25"
                            : "border-border opacity-60",
                        )}
                      >
                        <Icon
                          className={cn("h-5 w-5", on ? "text-primary" : "text-muted-foreground")}
                        />
                        <span className="text-[11px] text-foreground">{label}</span>
                        {on && (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-primary/15 px-1.5 text-[9px] font-medium text-primary">
                            ใช้อยู่
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  ระบบสลับแพทเทิร์นให้อัตโนมัติตามลำดับซีน (ยังเลือกเองไม่ได้)
                </p>
              </div>
            )}

            {sceneElements
              .filter((element) => element.kind === "viralText" && element.enabled)
              .map((element) => {
                const sceneLen = Math.max(0.5, scene.end - scene.start);
                const offset = Math.min(
                  Math.max(0, element.offset ?? 0),
                  Math.max(0, sceneLen - 0.5),
                );
                const dur = Math.min(
                  Math.max(0.5, element.durationSec ?? 2.5),
                  Math.max(0.5, sceneLen - offset),
                );
                const win = viralTextWindow(scene, element);
                return (
                  <div
                    key={`${element.id}-editor`}
                    className="space-y-4 border-t border-border px-4 py-4"
                  >
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        ข้อความไวรัล
                      </p>
                      <Input
                        value={element.text ?? ""}
                        placeholder="พิมพ์ข้อความไวรัล เช่น ห้ามพลาด!!"
                        onChange={(e) => onUpdateElementText(element.id, e.target.value)}
                      />
                      <div className="flex min-h-14 items-center justify-center rounded-lg border border-border bg-preview px-3 py-4">
                        <span
                          className={cn(
                            "text-center text-base text-foreground",
                            element.bold && "font-bold",
                            element.italic && "italic",
                          )}
                        >
                          {element.text || (
                            <span className="text-muted-foreground">ตัวอย่างข้อความ</span>
                          )}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={element.bold ? "default" : "outline"}
                          className="h-7 w-9 font-bold"
                          aria-pressed={!!element.bold}
                          onClick={() => onUpdateElementFormat(element.id, { bold: !element.bold })}
                        >
                          B
                        </Button>
                        <Button
                          size="sm"
                          variant={element.italic ? "default" : "outline"}
                          className="h-7 w-9 italic"
                          aria-pressed={!!element.italic}
                          onClick={() =>
                            onUpdateElementFormat(element.id, { italic: !element.italic })
                          }
                        >
                          I
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {VIRAL_PRESETS.map((preset) => (
                          <Button
                            key={preset}
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => onUpdateElementText(element.id, preset)}
                          >
                            {preset}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        จังหวะที่โชว์
                      </p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>เริ่มที่ (วินาทีจากต้นซีน)</span>
                          <span className="flex items-center gap-1">
                            <span className="font-mono text-foreground">{offset.toFixed(1)}s</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              aria-label="รีเซ็ตเวลาเริ่ม"
                              onClick={() => onUpdateElementTiming(element.id, 0, dur)}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </span>
                        </div>
                        <Slider
                          value={[offset]}
                          min={0}
                          max={Math.max(0.1, sceneLen - 0.5)}
                          step={0.1}
                          onValueChange={([v]) => onUpdateElementTiming(element.id, v ?? 0, dur)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>ความยาวที่โชว์ (วินาที)</span>
                          <span className="flex items-center gap-1">
                            <span className="font-mono text-foreground">{dur.toFixed(1)}s</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              aria-label="รีเซ็ตความยาว"
                              onClick={() => onUpdateElementTiming(element.id, offset, 2.5)}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          </span>
                        </div>
                        <Slider
                          value={[dur]}
                          min={0.5}
                          max={Math.max(0.5, sceneLen - offset)}
                          step={0.1}
                          onValueChange={([v]) =>
                            onUpdateElementTiming(element.id, offset, v ?? 0.5)
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-[11px]"
                          onClick={() =>
                            onUpdateElementTiming(
                              element.id,
                              Math.min(
                                Math.max(0, activeTime - scene.start),
                                Math.max(0, sceneLen - 0.5),
                              ),
                              dur,
                            )
                          }
                        >
                          <Clock className="h-3.5 w-3.5" /> ตั้งจากตำแหน่งที่เล่นอยู่ตอนนี้
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-[11px]"
                          onClick={() => onUpdateElementTiming(element.id, 0, 2.5)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> รีเซ็ตจังหวะ
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        โชว์ช่วง {clock(win.start)} – {clock(win.end)} ของคลิป
                        (บันทึกให้อัตโนมัติทันทีที่ปรับ)
                      </p>
                    </div>
                  </div>
                );
              })}

            {off && (
              <p className="flex items-center gap-1 px-4 pb-3 text-[11px] text-destructive">
                <Scissors className="h-3 w-3" /> ซีนนี้จะถูกตัดออกจากไฟล์ส่งออก
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
