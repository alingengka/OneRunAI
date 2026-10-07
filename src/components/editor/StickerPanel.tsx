import { useEffect, useRef, useState } from "react";
import { Clock, ImagePlus, Loader2, RotateCw, Search, Sparkles, Trash2, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { searchKlipyMedia, type KlipyItem } from "@/lib/klipy.functions";
import { klipyCustomerId } from "@/lib/klipy-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  EMOJIS,
  GRAPHICS,
  NOTO_CREDIT,
  createStickerLayer,
  newStickerId,
  type GraphicId,
  type Sticker,
} from "@/lib/media/stickers";
import {
  loadStickerLibrary,
  saveStickerLibrary,
  stickerFromFile,
  type LibrarySticker,
} from "@/lib/sticker-library";

type Props = {
  stickers: Sticker[];
  time: number;
  duration: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (sticker: Sticker) => void;
  onChange: (id: string, patch: Partial<Sticker>) => void;
  onRemove: (id: string) => void;
  onAutoEmoji: () => void;
  canAuto: boolean;
};

/** Small looping preview of a motion graphic or uploaded Lottie for the picker. */
function GraphicThumb({
  id,
  color,
  kind = "graphic",
}: {
  id: GraphicId | string;
  color?: string;
  kind?: "graphic" | "lottie";
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const layer = createStickerLayer(96);
    const sticker: Sticker = {
      id: "thumb",
      kind,
      asset: id,
      start: 0,
      end: 1e9,
      x: 50,
      y: 50,
      size: 80,
      rotation: 0,
      color,
    };
    if (kind === "lottie") void layer.prepare([sticker]);
    let raf = 0;
    const started = performance.now();
    const tick = () => {
      const t = ((performance.now() - started) / 1000) % 2.2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      layer.draw(ctx, [sticker], t + 0.001, canvas.width, canvas.height);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      layer.destroy();
    };
  }, [id, color, kind]);
  return <canvas ref={ref} width={96} height={96} className="h-12 w-12" aria-hidden="true" />;
}

const label = (sticker: Sticker) =>
  sticker.kind === "text"
    ? `ข้อความ: ${sticker.asset}`
    : sticker.kind === "emoji"
    ? (EMOJIS.find((e) => e.code === sticker.asset)?.char ?? "🙂")
    : sticker.kind === "image"
      ? "รูปของฉัน"
      : sticker.kind === "animated"
        ? "สติกเกอร์ KLIPY"
        : sticker.kind === "lottie"
          ? "แอนิเมชันของฉัน"
          : (GRAPHICS.find((g) => g.id === sticker.asset)?.label ?? sticker.asset);

