import { useEffect, useRef, type RefObject } from "react";
import { loadSound, soundContext, type SoundClip } from "@/lib/sounds";

/**
 * Plays the timeline's sound effects with the video: whenever the video
 * starts, seeks or changes speed, every clip is (re)scheduled on the Web
 * Audio clock from the video's current time; pausing stops them all.
 */
export function useSoundPlayback(
  videoRef: RefObject<HTMLVideoElement | null>,
  sounds: SoundClip[],
  muted: boolean,
  videoKey: unknown,
) {
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;
  // the person's mute button (the video itself is also muted while racing
  // through a cut scene, which must not silence these)
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const masterRef = useRef<GainNode | null>(null);
  const rescheduleRef = useRef<() => void>(() => {});

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let live: AudioBufferSourceNode[] = [];
    let master: GainNode | null = null;
    let generation = 0;

    const stopAll = () => {
      generation++;
      for (const node of live) {
        try {
          node.stop();
        } catch {
          /* not started or already ended */
        }
      }
      live = [];
    };

    const schedule = async () => {
      stopAll();
      // racing through a cut scene at high speed: wait until it lands
      if (video.paused || video.ended || video.playbackRate > 2 || !soundsRef.current.length)
        return;
      const ctx = soundContext();
      if (!ctx) return;
      if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);
      if (!master) {
        master = ctx.createGain();
        master.connect(ctx.destination);
        masterRef.current = master;
      }
      master.gain.value = mutedRef.current ? 0 : 1;
      const mine = generation;
      const rate = video.playbackRate || 1;
      const clips = soundsRef.current.filter(
        (clip) => clip.start + clip.duration > video.currentTime + 0.01,
      );
      const buffers = await Promise.all(clips.map((clip) => loadSound(clip.sound)));
      if (mine !== generation || video.paused) return;
      // measured after loading, so the wait for a first download is not lost
      const t = video.currentTime;
      const now = ctx.currentTime;
      clips.forEach((clip, i) => {
        const buffer = buffers[i];
        if (!buffer || !master) return;
        const into = Math.max(0, t - clip.start);
        const length = Math.min(clip.duration, buffer.duration - clip.offset) - into;
        if (length <= 0.01) return;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        const gain = ctx.createGain();
        gain.gain.value = clip.volume;
        source.connect(gain).connect(master);
        source.start(now + Math.max(0, clip.start - t) / rate, clip.offset + into, length);
        live.push(source);
      });
    };

    const restart = () => void schedule();
    rescheduleRef.current = restart;
    video.addEventListener("playing", restart);
    video.addEventListener("seeked", restart);
    video.addEventListener("ratechange", restart);
    video.addEventListener("pause", stopAll);
    video.addEventListener("seeking", stopAll);
    video.addEventListener("waiting", stopAll);
    video.addEventListener("ended", stopAll);
    return () => {
      stopAll();
      rescheduleRef.current = () => {};
      video.removeEventListener("playing", restart);
      video.removeEventListener("seeked", restart);
      video.removeEventListener("ratechange", restart);
      video.removeEventListener("pause", stopAll);
      video.removeEventListener("seeking", stopAll);
      video.removeEventListener("waiting", stopAll);
      video.removeEventListener("ended", stopAll);
      master?.disconnect();
      masterRef.current = null;
    };
  }, [videoRef, videoKey]);

  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = muted ? 0 : 1;
  }, [muted]);

  // an edit while playing takes effect right away
  useEffect(() => {
    rescheduleRef.current();
  }, [sounds]);
}
