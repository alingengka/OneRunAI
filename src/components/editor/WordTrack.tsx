import {
  type TouchList as ReactTouchList,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LINE_BREAK, type Word } from "@/lib/captions";
import type { Segment } from "@/lib/media/audio";

type Props = {
  words: Word[];
  duration: number;
  time: number;
  /** Silent ranges that are cut from the output; drawn as striped gaps. */
  cuts: Segment[];
  selected: number | null;
  onSelect: (index: number) => void;
  onSeek: (time: number) => void;
  /** Commit new timing for one word (seconds). */
  onRetime: (index: number, start: number, end: number) => void;
  compact?: boolean;
  className?: string;
};

const MIN_WORD = 0.05;
/** Pixels per second limits; zoom is continuous between them. */
const MIN_PPS = 24;
const MAX_PPS = 480;
const BUTTON_STEP = 1.35;

const clampPps = (value: number) => Math.min(MAX_PPS, Math.max(MIN_PPS, value));

type Drag = { index: number; edge: "start" | "end"; originX: number; start: number; end: number };

/** Horizontal word timeline: every word is a block on a time ruler. */
export function WordTrack({
  words,
  duration,
  time,
  cuts,
  selected,
  onSelect,
  onSeek,
  onRetime,
  compact = false,
  className,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pps, setPps] = useState(compact ? 60 : 110);
  const [drag, setDrag] = useState<Drag | null>(null);
  const width = Math.max(1, duration) * pps;
  const ppsRef = useRef(pps);
  ppsRef.current = pps;
  const pinchRef = useRef<{ distance: number; pps: number } | null>(null);

  /** Zooms around a point of the visible track so the time under it stays put. */
  const zoomAt = (nextPps: number, anchorX?: number) => {
    const el = scrollRef.current;
    const current = ppsRef.current;
    const target = clampPps(nextPps);
    if (!el || target === current) return;
    const x = anchorX ?? el.clientWidth / 2;
    const anchorTime = (el.scrollLeft + x) / current;
    ppsRef.current = target;
    setPps(target);
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, anchorTime * target - x);
    });
  };

  // Trackpad pinch (Mac and Windows send it as ctrl+wheel) and the mouse
  // wheel zoom; sideways swipes and shift+wheel still scroll the track.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const pinch = event.ctrlKey || event.metaKey;
      const vertical = Math.abs(event.deltaY) > Math.abs(event.deltaX) && !event.shiftKey;
      if (!pinch && !vertical) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const delta = event.deltaY * unit;
      const factor = Math.exp(-delta * (pinch ? 0.01 : 0.0025));
      zoomAt(ppsRef.current * factor, event.clientX - el.getBoundingClientRect().left);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // zoomAt only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Two-finger pinch on touch screens.
  const touchDistance = (touches: ReactTouchList) => {
    const a = touches[0];
    const b = touches[1];
    return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
  };
  const onTouchStart = (event: ReactTouchEvent) => {
    if (event.touches.length === 2) {
      pinchRef.current = { distance: touchDistance(event.touches), pps: ppsRef.current };
    }
  };
  const onTouchMove = (event: ReactTouchEvent) => {
    const pinch = pinchRef.current;
    const el = scrollRef.current;
    if (!pinch || event.touches.length !== 2 || !el || !pinch.distance) return;
    const a = event.touches[0]!;
    const b = event.touches[1]!;
    const midX = (a.clientX + b.clientX) / 2 - el.getBoundingClientRect().left;
    zoomAt((pinch.pps * touchDistance(event.touches)) / pinch.distance, midX);
  };
  const onTouchEnd = (event: ReactTouchEvent) => {
    if (event.touches.length < 2) pinchRef.current = null;
  };

  const tickStep = pps >= 110 ? 1 : pps >= 60 ? 2 : 5;
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= duration + 0.001; t += tickStep) out.push(t);
    return out;
  }, [duration, tickStep]);

  // Keep the playhead in view while the video plays or is scrubbed.
  // Zooming alone does not re-center, so the zoom anchor stays where it is.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || drag) return;
    const x = time * ppsRef.current;
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 64) {
      el.scrollLeft = Math.max(0, x - el.clientWidth * 0.35);
    }
  }, [time, drag]);

  // Bring a newly selected word into view (e.g. picked from the caption list).
  useEffect(() => {
    const el = scrollRef.current;
    const word = selected != null ? words[selected] : undefined;
    if (!el || !word) return;
    const left = word.start * ppsRef.current;
    const right = word.end * ppsRef.current;
    if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = Math.max(0, left - el.clientWidth * 0.35);
    }
    // Only when the selection changes, not on every edit of the words.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const bounds = (index: number) => {
    let prevEnd = 0;
    for (let i = index - 1; i >= 0; i--) {
      if (words[i]?.text !== LINE_BREAK) {
        prevEnd = words[i]!.end;
        break;
      }
    }
    let nextStart = duration;
    for (let i = index + 1; i < words.length; i++) {
      if (words[i]?.text !== LINE_BREAK) {
        nextStart = words[i]!.start;
        break;
      }
    }
    return { prevEnd, nextStart };
  };

  const beginDrag = (event: ReactPointerEvent, index: number, edge: "start" | "end") => {
    const word = words[index];
    if (!word) return;
    event.stopPropagation();
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    setDrag({ index, edge, originX: event.clientX, start: word.start, end: word.end });
  };

  const moveDrag = (event: ReactPointerEvent) => {
    if (!drag) return;
    const word = words[drag.index];
    if (!word) return;
    const delta = (event.clientX - drag.originX) / pps;
    const { prevEnd, nextStart } = bounds(drag.index);
    if (drag.edge === "start") {
      const start = Math.min(Math.max(prevEnd, word.start + delta), word.end - MIN_WORD);
      setDrag({ ...drag, start });
    } else {
      const end = Math.max(Math.min(nextStart, word.end + delta), word.start + MIN_WORD);
      setDrag({ ...drag, end });
    }
  };

  const endDrag = () => {
    if (!drag) return;
    const word = words[drag.index];
    if (
      word &&
      (Math.abs(drag.start - word.start) > 0.005 || Math.abs(drag.end - word.end) > 0.005)
    ) {
      onRetime(drag.index, drag.start, drag.end);
    }
    setDrag(null);
  };

  const seekFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const t = (event.clientX - rect.left) / pps;
    onSeek(Math.max(0, Math.min(duration, t)));
  };

  const blockHeight = compact ? 36 : 40;

  return (
    <div data-word-track="" className={cn("flex min-w-0 flex-col", className)}>
      {!compact && (
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3">
          <span className="text-sm font-semibold">ไทม์ไลน์คำ</span>
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            คลิกคำเพื่อเลือก · ลากขอบคำเพื่อปรับเวลา · เลื่อนลูกกลิ้ง/บีบนิ้วบนแทร็กแพดเพื่อซูม ·
            ลายทาง = ช่วงเงียบที่ถูกตัด
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="ซูมออก"
              disabled={pps <= MIN_PPS}
              onClick={() => zoomAt(pps / BUTTON_STEP)}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="ซูมเข้า"
              disabled={pps >= MAX_PPS}
              onClick={() => zoomAt(pps * BUTTON_STEP)}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        className="relative min-w-0 touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="relative px-0" style={{ width, height: compact ? 64 : 92 }}>
          {!compact && (
            <div className="absolute inset-x-0 top-0 h-6" onPointerDown={seekFromEvent}>
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute top-1.5 flex items-start"
                  style={{ left: t * pps }}
                >
                  <div className="h-2 w-px bg-border" />
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                    {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div
            className="absolute inset-x-0"
            style={{ top: compact ? 12 : 30, height: blockHeight }}
            onPointerDown={seekFromEvent}
          >
            {cuts.map((cut, i) => (
              <div
                key={`cut-${i}`}
                aria-hidden="true"
                className="absolute top-0 h-full rounded-md border border-dashed border-border"
                style={{
                  left: cut.start * pps,
                  width: Math.max(2, (cut.end - cut.start) * pps),
                  background:
                    "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklab, var(--muted-foreground) 18%, transparent) 6px 12px)",
                }}
              />
            ))}
            {words.map((word, index) => {
              if (word.text === LINE_BREAK) return null;
              const isSelected = selected === index;
              const start = drag?.index === index ? drag.start : word.start;
              const end = drag?.index === index ? drag.end : word.end;
              const w = Math.max(6, (end - start) * pps - 2);
              return (
                <div
                  key={`${index}-${word.start}`}
                  className="absolute top-0 h-full"
                  style={{ left: start * pps, width: w }}
                >
                  <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => {
                      onSelect(index);
                      onSeek(word.start);
                    }}
                    title={
                      typeof word.confidence === "number"
                        ? `${word.text} · ความมั่นใจ ${Math.round(word.confidence * 100)}%`
                        : word.text
                    }
                    className={cn(
                      "h-full w-full overflow-hidden whitespace-nowrap rounded-md border px-1.5 text-left text-xs transition-colors",
                      isSelected
                        ? "border-2 border-amber-400 bg-amber-400/15 text-amber-800 dark:text-amber-100"
                        : "border-border bg-secondary text-foreground hover:border-primary/60",
                      !isSelected &&
                        word.confidenceLabel === "low" &&
                        "border-amber-500/70 text-amber-700 dark:text-amber-200",
                    )}
                  >
                    {word.text}
                  </button>
                  {isSelected && (
                    <>
                      <span
                        aria-hidden="true"
                        title="ลากเพื่อปรับเวลาเริ่มของคำ"
                        onPointerDown={(event) => beginDrag(event, index, "start")}
                        className="absolute -left-1.5 top-0 h-full w-3 cursor-ew-resize touch-none"
                      >
                        <span className="absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-amber-400" />
                      </span>
                      <span
                        aria-hidden="true"
                        title="ลากเพื่อปรับเวลาจบของคำ"
                        onPointerDown={(event) => beginDrag(event, index, "end")}
                        className="absolute -right-1.5 top-0 h-full w-3 cursor-ew-resize touch-none"
                      >
                        <span className="absolute right-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-amber-400" />
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-foreground"
            style={{ left: time * pps }}
          />
        </div>
      </div>
      {!words.length && (
        <p className="px-3 pb-3 text-xs text-muted-foreground">
          ยังไม่มีซับ — กด “สร้างซับด้วย AI” ในเมนูเครื่องมือ AI แล้วคำจะขึ้นที่นี่
        </p>
      )}
    </div>
  );
}