export function StickerPanel({
  stickers,
  time,
  duration,
  selectedId,
  onSelect,
  onAdd,
  onChange,
  onRemove,
  onAutoEmoji,
  canAuto,
}: Props) {
  const [kind, setKind] = useState<"emoji" | "graphic" | "klipy" | "mine">("emoji");
  const searchKlipy = useServerFn(searchKlipyMedia);
  const [klipyQuery, setKlipyQuery] = useState("");
  const [klipyItems, setKlipyItems] = useState<KlipyItem[]>([]);
  const [klipyLoading, setKlipyLoading] = useState(false);
  const [klipyError, setKlipyError] = useState<string | null>(null);
  const runKlipy = async () => {
    const q = klipyQuery.trim();
    if (!q) return;
    setKlipyLoading(true);
    setKlipyError(null);
    try {
      const result = await searchKlipy({
        data: { query: q, kind: "stickers", customerId: klipyCustomerId() },
      });
      setKlipyItems(result.items);
      if (!result.items.length) setKlipyError("ไม่พบสติกเกอร์ ลองคำอื่น (ภาษาอังกฤษได้ผลดีที่สุด)");
    } catch (error) {
      setKlipyError(error instanceof Error ? error.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setKlipyLoading(false);
    }
  };
  const [library, setLibrary] = useState<LibrarySticker[]>([]);
  const uploadRef = useRef<HTMLInputElement>(null);
  useEffect(() => setLibrary(loadStickerLibrary()), []);
  const updateLibrary = (next: LibrarySticker[]) => {
    if (!saveStickerLibrary(next)) {
      toast.error("พื้นที่เก็บในเบราว์เซอร์เต็ม ลบสติกเกอร์เก่าบางอันก่อน");
      return false;
    }
    setLibrary(next);
    return true;
  };
  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    let added = 0;
    let next = library;
    for (const file of Array.from(files)) {
      try {
        const item = await stickerFromFile(file);
        next = [item, ...next];
        added++;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "เพิ่มสติกเกอร์ไม่สำเร็จ");
      }
    }
    if (added && updateLibrary(next)) toast.success(`เพิ่มสติกเกอร์ของคุณแล้ว ${added} ชิ้น`);
  };
  const add = (sticker: Omit<Sticker, "id" | "start" | "end">) => {
    const start = Math.max(0, Math.min(time, Math.max(0, duration - 0.5)));
    onAdd({
      ...sticker,
      id: newStickerId(),
      start,
      end: Math.min(duration || start + 2, start + 2),
    });
  };
  const sorted = [...stickers].sort((a, b) => a.start - b.start);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="ชนิดสติกเกอร์" className="flex rounded-lg bg-secondary p-1">
          {(
            [
              ["emoji", "อิโมจิ"],
              ["graphic", "Motion Graphic"],
              ["klipy", "KLIPY"],
              ["mine", "ของฉัน"],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={kind === key}
              onClick={() => setKind(key)}
              className={cn(
                "h-9 rounded-md px-3 text-sm transition-colors",
                kind === key
                  ? "bg-background font-semibold text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {text}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" disabled={!canAuto} onClick={onAutoEmoji}>
          <Sparkles className="mr-1.5 h-4 w-4" /> ใส่อิโมจิอัตโนมัติจากซับ
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        แตะเพื่อเพิ่มที่เวลาปัจจุบัน ({time.toFixed(1)} วิ) แล้วลากบนวิดีโอเพื่อย้าย ·
        ลากจุดมุมเพื่อย่อ/ขยาย · ลากปุ่มด้านบนเพื่อหมุน
      </p>

      {kind === "klipy" ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={klipyQuery}
              placeholder="ค้นหาสติกเกอร์ เช่น wow, love, money"
              onChange={(event) => setKlipyQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void runKlipy();
              }}
            />
            <Button onClick={() => void runKlipy()} disabled={klipyLoading || !klipyQuery.trim()}>
              {klipyLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              ค้นหา
            </Button>
          </div>
          {klipyError && <p className="text-xs text-destructive">{klipyError}</p>}
          <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
            {klipyItems.map((item) => (
              <button
                key={item.id}
                type="button"
                title={item.title}
                aria-label={`เพิ่มสติกเกอร์ ${item.title}`}
                onClick={() =>
                  add({
                    kind: "animated",
                    asset: item.assetUrl,
                    x: 50,
                    y: 40,
                    size: 24,
                    rotation: 0,
                  })
                }
                className="grid aspect-square place-items-center rounded-lg border border-border bg-preview p-1 transition hover:border-primary/60 active:scale-95"
              >
                <img
                  src={item.previewUrl}
                  alt=""
                  loading="lazy"
                  className="max-h-full max-w-full object-contain"
                />
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            สติกเกอร์จาก KLIPY เป็นผลงานของผู้ใช้ทั่วไป บางชิ้นอาจมีลิขสิทธิ์
            ตรวจสอบก่อนใช้เชิงพาณิชย์ · เคลื่อนไหวในไฟล์ Export บน Chrome/Edge/Android (Safari
            จะเป็นภาพนิ่ง)
          </p>
        </div>
      ) : kind === "mine" ? (
        <div className="space-y-3">
          <input
            ref={uploadRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,application/json,.json"
            multiple
            className="hidden"
            onChange={(event) => {
              void onUpload(event.target.files);
              event.target.value = "";
            }}
          />
          <Button variant="secondary" className="w-full" onClick={() => uploadRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" /> อัปโหลดสติกเกอร์ (PNG, JPG, WebP หรือ Lottie
            .json)
          </Button>
          {library.length ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {library.map((item) => (
                <div key={item.id} className="relative">
                  <button
                    type="button"
                    aria-label={`เพิ่มสติกเกอร์ ${item.name}`}
                    title={item.name}
                    onClick={() =>
                      add({
                        kind: item.kind,
                        asset: item.asset,
                        x: 50,
                        y: 40,
                        size: 24,
                        rotation: 0,
                      })
                    }
                    className="grid aspect-square w-full place-items-center rounded-lg border border-border bg-preview p-1.5 transition hover:border-primary/60 active:scale-95"
                  >
                    {item.kind === "image" ? (
                      <img
                        src={item.asset}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <GraphicThumb id={item.asset} kind="lottie" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`ลบ ${item.name} ออกจากคลัง`}
                    onClick={() => updateLibrary(library.filter((x) => x.id !== item.id))}
                    className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-background text-muted-foreground shadow ring-1 ring-border hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              ยังไม่มีสติกเกอร์ของคุณ — อัปโหลดรูปโลโก้ รูปสินค้า หรือไฟล์ Lottie จาก LottieFiles
              แล้วใช้ซ้ำได้ทุกโปรเจกต์
            </p>
          )}
        </div>
      ) : kind === "emoji" ? (
        <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji.code}
              type="button"
              aria-label={`เพิ่มอิโมจิ ${emoji.char}`}
              onClick={() =>
                add({ kind: "emoji", asset: emoji.code, x: 74, y: 38, size: 16, rotation: 0 })
              }
              className="grid aspect-square place-items-center rounded-lg text-2xl transition hover:bg-secondary active:scale-95"
            >
              {emoji.char}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {GRAPHICS.map((graphic) => (
            <button
              key={graphic.id}
              type="button"
              onClick={() =>
                add({
                  kind: "graphic",
                  asset: graphic.id,
                  x: 50,
                  y: graphic.id === "follow" ? 82 : 45,
                  size: graphic.id === "underline" ? 30 : 22,
                  rotation: 0,
                  color: graphic.color,
                })
              }
              className="flex flex-col items-center gap-1 rounded-lg border border-border bg-preview p-2 text-[11px] text-muted-foreground transition hover:border-primary/60 active:scale-95"
            >
              <GraphicThumb id={graphic.id} color={graphic.color} />
              {graphic.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-sm font-semibold">สติกเกอร์ในคลิป ({stickers.length})</p>
        {!sorted.length && <p className="text-xs text-muted-foreground">ยังไม่มีสติกเกอร์</p>}
        {sorted.map((sticker) => {
          const selected = sticker.id === selectedId;
          return (
            <div
              key={sticker.id}
              className={cn(
                "space-y-2 rounded-xl border p-3 transition-colors",
                selected ? "border-primary/60 bg-primary/5" : "border-border",
              )}
              onClick={() => onSelect(sticker.id)}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    sticker.kind === "emoji" ? "text-xl" : "text-sm font-medium",
                  )}
                >
                  {label(sticker)}
                </span>
                {sticker.kind === "graphic" && (
                  <Input
                    type="color"
                    aria-label="สีของกราฟิก"
                    value={sticker.color ?? "#facc15"}
                    onChange={(event) => onChange(sticker.id, { color: event.target.value })}
                    className="h-8 w-10 cursor-pointer p-0.5"
                  />
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 px-2 text-xs"
                  aria-label="หมุนสติกเกอร์ 15 องศา"
                  title="หมุน 15° (ลากปุ่มหมุนบนวิดีโอได้ด้วย)"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(sticker.id, { rotation: ((sticker.rotation + 15 + 180) % 360) - 180 });
                  }}
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  {Math.round(sticker.rotation)}°
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label="ลบสติกเกอร์"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(sticker.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["start", "end"] as const).map((field) => (
                  <label
                    key={field}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    {field === "start" ? "เริ่ม" : "จบ"}
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      value={sticker[field].toFixed(1)}
                      onChange={(event) => {
                        const value = Math.max(0, Number(event.target.value) || 0);
                        onChange(
                          sticker.id,
                          field === "start"
                            ? { start: Math.min(value, sticker.end - 0.2) }
                            : { end: Math.max(value, sticker.start + 0.2) },
                        );
                      }}
                      className="h-8 px-2 text-xs"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      aria-label={field === "start" ? "เริ่มที่เวลาปัจจุบัน" : "จบที่เวลาปัจจุบัน"}
                      title="ใช้เวลาปัจจุบัน"
                      onClick={(event) => {
                        event.stopPropagation();
                        onChange(
                          sticker.id,
                          field === "start"
                            ? { start: Math.min(time, sticker.end - 0.2) }
                            : { end: Math.max(time, sticker.start + 0.2) },
                        );
                      }}
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">{NOTO_CREDIT}</p>
    </div>
  );
}
