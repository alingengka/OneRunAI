import {
  type TouchList as ReactTouchList,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useLayoutEffect,
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

/** Extra rows drawn around the caption row (CapCut-style multi-track). */
export type TimelineLanes = {
  /** Video frame thumbnails, one every `thumbStep` seconds. */
  thumbs?: string[];
  thumbStep?: number;
  /** Audio loudness 0–1, one value every `peakStep` seconds. */
  peaks?: number[];
  peakStep?: number;
  stickers?: { id: string; label: string; start: number; end: number }[];
};

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
  /**
   * Commit a word dragged to a new place. It may pass other words; the
   * caller reorders and trims neighbors. Falls back to onRetime.
   */
  onMove?: (index: number, start: number, end: number) => void;
  compact?: boolean;
  /**
   * Phone mode: the playhead stays in the middle and dragging the timeline
   * scrubs the video, like CapCut.
   */
  centered?: boolean;
  /**
   * The playing video's time, or null when paused. Read every frame so the
   * playhead and track glide; `time` only updates now and then while playing.
   */
  clock?: () => number | null;
  /** Called when the user starts scrubbing, so playback can pause. */
  onScrubStart?: () => void;
  /** Tap on an empty part of the timeline. */
  onDeselect?: () => void;
  lanes?: TimelineLanes;
  selectedSticker?: string | null;
  onSelectSticker?: (id: string) => void;
  className?: string;
};

const MIN_WORD = 0.05;
/** Pixels per second limits; zoom is continuous between them. */
const MIN_PPS = 24;
const MAX_PPS = 480;
const BUTTON_STEP = 1.35;
/** Movement (px) before a press on the selected word counts as a move. */
const MOVE_SLOP = 4;

const clampPps = (value: number) => Math.min(MAX_PPS, Math.max(MIN_PPS, value));

