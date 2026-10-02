import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createStickerLayer, type Sticker, type StickerLayer } from "@/lib/media/stickers";

type Props = {
  stickers: Sticker[];
  time: number;
  /** frame size in CSS pixels */
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<Sticker>) => void;
  onRemove: (id: string) => void;
  /** allow dragging and resizing (off while playing) */
  interactive: boolean;
};

type Drag =
  | { id: string; kind: "move"; frame: DOMRect }
  | {
      id: string;
      kind: "resize";
      cx: number;
      cy: number;
      startDist: number;
      startSize: number;
      frame: DOMRect;
    }
  | { id: string; kind: "rotate"; cx: number; cy: number; frame: DOMRect };

/** Snaps to the nearest quarter turn when within 4°. */
function snapAngle(deg: number): number {
  const normalized = ((deg + 540) % 360) - 180;
  for (const target of [-180, -90, 0, 90, 180]) {
    if (Math.abs(normalized - target) <= 4) return target === -180 ? 180 : target;
  }
  return Math.round(normalized);
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Paints stickers on a canvas over the video, with drag and resize handles. */
export function StickerOverlay({
  stickers,
  time,
  width,
  height,
  selectedId,
  onSelect,
  onChange,
  onRemove,
  interactive,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<StickerLayer | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);

  useEffect(() => {
    layerRef.current = createStickerLayer(384);
    return () => layerRef.current?.destroy();
  }, []);

  useEffect(() => {
    if (!stickers.length) return;
    let cancelled = false;
    void layerRef.current?.prepare(stickers).then(() => {
      if (!cancelled) setLoaded((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [stickers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = layerRef.current;
    if (!canvas || !layer || !width || !height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!interactive) {
      layer.draw(ctx, stickers, time, w, h);
      return;
    }
    // Paused: show each sticker fully animated in, even right at its start
    // time, so a sticker just added is visible while it is being placed.
    for (const sticker of stickers) {
      if (time < sticker.start || time > sticker.end) continue;
      const settled = Math.min(sticker.start + 0.8, (sticker.start + sticker.end) / 2);
      layer.draw(ctx, [sticker], Math.max(time, settled), w, h);
    }
  }, [stickers, time, width, height, loaded, interactive]);

  const visible = stickers.filter((s) => time >= s.start && time <= s.end);

  const begin = (event: ReactPointerEvent<HTMLElement>, sticker: Sticker, kind: Drag["kind"]) => {
    event.preventDefault();
    event.stopPropagation();
    const frame = canvasRef.current?.getBoundingClientRect();
    if (!frame) return;
    onSelect(sticker.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (kind === "move") setDrag({ id: sticker.id, kind, frame });
    else if (kind === "rotate") {
      setDrag({
        id: sticker.id,
        kind,
        cx: frame.left + (sticker.x / 100) * frame.width,
        cy: frame.top + (sticker.y / 100) * frame.height,
        frame,
      });
    } else {
      const cx = frame.left + (sticker.x / 100) * frame.width;
      const cy = frame.top + (sticker.y / 100) * frame.height;
      setDrag({
        id: sticker.id,
        kind,
        cx,
        cy,
        startDist: Math.max(8, Math.hypot(event.clientX - cx, event.clientY - cy)),
        startSize: sticker.size,
        frame,
      });
    }
  };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    event.stopPropagation();
    if (drag.kind === "move") {
      onChange(drag.id, {
        x: clamp(((event.clientX - drag.frame.left) / drag.frame.width) * 100, 0, 100),
        y: clamp(((event.clientY - drag.frame.top) / drag.frame.height) * 100, 0, 100),
      });
    } else if (drag.kind === "rotate") {
      // the handle sits above the sticker, so straight up is 0°
      const angle = (Math.atan2(event.clientY - drag.cy, event.clientX - drag.cx) * 180) / Math.PI;
      onChange(drag.id, { rotation: snapAngle(angle + 90) });
    } else {
      const dist = Math.hypot(event.clientX - drag.cx, event.clientY - drag.cy);
      onChange(drag.id, {
        size: Math.round(clamp((drag.startSize * dist) / drag.startDist, 4, 80)),
      });
    }
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    setDrag(null);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      />
      {interactive &&
        visible.map((sticker) => {
          // at least a fingertip wide, so small stickers stay easy to grab on phones
          const box = Math.max(44, (sticker.size / 100) * height);
          const selected = sticker.id === selectedId;
          return (
            <div
              key={sticker.id}
              role="button"
              tabIndex={0}
              aria-label="สติกเกอร์ — ลากเพื่อย้าย"
              onPointerDown={(event) => begin(event, sticker, "move")}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={(event) => {
                if (event.key === "Delete" || event.key === "Backspace") onRemove(sticker.id);
              }}
              className={cn(
                "absolute z-40 cursor-move touch-none rounded-md",
                selected
                  ? "outline-dashed outline-2 outline-white/90"
                  : "hover:outline-dashed hover:outline-1 hover:outline-white/60",
              )}
              style={{
                left: `${sticker.x}%`,
                top: `${sticker.y}%`,
                width: box,
                height: box,
                transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
              }}
            >
              {selected && (
                <>
                  <button
                    type="button"
                    aria-label="ลบสติกเกอร์"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(sticker.id);
                    }}
                    className="absolute -right-3.5 -top-3.5 grid h-7 w-7 before:absolute before:-inset-3 before:content-[''] place-items-center rounded-full bg-white text-black shadow-md"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span
                    role="button"
                    aria-label="ลากเพื่อย่อหรือขยายสติกเกอร์"
                    onPointerDown={(event) => begin(event, sticker, "resize")}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerCancel={end}
                    className="absolute -bottom-3.5 -right-3.5 h-7 w-7 before:absolute before:-inset-3 before:content-[''] cursor-nwse-resize touch-none rounded-full border-2 border-primary bg-white shadow-md"
                  />
                  <span
                    role="button"
                    aria-label="ลากเพื่อหมุนสติกเกอร์"
                    title="ลากเพื่อหมุน (ดับเบิลคลิกเพื่อตั้งตรง)"
                    onPointerDown={(event) => begin(event, sticker, "rotate")}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerCancel={end}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      onChange(sticker.id, { rotation: 0 });
                    }}
                    className="absolute -top-10 left-1/2 grid h-8 w-8 -translate-x-1/2 cursor-grab touch-none place-items-center rounded-full bg-white text-black shadow-md before:absolute before:-inset-3 before:content-['']"
                  >
                    <RotateCw className="h-4 w-4" />
                  </span>
                </>
              )}
            </div>
          );
        })}
    </>
  );
}
