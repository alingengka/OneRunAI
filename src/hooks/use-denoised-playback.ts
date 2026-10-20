import { useEffect, useRef, type RefObject } from "react";
import { soundContext } from "@/lib/sounds";

/** How far the cleaned audio may drift from the picture before it is re-synced. */
const MAX_DRIFT = 0.08;
/** Re-syncs no more often than this, so a jittery clock cannot cause a restart loop. */
const MIN_RESYNC_GAP = 2;

/**
 * Plays the denoised copy of the clip's audio in place of the video's own
 * sound (the caller mutes the video while `buffer` is set). Like the sound
 * effects, it is (re)started from the video's current time whenever the video
 * plays, seeks or changes speed, and stops on pause; racing through a cut at
 * high speed stays silent, as the muted video does.
 */
export function useDenoisedPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  buffer: AudioBuffer | null,
  muted: boolean,
  /** told whether Web Audio is actually running, so a refusal never leaves silence */
  onBlocked: (blocked: boolean) => void,
) {
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;
  const masterRef = useRef<GainNode | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !buffer) return;
    let live: {
      nodes: AudioBufferSourceNode[];
      at: number;
      from: number;
      rate: number;
      /**
       * How far the audio clock reads from the video clock just after starting.
       * Phones report the two with a steady offset (output latency), so only a
       * change from this is real drift.
       */
      offset: number | null;
    } | null = null;
    let lastResync = 0;
    let master: GainNode | null = null;
    let generation = 0;

    const stop = () => {
      generation++;
      if (!live) return;
      for (const node of live.nodes) {
        try {
          node.stop();
        } catch {
          /* already ended */
        }
      }
      live = null;
    };

    /** Where the playing audio is now, in clip seconds. */
    const heardAt = (ctx: AudioContext) =>
      live ? live.from + (ctx.currentTime - live.at) * live.rate : NaN;

    const start = async () => {
      // "seeked" and "playing" often both fire: keep audio that is already in step
      const ctx0 = soundContext();
      if (
        live &&
        ctx0 &&
        !video.paused &&
        live.rate === (video.playbackRate || 1) &&
        Math.abs(heardAt(ctx0) - video.currentTime - (live.offset ?? 0)) < 0.03
      )
        return;
      stop();
      const mine = generation;
      if (video.paused || video.ended || video.playbackRate > 2) return;
      const ctx = soundContext();
      if (!ctx) return;
      if (ctx.state !== "running") {
        // a refused resume can hang instead of failing: give it a moment
        await Promise.race([
          ctx.resume().catch(() => undefined),
          new Promise((resolve) => setTimeout(resolve, 600)),
        ]);
      }
      if (mine !== generation || video.paused) return;
      const running = ctx.state === "running";
      onBlockedRef.current(!running);
      if (!running) return;
      if (!master) {
        master = ctx.createGain();
        master.connect(ctx.destination);
        masterRef.current = master;
      }
      master.gain.value = mutedRef.current ? 0 : 1;
      const from = video.currentTime;
      if (from >= buffer.duration) return;
      const rate = video.playbackRate || 1;
      const at = ctx.currentTime;
      const play = (source: AudioBuffer, into: AudioNode) => {
        const node = ctx.createBufferSource();
        node.buffer = source;
        node.playbackRate.value = rate;
        node.connect(into);
        node.start(at, from);
        return node;
      };
      live = { nodes: [play(buffer, master)], at, from, rate, offset: null };
    };

    // The audio clock and the video clock run apart slowly: re-sync when they do.
    const check = () => {
      const ctx = soundContext();
      if (!live || !ctx || video.paused) return;
      const gap = heardAt(ctx) - video.currentTime;
      if (live.offset == null) {
        live.offset = gap;
        return;
      }
      const now = performance.now() / 1000;
      if (Math.abs(gap - live.offset) > MAX_DRIFT && now - lastResync > MIN_RESYNC_GAP) {
        lastResync = now;
        stop();
        void start();
      }
    };

    const restart = () => void start();
    video.addEventListener("playing", restart);
    video.addEventListener("seeked", restart);
    video.addEventListener("ratechange", restart);
    video.addEventListener("timeupdate", check);
    video.addEventListener("pause", stop);
    video.addEventListener("seeking", stop);
    video.addEventListener("waiting", stop);
    video.addEventListener("ended", stop);
    void start(); // turned on while already playing
    return () => {
      stop();
      video.removeEventListener("playing", restart);
      video.removeEventListener("seeked", restart);
      video.removeEventListener("ratechange", restart);
      video.removeEventListener("timeupdate", check);
      video.removeEventListener("pause", stop);
      video.removeEventListener("seeking", stop);
      video.removeEventListener("waiting", stop);
      video.removeEventListener("ended", stop);
      master?.disconnect();
      masterRef.current = null;
    };
  }, [videoRef, buffer]);

  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = muted ? 0 : 1;
  }, [muted]);
}
