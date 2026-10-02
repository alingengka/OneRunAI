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
  const done = () => {
    video.pause();
    video.currentTime = at;
    video.muted = wasMuted;
  };
  const attempt = video.play();
  if (attempt && typeof attempt.then === "function") {
    attempt.then(done, () => {
      video.muted = wasMuted;
    });
  } else {
    done();
  }
}
