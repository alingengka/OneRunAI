/**
 * Seeks a <video> while the user scrubs, one seek at a time. Scrubbing asks
 * for a new time every frame; iPhones run seeks one after another and slowly,
 * so they piled up: pressing play then waited for the backlog (stuck), or
 * played from an old spot (a jump to the end). Here a request made while a
 * seek is running only replaces the next target, so at most one waits.
 */
export type Seeker = {
  seek: (time: number) => void;
  /** Before playing: go straight to the newest target and drop the queue. */
  flush: () => void;
};

export function createSeeker(getVideo: () => HTMLVideoElement | null): Seeker {
  let busy = false;
  let pending: number | null = null;
  let timer = 0;

  const finish = () => {
    window.clearTimeout(timer);
    if (!busy) return;
    busy = false;
    if (pending != null) {
      const next = pending;
      pending = null;
      seek(next);
    }
  };

  const seek = (time: number) => {
    const video = getVideo();
    if (!video) return;
    const target = Math.max(0, time);
    if (busy) {
      pending = target;
      return;
    }
    busy = true;
    video.addEventListener("seeked", finish, { once: true });
    // in case "seeked" never comes (source changed, decode error)
    timer = window.setTimeout(finish, 1500);
    video.currentTime = target;
  };

  const flush = () => {
    const video = getVideo();
    if (video && pending != null) video.currentTime = pending;
    pending = null;
  };

  return { seek, flush };
}
