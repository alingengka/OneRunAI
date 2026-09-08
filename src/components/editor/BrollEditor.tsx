import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrollPicker } from "@/components/editor/BrollPicker";
import type { SceneAssetPatch, SceneElement } from "@/lib/scenes";
import { AlertTriangle, Image as ImageIcon, RotateCcw, Replace } from "lucide-react";

type Props = {
  element: SceneElement;
  sceneText: string;
  onUpdateAsset: (patch: SceneAssetPatch) => void;
};

/** แผงเลือกสื่อ B-roll ของซีน (โชว์แทนภาพต้นฉบับตลอดช่วงซีน) */
export function BrollEditor({ element, sceneText, onUpdateAsset }: Props) {
  const [open, setOpen] = useState(false);
  const defaultQuery = (element.searchQuery ?? sceneText).slice(0, 60);

  return (
    <div className="space-y-3 border-t border-border px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        สื่อ B-roll (แสดงแทนภาพต้นฉบับในซีนนี้)
      </p>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-preview">
          {element.assetUrl ? (
            element.assetType === "video" ? (
              <video src={element.assetUrl} className="h-full w-full object-cover" muted loop playsInline autoPlay />
            ) : (
              <img src={element.assetUrl} alt="สื่อ B-roll" className="h-full w-full object-cover" />
            )
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">
            {element.assetUrl
              ? element.assetSource === "klipy"
                ? "คลิปจากคลัง KLIPY"
                : "ไฟล์ที่คุณอัปโหลดเอง"
              : "ยังไม่ได้เลือกสื่อ"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => setOpen(true)}>
              <Replace className="h-3.5 w-3.5" /> เปลี่ยนสื่อ
            </Button>
            {element.assetUrl && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-[11px]"
                onClick={() =>
                  onUpdateAsset({ assetUrl: undefined, assetType: undefined, assetSource: undefined })
                }
              >
                <RotateCcw className="h-3.5 w-3.5" /> เอาสื่อออก
              </Button>
            )}
          </div>
        </div>
      </div>

      {element.assetSource === "klipy" && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-[11px] text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          คลิปจาก KLIPY อาจมีลิขสิทธิ์จากภาพยนตร์/รายการทีวี ตรวจสอบสิทธิ์การใช้งานก่อนเผยแพร่จริง
        </p>
      )}

      {open && (
        <BrollPicker
          open={open}
          onOpenChange={setOpen}
          defaultQuery={defaultQuery}
          onPick={onUpdateAsset}
        />
      )}
    </div>
  );
}
