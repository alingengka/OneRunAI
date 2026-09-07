import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { sceneDuration, viralTextWindow, type Scene, type SceneElement, type SceneElementKind } from "@/lib/scenes";
import { AudioLines, Clapperboard, Clock, Eye, EyeOff, Plus, Play, Scissors, Type, Zap } from "lucide-react";

const VIRAL_PRESETS = ["ห้ามพลาด!! / ຫ້າມພາດ!!", "อันนี้คือจริง?! / ອັນນີ້ແມ່ນຈິງ?!", "ลองดูนี่เลย / ລອງເບິ່ງນີ້ເລີຍ", "รู้ยัง? / ຮູ້ບໍ?", "3 วิสุดท้ายสำคัญ / 3 ວິນາທີສຸດທ້າຍ"];

const elementKinds: { kind: SceneElementKind; label: string; icon: typeof Clapperboard }[] = [
  { kind: "broll", label: "B-roll", icon: Clapperboard },
  { kind: "motion", label: "Motion", icon: Zap },
  { kind: "sound", label: "Sound", icon: AudioLines },
  { kind: "viralText", label: "Viral text", icon: Type },
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
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ScenesPanel({ scenes, dropped, activeTime, onToggle, onPreview, onSeek, elements, onAddElement, onToggleElement, onUpdateElementText, onUpdateElementTiming, onUpdateElementFormat }: Props) {
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
          <p className="mt-1 text-muted-foreground">{scenes.length} ซีน · ความยาวที่ใช้จริง {keptTotal.toFixed(1)} วินาที</p>
        </div>
        <span className="hidden text-right text-muted-foreground sm:block">ปิดสวิตช์เพื่อตัดซีนออก</span>
      </div>
      {scenes.map((scene) => {
        const off = dropped.includes(scene.id);
        const active = activeTime >= scene.start && activeTime <= scene.end;
        const sceneElements = elements.filter((element) => element.sceneId === scene.id);
        const missingKinds = elementKinds.filter(({ kind }) => !sceneElements.some((element) => element.kind === kind));
        return (
          <article
            key={scene.id}
            className={cn(
              "overflow-hidden rounded-lg border transition-colors",
              off ? "border-border bg-muted/40 opacity-60" : "border-border bg-card",
              active && !off && "border-primary/70 ring-1 ring-primary/20",
            )}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4">
              <Button
                variant="ghost"
                onClick={() => onSeek(scene.start)}
                className="h-auto min-w-0 justify-start gap-3 p-0 text-left hover:bg-transparent"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                  {scene.index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-xs font-medium text-foreground">
                    {clock(scene.start)} – {clock(scene.end)}
                  </span>
                  <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">ความยาว {sceneDuration(scene).toFixed(1)} วินาที</span>
                </span>
              </Button>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="icon" variant="ghost" onClick={() => onPreview(scene.start, scene.end)} aria-label="เล่นซีนนี้">
                  <Play className="h-4 w-4" />
                </Button>
                <Switch
                  checked={!off}
                  onCheckedChange={(keep) => onToggle(scene.id, keep)}
                  aria-label={`ใช้ซีนที่ ${scene.index + 1}`}
                />
              </div>
            </div>
            <p className="px-4 pb-4 text-sm leading-6">
              {scene.text || <span className="text-muted-foreground">— ยังไม่มีซับในซีนนี้ —</span>}
            </p>
            <div className="flex flex-wrap items-center gap-2 border-t border-border bg-secondary/25 px-4 py-3">
              {sceneElements.map((element) => (
                <Button
                  key={element.id}
                  size="sm"
                  variant={element.enabled ? "secondary" : "outline"}
                  className={cn("h-8", !element.enabled && "text-muted-foreground")}
                  onClick={() => onToggleElement(element.id)}
                  title={`${element.enabled ? "ปิด" : "เปิด"} ${element.label}`}
                >
                  {element.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {element.label}
                </Button>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="ml-auto h-8 w-8 border border-dashed border-border" aria-label={`เพิ่มฟีเจอร์ให้ซีนที่ ${scene.index + 1}`} title="เพิ่มฟีเจอร์">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {missingKinds.length ? missingKinds.map(({ kind, label, icon: Icon }) => (
                    <DropdownMenuItem key={kind} onSelect={() => onAddElement(scene.id, kind)}>
                      <Icon /> {label}
                    </DropdownMenuItem>
                  )) : <DropdownMenuItem disabled>เพิ่มครบทุกฟีเจอร์แล้ว</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {elements
              .filter((element) => element.sceneId === scene.id && element.kind === "viralText" && element.enabled)
              .map((element) => {
                const sceneLen = Math.max(0.5, scene.end - scene.start);
                const offset = Math.min(Math.max(0, element.offset ?? 0), Math.max(0, sceneLen - 0.5));
                const dur = Math.min(Math.max(0.5, element.durationSec ?? 2.5), Math.max(0.5, sceneLen - offset));
                const win = viralTextWindow(scene, element);
                return (
                <div key={`${element.id}-editor`} className="mt-3 space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
                  <Input
                    value={element.text ?? ""}
                    placeholder="พิมพ์ข้อความไวรัล เช่น ห้ามพลาด!!"
                    onChange={(e) => onUpdateElementText(element.id, e.target.value)}
                  />
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
                      onClick={() => onUpdateElementFormat(element.id, { italic: !element.italic })}
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>เริ่มที่ (วินาทีจากต้นซีน)</span>
                      <span className="font-mono">{offset.toFixed(1)}s</span>
                    </div>
                    <Slider
                      value={[offset]}
                      min={0}
                      max={Math.max(0.1, sceneLen - 0.5)}
                      step={0.1}
                      onValueChange={([v]) => onUpdateElementTiming(element.id, v ?? 0, dur)}
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>ความยาวที่โชว์ (วินาที)</span>
                      <span className="font-mono">{dur.toFixed(1)}s</span>
                    </div>
                    <Slider
                      value={[dur]}
                      min={0.5}
                      max={Math.max(0.5, sceneLen - offset)}
                      step={0.1}
                      onValueChange={([v]) => onUpdateElementTiming(element.id, offset, v ?? 0.5)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() =>
                        onUpdateElementTiming(
                          element.id,
                          Math.min(Math.max(0, activeTime - scene.start), Math.max(0, sceneLen - 0.5)),
                          dur,
                        )
                      }
                    >
                      <Clock className="h-3.5 w-3.5" /> ตั้งจากตำแหน่งที่เล่นอยู่ตอนนี้
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    โชว์ช่วง {clock(win.start)} – {clock(win.end)} ของคลิป
                  </p>
                </div>
                );
              })}

            {off && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                <Scissors className="h-3 w-3" /> ซีนนี้จะถูกตัดออกจากไฟล์ส่งออก
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