type Drag = {
  index: number;
  edge: "start" | "end" | "move";
  originX: number;
  start: number;
  end: number;
  moved: boolean;
};

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
  onMove,
  compact = false,
  centered = false,
  clock,
  onScrubStart,
  onDeselect,
  lanes,
  selectedSticker = null,
  onSelectSticker,
  className,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pps, setPps] = useState(centered ? 90 : compact ? 60 : 110);
  const [drag, setDrag] = useState<Drag | null>(null);
  // In centered mode the track is padded by half the visible width on both
  // sides, so time 0 and the end can both reach the middle playhead.
  const [half, setHalf] = useState(0);
  const origin = centered ? half : 0;
  const width = Math.max(1, duration) * pps;
  const ppsRef = useRef(pps);
  ppsRef.current = pps;
  const pinchRef = useRef<{ distance: number; pps: number } | null>(null);
  /** scrollLeft we set ourselves; scroll events matching it are not the user's. */
  const expectedScrollRef = useRef(-1);
  const userScrollAtRef = useRef(0);
  /**
   * Scroll events only scrub the video while the user is touching or
   * dragging the track, or during the momentum glide after release. iOS
   * Safari reports programmatic scrolls back with slightly different
   * positions, and treating those as scrubbing kept seeking the playing
   * video back to where it was, so playback looked frozen.
   */
  const touchingRef = useRef(false);
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const gestureUntilRef = useRef(0);
  const seekFrameRef = useRef(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !centered) return;
    const measure = () => setHalf(Math.round(el.clientWidth / 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [centered]);

  const setScroll = (value: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, value);
    expectedScrollRef.current = el.scrollLeft;
  };

  /** Zooms around a point of the visible track so the time under it stays put. */
  const zoomAt = (nextPps: number, anchorX?: number) => {
    const el = scrollRef.current;
    const current = ppsRef.current;
    const target = clampPps(nextPps);
    if (!el || target === current) return;
    // Centered: the time under the middle playhead stays there.
    const x = centered ? 0 : (anchorX ?? el.clientWidth / 2);
    const anchorTime = (el.scrollLeft + x) / current;
    ppsRef.current = target;
    setPps(target);
    requestAnimationFrame(() => setScroll(anchorTime * target - x));
  };

  // Trackpad pinch (Mac and Windows send it as ctrl+wheel) and the mouse
  // wheel zoom; sideways swipes and shift+wheel still scroll the track.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const pinch = event.ctrlKey || event.metaKey;
      const vertical = Math.abs(event.deltaY) > Math.abs(event.deltaX) && !event.shiftKey;
      if (!pinch && !vertical) {
        gestureUntilRef.current = performance.now() + 400; // sideways swipe scrubs
        return;
      }
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
    touchingRef.current = true;
    if (event.touches.length === 2) {
      pinchRef.current = { distance: touchDistance(event.touches), pps: ppsRef.current };
    } else if (centered) {
      onScrubStart?.();
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
    if (event.touches.length === 0) {
      touchingRef.current = false;
      gestureUntilRef.current = performance.now() + 1500; // momentum glide
    }
  };

  // Centered: dragging the track (including momentum) scrubs the video.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || !centered || pinchRef.current) return;
    if (!touchingRef.current && performance.now() > gestureUntilRef.current) return;
    if (Math.abs(el.scrollLeft - expectedScrollRef.current) <= 1) return;
    // Touching the track pauses playback first, so a scroll while the video
    // plays is the track following it, never the user scrubbing. On iPhones
    // treating it as a scrub seeked the playing video backwards (stutter).
    if (clockRef.current?.() != null) return;
    userScrollAtRef.current = performance.now();
    cancelAnimationFrame(seekFrameRef.current);
    seekFrameRef.current = requestAnimationFrame(() => {
      const now = scrollRef.current;
      if (!now) return;
      onSeek(Math.max(0, Math.min(duration, now.scrollLeft / ppsRef.current)));
    });
  };
  useEffect(() => () => cancelAnimationFrame(seekFrameRef.current), []);

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
    if (centered) {
      // Follow the video unless the user is dragging the track right now.
      if (touchingRef.current || performance.now() - userScrollAtRef.current < 250) return;
      // While playing, the per-frame follow loop owns the scroll position;
      // `time` lags behind then and would pull the track back.
      if (clockRef.current?.() != null) return;
      if (Math.abs(el.scrollLeft - time * pps) > 0.5) setScroll(time * pps);
      return;
    }
    const x = time * ppsRef.current;
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 64) {
      setScroll(x - el.clientWidth * 0.35);
    }
    // setScroll only touches refs and the element.
  }, [time, drag, centered, pps, half]);

  const playheadRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  useEffect(() => {
    let raf = 0;
    const follow = () => {
      const el = scrollRef.current;
      const t = clockRef.current?.();
      if (el && t != null) {
        const x = t * ppsRef.current;
        if (centered) {
          if (!touchingRef.current && performance.now() - userScrollAtRef.current >= 250) {
            if (Math.abs(el.scrollLeft - x) > 0.5) setScroll(x);
          }
        } else {
          if (playheadRef.current) playheadRef.current.style.left = `${x}px`;
          if (
            !dragRef.current &&
            (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 64)
          ) {
            setScroll(x - el.clientWidth * 0.35);
          }
        }
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [centered]);

  // Bring a newly selected word into view (e.g. picked from the caption list).
  useEffect(() => {
    const el = scrollRef.current;
    const word = selected != null ? words[selected] : undefined;
    if (!el || !word || centered) return;
    const left = word.start * ppsRef.current;
    const right = word.end * ppsRef.current;
    if (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth) {
      setScroll(left - el.clientWidth * 0.35);
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

  const beginDrag = (event: ReactPointerEvent, index: number, edge: Drag["edge"]) => {
    const word = words[index];
    if (!word) return;
    event.stopPropagation();
    // A press on the word body may still be a plain tap; only edges grab at once.
    if (edge !== "move") event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    setDrag({
      index,
      edge,
      originX: event.clientX,
      start: word.start,
      end: word.end,
      moved: edge !== "move",
    });
  };

  const moveDrag = (event: ReactPointerEvent) => {
    if (!drag) return;
    const word = words[drag.index];
    if (!word) return;
    const dx = event.clientX - drag.originX;
    if (!drag.moved && Math.abs(dx) < MOVE_SLOP) return;
    const delta = dx / pps;
    const { prevEnd, nextStart } = bounds(drag.index);
    if (drag.edge === "start") {
      const start = Math.min(Math.max(prevEnd, word.start + delta), word.end - MIN_WORD);
      setDrag({ ...drag, start, moved: true });
    } else if (drag.edge === "end") {
      const end = Math.max(Math.min(nextStart, word.end + delta), word.start + MIN_WORD);
      setDrag({ ...drag, end, moved: true });
    } else {
      // Moving is free: the word can be dropped anywhere in the clip, even
      // past other words (the editor reorders them on drop).
      const length = word.end - word.start;
      const start = Math.min(Math.max(0, word.start + delta), Math.max(0, duration - length));
      setDrag({ ...drag, start, end: start + length, moved: true });
    }
  };

  const endDrag = () => {
    if (!drag) return;
    const word = words[drag.index];
    if (
      word &&
      drag.moved &&
      (Math.abs(drag.start - word.start) > 0.005 || Math.abs(drag.end - word.end) > 0.005)
    ) {
      if (drag.edge === "move" && onMove) onMove(drag.index, drag.start, drag.end);
      else onRetime(drag.index, drag.start, drag.end);
    }
    // Let the click that follows a move see that it was a move, then clear.
    requestAnimationFrame(() => setDrag(null));
  };

  const seekFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (centered) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const t = (event.clientX - rect.left) / pps;
    onSeek(Math.max(0, Math.min(duration, t)));
  };

  const blockHeight = centered ? 40 : compact ? 34 : 40;

  const wordBlocks = useMemo(
    () =>
      words.map((word, index) => {
        if (word.text === LINE_BREAK) return null;
        const isSelected = selected === index;
        const dragging = drag?.index === index;
        const start = dragging ? drag.start : word.start;
        const end = dragging ? drag.end : word.end;
        const w = Math.max(6, (end - start) * pps - 2);
        return (
          <div
            key={`${index}-${word.start}`}
            className="absolute top-0 h-full"
            style={{ left: start * pps, width: w }}
          >
            <button
              type="button"
              onPointerDown={(event) => {
                // Mouse: grab any word straight away. Touch: only the selected
                // word, so a swipe over other words still scrolls the track.
                if (isSelected || event.pointerType === "mouse") {
                  if (!isSelected) onSelect(index);
                  beginDrag(event, index, "move");
                } else event.stopPropagation();
              }}
              onClick={() => {
                if (drag?.moved) return;
                onSelect(index);
                if (!centered) onSeek(word.start);
              }}
              title={
                typeof word.confidence === "number"
                  ? `${word.text} · ความมั่นใจ ${Math.round(word.confidence * 100)}%`
                  : word.text
              }
              className={cn(
                "h-full w-full cursor-grab overflow-hidden whitespace-nowrap rounded-md border px-1.5 text-left text-xs transition-colors active:cursor-grabbing",
                dragging && drag?.moved && "z-20 shadow-lg ring-2 ring-primary",
                isSelected
                  ? "touch-none border-2 border-amber-400 bg-amber-400/15 text-amber-800 dark:text-amber-100"
                  : "border-border bg-secondary text-foreground hover:border-primary/60",
                !isSelected &&
                  word.confidenceLabel === "low" &&
                  "border-amber-500/70 text-amber-700 dark:text-amber-200",
              )}
            >
              {word.text}
            </button>
            {dragging && drag?.moved && (
              <span className="pointer-events-none absolute -top-6 left-0 z-30 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 font-mono text-[10px] text-primary-foreground shadow">
                {start.toFixed(2)}s – {end.toFixed(2)}s
              </span>
            )}
            {isSelected && (
              <>
                <span
                  aria-hidden="true"
                  title="ลากเพื่อปรับเวลาเริ่มของคำ"
                  onPointerDown={(event) => beginDrag(event, index, "start")}
                  className={cn(
                    "absolute top-0 h-full cursor-ew-resize touch-none",
                    centered ? "-left-3 w-5" : "-left-1.5 w-3",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 rounded-full bg-amber-400",
                      centered ? "left-2 h-7 w-1.5" : "left-1 h-5 w-1",
                    )}
                  />
                </span>
                <span
                  aria-hidden="true"
                  title="ลากเพื่อปรับเวลาจบของคำ"
                  onPointerDown={(event) => beginDrag(event, index, "end")}
                  className={cn(
                    "absolute top-0 h-full cursor-ew-resize touch-none",
                    centered ? "-right-3 w-5" : "-right-1.5 w-3",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 rounded-full bg-amber-400",
                      centered ? "right-2 h-7 w-1.5" : "right-1 h-5 w-1",
                    )}
                  />
                </span>
              </>
            )}
          </div>
        );
      }),
    // Word blocks only change with the words, selection, drag or zoom — not with
    // the playhead, which moves every frame while the video plays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [words, selected, drag, pps, blockHeight, centered],
  );

  // ---- extra lanes ----
  const thumbs = lanes?.thumbs ?? [];
  const thumbStep = lanes?.thumbStep ?? 1;
  const peaks = useMemo(() => lanes?.peaks ?? [], [lanes?.peaks]);
  const peakStep = lanes?.peakStep ?? 0.05;
  const stickerItems = lanes?.stickers ?? [];
  const showRuler = !compact || centered;
  const RULER = centered ? 18 : 24;
  const GAP = 6;
  const videoH = thumbs.length ? 40 : 0;
  const stickerH = stickerItems.length ? 26 : 0;
  const audioH = peaks.length ? 24 : 0;
  let cursor = showRuler ? RULER + 4 : compact ? 9 : 30;
  const videoTop = cursor;
  if (videoH) cursor += videoH + GAP;
  const captionTop = cursor;
  cursor += blockHeight + GAP;
  const stickerTop = cursor;
  if (stickerH) cursor += stickerH + GAP;
  const audioTop = cursor;
  if (audioH) cursor += audioH + GAP;
  const contentHeight = Math.max(compact && !centered ? 52 : 92, cursor + 2);

  const peakPath = useMemo(() => {
    if (!peaks.length) return "";
    // Mirrored bars in a 0..duration × 0..1 box; scaled with the SVG.
    let d = "";
    peaks.forEach((v, i) => {
      const h = Math.max(0.04, Math.min(1, v));
      const x = i * peakStep;
      d += `M${x.toFixed(3)} ${(0.5 - h / 2).toFixed(3)}v${h.toFixed(3)}`;
    });
    return d;
  }, [peaks, peakStep]);

  return (
    <div data-word-track="" className={cn("relative flex min-w-0 flex-col", className)}>
      {!compact && !centered && (
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-border px-3">
          <span className="text-sm font-semibold">ไทม์ไลน์คำ</span>
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            ลากคำไปวางตรงไหนก็ได้ · ลากขอบคำเพื่อยืด/หด · เลื่อนลูกกลิ้ง/บีบนิ้วบนแทร็กแพดเพื่อซูม ·
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
        className={cn(
          "relative min-w-0 touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain",
          centered && "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
        onScroll={onScroll}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onPointerDown={(event) => {
          if (centered && event.pointerType === "mouse") {
            gestureUntilRef.current = Number.POSITIVE_INFINITY;
            onScrubStart?.();
          }
        }}
        onPointerUpCapture={(event) => {
          if (event.pointerType === "mouse") gestureUntilRef.current = performance.now() + 300;
        }}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="relative"
          style={{ width: width + origin * 2, height: contentHeight }}
          onClick={(event) => {
            // Tapping empty space (not a word, sticker or handle) clears the selection.
            if (centered && event.target === event.currentTarget) onDeselect?.();
          }}
        >
          {showRuler && (
            <div
              className="absolute top-0"
              style={{ left: origin, width, height: RULER }}
              onPointerDown={seekFromEvent}
            >
              {ticks.map((t) => (
                <div key={t} className="absolute top-1 flex items-start" style={{ left: t * pps }}>
                  <div className="h-2 w-px bg-border" />
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                    {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
          )}

          {videoH > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute overflow-hidden rounded-md border-2 border-white/80 bg-black/40"
              style={{ left: origin, width, top: videoTop, height: videoH }}
            >
              {thumbs.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  draggable={false}
                  className="absolute top-0 h-full object-cover"
                  style={{ left: i * thumbStep * pps, width: Math.ceil(thumbStep * pps) + 1 }}
                />
              ))}
            </div>
          )}

          <div
            className="absolute"
            style={{ left: origin, width, top: captionTop, height: blockHeight }}
            onPointerDown={seekFromEvent}
            onClick={(event) => {
              if (centered && event.target === event.currentTarget) onDeselect?.();
            }}
          >
            {cuts.map((cut, i) => (
              <div
                key={`cut-${i}`}
                aria-hidden="true"
                className="pointer-events-none absolute top-0 h-full rounded-md border border-dashed border-border"
                style={{
                  left: cut.start * pps,
                  width: Math.max(2, (cut.end - cut.start) * pps),
                  background:
                    "repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklab, var(--muted-foreground) 18%, transparent) 6px 12px)",
                }}
              />
            ))}
            {wordBlocks}
          </div>

          {stickerH > 0 && (
            <div
              className="absolute"
              style={{ left: origin, width, top: stickerTop, height: stickerH }}
            >
              {stickerItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onSelectSticker?.(item.id)}
                  className={cn(
                    "absolute top-0 h-full overflow-hidden whitespace-nowrap rounded-md border px-1.5 text-left text-[11px]",
                    selectedSticker === item.id
                      ? "border-2 border-amber-400 bg-amber-500/25"
                      : "border-amber-700/60 bg-amber-900/40 text-amber-100",
                  )}
                  style={{
                    left: item.start * pps,
                    width: Math.max(18, (item.end - item.start) * pps - 2),
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {audioH > 0 && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute rounded-md bg-teal-950/60 text-teal-400"
              style={{ left: origin, width, top: audioTop, height: audioH }}
              viewBox={`0 0 ${Math.max(0.001, duration)} 1`}
              preserveAspectRatio="none"
            >
              <path
                d={peakPath}
                stroke="currentColor"
                strokeWidth={Math.max(0.004, peakStep * 0.55)}
                fill="none"
              />
            </svg>
          )}

          {!centered && (
            <div
              ref={playheadRef}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-foreground"
              style={{ left: time * pps }}
            />
          )}
        </div>
      </div>

      {centered && (
        /* Fixed playhead in the middle; the track moves under it. */
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 -translate-x-1/2 bg-foreground"
          style={{ left: "50%" }}
        >
          <span className="absolute -left-[5px] top-0 h-3 w-3 rounded-full bg-foreground" />
        </div>
      )}

      {!words.length && !compact && !centered && (
        <p className="px-3 pb-3 text-xs text-muted-foreground">
          ยังไม่มีซับ — กด “สร้างซับด้วย AI” ในเมนูเครื่องมือ AI แล้วคำจะขึ้นที่นี่
        </p>
      )}
    </div>
  );
}
