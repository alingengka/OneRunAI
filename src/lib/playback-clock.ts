import { useSyncExternalStore, type ReactNode } from "react";

/**
 * The preview's playback time, outside React state. The editor re-rendered
 * its whole tree ~30 times a second while a clip played, which stuttered on
 * phones; now only the parts that move (captions, stickers, time labels)
 * subscribe to every tick.
 */
export type PlaybackClock = {
  get: () => number;
  set: (time: number) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createPlaybackClock(): PlaybackClock {
  let time = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => time,
    set: (next) => {
      if (next === time) return;
      time = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useClockTime(clock: PlaybackClock): number {
  return useSyncExternalStore(clock.subscribe, clock.get, clock.get);
}

/** Renders `children(time)` on every clock tick without re-rendering the parent. */
export function Clocked({
  clock,
  children,
}: {
  clock: PlaybackClock;
  children: (time: number) => ReactNode;
}) {
  return children(useClockTime(clock));
}

/** Index of the first boundary strictly after `time` (boundaries sorted). */
export function nextBoundaryAfter(boundaries: number[], time: number): number {
  let lo = 0;
  let hi = boundaries.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (boundaries[mid]! <= time) lo = mid + 1;
    else hi = mid;
  }
  return lo < boundaries.length ? boundaries[lo]! : Infinity;
}
