import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { sceneDuration, type Scene, type SceneElement, type SceneElementKind } from "@/lib/scenes";
import { Eye, EyeOff, Plus, Play, Scissors } from "lucide-react";

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
};

function clock(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ScenesPanel({ scenes, dropped, activeTime, onToggle, onPreview, onSeek, elements, onAddElement, onToggleElement }: Props) {
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
