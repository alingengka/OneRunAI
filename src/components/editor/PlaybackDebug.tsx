import { useEffect, useState, type RefObject } from "react";

type Stats = {
  fps: number;
  janks: number;
  worst: number;
  dropped: number;
  total: number;
  seeksBack: number;
  waits: number;
  time: number;
  ready: number;
  size: string;
};

/**
 * Temporary on-screen numbers for tracking down preview stutter on real
 * phones. Shown only with ?debug=1 in the URL.
 *  - fps / janks: how smoothly the page draws (janks = frames over 50 ms)
 *  - dropped: frames the video decoder skipped (getVideoPlaybackQuality)
 *  - back: times playback jumped backwards; wait: times the video stalled
 */
export function PlaybackDebug({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let janks = 0;
    let worst = 0;
    let windowStart = last;
    let fps = 0;
    let prevTime = 0;
    let seeksBack = 0;
    let waits = 0;
    let watched: HTMLVideoElement | null = null;
    const onWaiting = () => waits++;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      frames++;
      if (dt > 50) janks++;
      worst = Math.max(worst, dt);
      const v = videoRef.current;
      if (v !== watched) {
        watched?.removeEventListener("waiting", onWaiting);
        v?.addEventListener("waiting", onWaiting);
        watched = v;
      }
      if (v && !v.paused && v.currentTime < prevTime - 0.05) seeksBack++;
      if (v) prevTime = v.currentTime;
      if (now - windowStart >= 1000) {
        fps = Math.round((frames * 1000) / (now - windowStart));
        frames = 0;
        windowStart = now;
        const q = v?.getVideoPlaybackQuality?.();
        setStats({
          fps,
          janks,
          worst: Math.round(worst),
          dropped: q?.droppedVideoFrames ?? -1,
          total: q?.totalVideoFrames ?? -1,
          seeksBack,
          waits,
          time: v?.currentTime ?? 0,
          ready: v?.readyState ?? 0,
          size: v ? `${v.videoWidth}x${v.videoHeight}` : "-",
        });
        worst = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      watched?.removeEventListener("waiting", onWaiting);
    };
  }, [videoRef]);
  if (!stats) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 rounded bg-black/80 px-2 py-1 font-mono text-[11px] leading-snug text-lime-300">
      <div>
        fps {stats.fps} · jank {stats.janks} · worst {stats.worst}ms
      </div>
      <div>
        drop {stats.dropped}/{stats.total} · back {stats.seeksBack} · wait {stats.waits}
      </div>
      <div>
        t {stats.time.toFixed(2)} · rs {stats.ready} · {stats.size}
      </div>
    </div>
  );
}
