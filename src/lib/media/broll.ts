/**
 * B-roll (cutaway): แสดงสื่อของซีนแทนภาพต้นฉบับทั้งเฟรม
 * ใช้ร่วมกันระหว่างพรีวิวและการเบิร์นลงไฟล์ส่งออก
 */
import { openFrameReader, type FrameReader } from "./frame-reader";
import type { MotionElement, MotionScene } from "./motion";

export type BrollWindow = {
  start: number;
  end: number;
  assetUrl: string;
  assetType: "image" | "video";
};

/** ทำ URL ให้เป็น origin เดียวกับแอป (กัน canvas ถูก taint ตอน export) */
export function proxiedMediaUrl(url: string): string {
  if (typeof window === "undefined") return url;
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.origin === window.location.origin) return parsed.toString();
    return `/api/public/broll-media?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return url;
  }
}

export function brollWindows(
  scenes: MotionScene[] | undefined,
  elements: MotionElement[] | undefined,
): BrollWindow[] {
  if (!scenes?.length || !elements?.length) return [];
  const list: BrollWindow[] = [];
  for (const scene of scenes) {
    const element = elements.find(
      (e) => e.sceneId === scene.id && e.kind === "broll" && e.enabled && e.assetUrl,
    );
    if (!element?.assetUrl) continue;
    list.push({
      start: scene.start,
      end: scene.end,
      assetUrl: element.assetUrl,
      assetType: element.assetType === "video" ? "video" : "image",
    });
  }
  return list.sort((a, b) => a.start - b.start);
}

export function brollAt(
  time: number,
  scenes: MotionScene[] | undefined,
  elements: MotionElement[] | undefined,
): (BrollWindow & { sceneStart: number }) | null {
  for (const win of brollWindows(scenes, elements)) {
    if (time >= win.start - 0.001 && time <= win.end + 0.001) return { ...win, sceneStart: win.start };
  }
  return null;
}

export type BrollTrack = {
  /** เตรียมสื่อ ณ เวลานั้น (สำหรับวิดีโอต้อง seek ก่อนวาด) */
  prepare: (time: number) => Promise<void>;
  /** โหมดเรียลไทม์: ให้วิดีโอ B-roll เล่นไปพร้อมกับการอัด */
  syncRealtime: (time: number) => void;
  sourceAt: (time: number) => CanvasImageSource | null;
  dispose: () => void;
};

const EMPTY_TRACK: BrollTrack = {
  prepare: async () => undefined,
  syncRealtime: () => undefined,
  sourceAt: () => null,
  dispose: () => undefined,
};

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.02) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      video.removeEventListener("seeked", done);
      resolve();
    };
    const timer = window.setTimeout(done, 3000);
    video.addEventListener("seeked", done, { once: true });
    try {
      video.currentTime = time;
    } catch {
      done();
    }
  });
}

/** โหลดสื่อทั้งหมดล่วงหน้าให้พร้อมวาดลง canvas */
export async function createBrollTrack(
  windows: BrollWindow[],
  /**
   * Export only: every source time `prepare` will be called with, in order, and
   * the frame size. B-roll videos are then decoded in order instead of seeked.
   */
  sequential?: { plannedTimes: number[]; size: { width: number; height: number } },
): Promise<BrollTrack> {
  if (!windows.length) return EMPTY_TRACK;
  type Loaded = BrollWindow & {
    source: CanvasImageSource | null;
    video?: HTMLVideoElement;
    url?: string;
    reader?: FrameReader | null;
    frame?: CanvasImageSource | null;
  };
  const loaded: Loaded[] = [];

  for (const win of windows) {
    const url = proxiedMediaUrl(win.assetUrl);
    if (win.assetType === "video") {
      const video = document.createElement("video");
      video.src = url;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "auto";
      video.style.position = "fixed";
      video.style.left = "-10000px";
      video.style.width = "160px";
      document.body.appendChild(video);
      const ok = await new Promise<boolean>((resolve) => {
        const timer = window.setTimeout(() => resolve(video.readyState >= 2), 15000);
        video.addEventListener(
          "loadeddata",
          () => {
            window.clearTimeout(timer);
            resolve(true);
          },
          { once: true },
        );
        video.addEventListener(
          "error",
          () => {
            window.clearTimeout(timer);
            resolve(false);
          },
          { once: true },
        );
      });
      loaded.push(ok ? { ...win, source: video, video, url } : { ...win, source: null });
      if (!ok) video.remove();
      continue;
    }
    const bitmap = await fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("load failed"))))
      .then((blob) => createImageBitmap(blob))
      .catch(() => null);
    loaded.push({ ...win, source: bitmap });
  }

  const hit = (time: number) =>
    loaded.find((w) => time >= w.start - 0.001 && time <= w.end + 0.001) ?? null;
  /** Where in the (looping) B-roll video a source time lands. */
  const clipTime = (item: Loaded, video: HTMLVideoElement, time: number) => {
    const length = video.duration || 0;
    const at = length > 0.05 ? (time - item.start) % length : 0;
    return Math.max(0, Math.min(length - 0.03, at));
  };

  if (sequential) {
    const planned = new Map<Loaded, number[]>();
    for (const time of sequential.plannedTimes) {
      const item = hit(time);
      if (!item?.video) continue;
      const list = planned.get(item) ?? [];
      list.push(clipTime(item, item.video, time));
      planned.set(item, list);
    }
    for (const [item, times] of planned) {
      const blob = await fetch(item.url!)
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null);
      item.reader = blob
        ? await openFrameReader(blob, times, { ...sequential.size, fit: "cover" })
        : null;
    }
  }

  return {
    prepare: async (time) => {
      const current = hit(time);
      if (!current?.video) return;
      if (current.reader) {
        try {
          current.frame = await current.reader.next();
          if (current.frame) return;
        } catch {
          current.reader.dispose();
          current.reader = null;
        }
      }
      current.frame = null;
      await seekVideo(current.video, clipTime(current, current.video, time));
    },
    syncRealtime: (time) => {
      for (const item of loaded) {
        if (!item.video) continue;
        const inside = time >= item.start - 0.001 && time <= item.end + 0.001;
        if (inside) {
          if (item.video.paused) void item.video.play().catch(() => undefined);
        } else if (!item.video.paused) {
          item.video.pause();
          item.video.currentTime = 0;
        }
      }
    },
    sourceAt: (time) => {
      const item = hit(time);
      return item?.frame ?? item?.source ?? null;
    },
    dispose: () => {
      for (const item of loaded) {
        item.reader?.dispose();
        if (item.video) {
          item.video.removeAttribute("src");
          item.video.remove();
        } else if (item.source && "close" in item.source) {
          (item.source as ImageBitmap).close();
        }
      }
    },
  };
}

/** ขนาด/ตำแหน่งวาดแบบ object-fit: cover */
export function coverRect(
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  if (!sourceWidth || !sourceHeight) return { x: 0, y: 0, w: width, h: height };
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const w = sourceWidth * scale;
  const h = sourceHeight * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

export function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  const anySource = source as { videoWidth?: number; videoHeight?: number; width?: number; height?: number };
  return {
    width: anySource.videoWidth || Number(anySource.width) || 0,
    height: anySource.videoHeight || Number(anySource.height) || 0,
  };
}
