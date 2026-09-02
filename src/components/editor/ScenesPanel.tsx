import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { sceneDuration, viralTextWindow, type Scene, type SceneElement, type SceneElementKind } from "@/lib/scenes";
import { SFX_PRESETS, playSfxNow } from "@/lib/media/sfx";
import { Clock, Eye, EyeOff, Plus, Play, Scissors } from "lucide-react";

const VIRAL_PRESETS = ["ห้ามพลาด!! / ຫ້າມພາດ!!", "อันนี้คือจริง?! / ອັນນີ້ແມ່ນຈິງ?!", "ลองดูนี่เลย / ລອງເບິ່ງນີ້ເລີຍ", "รู้ยัง? / ຮູ້ບໍ?", "3 วิสุดท้ายสำคัญ / 3 ວິນາທີສຸດທ້າຍ"];

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
  onUpdateElementSound: (id: string, soundId: string) => void;
  onUpdateElementIntensity: (id: string, intensity: number) => void;
};


function clock(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ScenesPanel({ scenes, dropped, activeTime, onToggle, onPreview, onSeek, elements, onAddElement, onToggleElement, onUpdateElementText, onUpdateElementTiming, onUpdateElementSound, onUpdateElementIntensity }: Props) {
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
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3 text-xs">
        <span className="font-medium">{scenes.length} ซีน · ใช้จริง {keptTotal.toFixed(1)}s</span>
        <span className="text-muted-foreground">ปิดสวิตช์เพื่อลบซีนออกจากงานและไฟล์ที่ส่งออก</span>
      </div>
      {scenes.map((scene) => {
        const off = dropped.includes(scene.id);
        const active = activeTime >= scene.start && activeTime <= scene.end;
        return (
          <div
            key={scene.id}
            className={cn(
              "rounded-xl border p-3 transition",
              off ? "border-border bg-muted/40 opacity-60" : "border-border bg-card",
              active && !off && "border-primary ring-1 ring-primary/30",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onSeek(scene.start)}
                className="flex items-center gap-2 text-left"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-xs font-semibold">
                  {scene.index + 1}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {clock(scene.start)} – {clock(scene.end)} · {sceneDuration(scene).toFixed(1)}s
                </span>
              </button>
              <div className="flex items-center gap-2">
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
            <p className="mt-2 line-clamp-2 text-sm">
              {scene.text || <span className="text-muted-foreground">— ยังไม่มีซับในซีนนี้ —</span>}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              {elements.filter((element) => element.sceneId === scene.id).map((element) => (
                <Button
                  key={element.id}
                  size="sm"
                  variant={element.enabled ? "secondary" : "outline"}
                  onClick={() => onToggleElement(element.id)}
                  title={`${element.enabled ? "ปิด" : "เปิด"} ${element.label}`}
                >
                  {element.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {element.label}
                </Button>
              ))}
              {(["broll", "motion", "sound", "viralText"] as SceneElementKind[]).map((kind) => (
                elements.some((element) => element.sceneId === scene.id && element.kind === kind) ? null : (
                  <Button key={kind} size="sm" variant="ghost" onClick={() => onAddElement(scene.id, kind)}>
                    <Plus className="h-3.5 w-3.5" /> {kind === "viralText" ? "Viral text" : kind === "broll" ? "B-roll" : kind === "motion" ? "Motion" : "Sound"}
                  </Button>
                )
              ))}
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
          </div>
        );
      })}
    </div>
  );
}
