/**
 * iOS Safari keeps a paused <video> blank until it has played once. A muted
 * play-then-pause (allowed without a tap) makes it paint the first frame.
 * The element's muted state is restored afterwards.
 */
export function primeFirstFrame(video: HTMLVideoElement): void {
  // once per source: the same element is reused when a new clip is picked
  const src = video.currentSrc || video.src;
  if (!video.paused || video.dataset["primed"] === src) return;
  video.dataset["primed"] = src;
  const wasMuted = video.muted;
  const at = video.currentTime;
  video.muted = true;
  video.dataset["priming"] = "1";
  const done = () => {
    delete video.dataset["priming"];
    // The person pressed play while the muted warm-up was still starting
    // (slow on iPhones): keep playing from where they are.
    if (video.dataset["userPlay"] === src) {
      video.muted = wasMuted;
      return;
    }
    video.pause();
    video.currentTime = at;
    video.muted = wasMuted;
  };
  const attempt = video.play();
  if (attempt && typeof attempt.then === "function") {
    attempt.then(done, () => {
      delete video.dataset["priming"];
      video.muted = wasMuted;
    });
  } else {
    done();
  }
}

/** Call before a play the person asked for, so a pending warm-up cannot undo it. */
export function markUserPlay(video: HTMLVideoElement): void {
  video.dataset["userPlay"] = video.currentSrc || video.src;
}

/** True while the muted warm-up play is running (not a real playback). */
export function isPriming(video: HTMLVideoElement): boolean {
  return video.dataset["priming"] === "1";
}
