import { useEffect, useRef } from "react";
import { brollAt } from "@/lib/media/broll";
import { primeFirstFrame } from "@/lib/media/first-frame";
import type { Scene, SceneElement } from "@/lib/scenes";

type Props = {
  scenes: Scene[];
  sceneElements: SceneElement[];
  time: number;
  playing: boolean;
};

/** B-roll cutaway: แสดงสื่อของซีนเต็มเฟรมทับวิดีโอต้นฉบับ (ซับยังอยู่ด้านบน) */
export function BrollOverlay({ scenes, sceneElements, time, playing }: Props) {
  const hit = brollAt(time, scenes, sceneElements);
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = hit?.assetUrl ?? null;

  // เข้าซีนใหม่ → เริ่มเล่นจากต้นคลิปเสมอ
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    video.currentTime = 0;
  }, [url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [playing, url]);

  if (!hit || !url) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {hit.assetType === "video" ? (
        <video
          ref={videoRef}
          key={url}
          src={url}
          className="h-full w-full object-cover"
          muted
          loop
          playsInline
          preload="auto"
          onLoadedData={(e) => {
            if (!playing) primeFirstFrame(e.currentTarget);
          }}
        />
      ) : (
        <img src={url} alt="B-roll" className="h-full w-full object-cover" />
      )}
    </div>
  );
}
