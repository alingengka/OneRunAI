import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAudioFeedback } from "@/hooks/use-audio-feedback";
import { AudioPreview } from "@/components/audio-preview";
import { toast } from "sonner";
import {
  Captions,
  Download,
  FileDown,
  Loader2,
  Pause,
  Play,
  Scissors,
  Smartphone,
  Sparkles,
  Upload,
  Waves,
  Wand2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CaptionOverlay } from "@/components/editor/CaptionOverlay";
import { TikTokSafeAreaOverlay } from "@/components/editor/TikTokSafeAreaOverlay";
import { WordTimelineEditor } from "@/components/editor/WordTimelineEditor";
import { StyleControls } from "@/components/editor/StyleControls";
import { StylePicker } from "@/components/editor/StylePicker";
import {
  alignWordsToSegments,
  baseStyle,
  groupWords,
  type CaptionStyle,
  type Word,
} from "@/lib/captions";
import {
  blobToBase64,
  chunkSegments,
  decodeAudioFromFile,
  defaultSilenceOptions,
  detectSpeechSegments,
  encodeSegmentsWav16k,
  encodeWav16k,
  invertSegments,
  refineSpeechSegments,
  smoothSpeechSegments,
  type Segment,
} from "@/lib/media/audio";
import { exportTrimmedWebm } from "@/lib/media/export-video";
import {
  buildCutListJson,
  buildEdl,
  buildFcpxml,
  buildSrt,
  download,
  keptDuration,
  mapToTrimmed,
} from "@/lib/export";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { translateLines } from "@/lib/translate.functions";
import { clearProject, loadProject, saveProject } from "@/lib/project-store";
import { wordsToTranscript, type SyncIssue } from "@/lib/caption-editing";
import { buildCapCutPackage } from "@/lib/capcut-package";
import type { SoundPack } from "@/lib/audio-system";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShortCut Studio — ตัดคลิปเป็น Short Video สไตล์ไวรัล" },
      {
        name: "description",
        content:
          "อัปโหลดคลิป สร้างซับไตเติลอัตโนมัติแบบทีละคำ ตัดช่วงเงียบ และส่งออก SRT / EDL เข้า CapCut ได้ทันที",
      },
      { property: "og:title", content: "ShortCut Studio — ตัดคลิปเป็น Short Video สไตล์ไวรัล" },
      {
        property: "og:description",
        content: "ซับอัตโนมัติ ตัด dead-air และส่งออกไฟล์เข้า CapCut ในเครื่องมือเดียว",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

type Tab = "tools" | "styles" | "customize" | "text" | "audio";

type LangCode = "th" | "lo" | "en";

const LANGUAGES: { code: LangCode; label: string; font: string }[] = [
  { code: "th", label: "ไทย", font: "'Kanit', 'Noto Sans Thai', sans-serif" },
  { code: "lo", label: "ລາວ", font: "'Noto Sans Lao Looped', 'Noto Sans Lao', sans-serif" },
  { code: "en", label: "English", font: "'Inter', system-ui, sans-serif" },
];


function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function Studio() {
  const { play, setVolume: setAudioVolume, setEnabled: setAudioEnabled, setPack: setAudioPack } = useAudioFeedback();
  const transcribe = useServerFn(transcribeAudio);
  const translate = useServerFn(translateLines);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [frameHeight, setFrameHeight] = useState(0);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [transcript, setTranscript] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(baseStyle);
  const [tab, setTab] = useState<Tab>("tools");
  const [languages, setLanguages] = useState<LangCode[]>(["th"]);


  const [captionsOn, setCaptionsOn] = useState(true);
  const [removeSilence, setRemoveSilence] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [tiktokPreview, setTiktokPreview] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);
  const [sfx, setSfx] = useState<{ enabled: boolean; volume: number; pack: SoundPack }>({ enabled: true, volume: 0.35, pack: "clean" });
  const [savedInfo, setSavedInfo] = useState<{ savedAt: number; fileName: string } | null>(null);
  const lastSoundGroupRef = useRef<number>(-1);

  const [threshold, setThreshold] = useState(defaultSilenceOptions.thresholdDb);
  const [minSilence, setMinSilence] = useState(defaultSilenceOptions.minSilence);

  const silences = useMemo(
    () => (duration ? invertSegments(segments, duration) : []),
    [segments, duration],
  );
  const groups = useMemo(() => groupWords(words, style.wordsPerGroup), [words, style.wordsPerGroup]);
  const activeGroup = useMemo(
    () => groups.find((g) => time >= g.start && time <= g.end) ?? null,
    [groups, time],
  );
  const activeGroupIndex = useMemo(() => groups.findIndex((g) => time >= g.start && time <= g.end), [groups, time]);
  const savedSeconds = useMemo(
    () => silences.reduce((sum, s) => sum + (s.end - s.start), 0),
    [silences],
  );

  // measure preview frame for font scaling
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFrameHeight(el.clientHeight));
    ro.observe(el);
    setFrameHeight(el.clientHeight);
    return () => ro.disconnect();
  }, [videoUrl]);

  // playback clock + silence skipping
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const t = v.currentTime;
        if (removeSilence && segments.length) {
          const gap = silences.find((g) => t >= g.start && t < g.end - 0.02);
          if (gap) {
            const next = segments.find((s) => s.start >= gap.end - 0.001);
            v.currentTime = next ? next.start : v.duration;
          }
        }
        setTime(v.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [removeSilence, segments, silences]);

  useEffect(() => {
    setAudioEnabled(sfx.enabled);
    setAudioVolume(sfx.volume);
    setAudioPack(sfx.pack);
  }, [sfx, setAudioEnabled, setAudioPack, setAudioVolume]);

  useEffect(() => {
    if (!playing || !sfx.enabled || activeGroupIndex < 0 || activeGroupIndex === lastSoundGroupRef.current) return;
    lastSoundGroupRef.current = activeGroupIndex;
    void play(style.animation);
  }, [activeGroupIndex, play, playing, sfx.enabled, style.animation]);

  const analyze = useCallback(
    async (target: File, thresholdDb: number, minSil: number) => {
      setAnalyzing(true);
      try {
        let buffer = audioBufferRef.current;
        if (!buffer) {
          buffer = await decodeAudioFromFile(target);
          audioBufferRef.current = buffer;
        }
        const detected = detectSpeechSegments(buffer, {
          ...defaultSilenceOptions,
          thresholdDb,
          minSilence: minSil,
        });
        const segs = smoothSpeechSegments(detected, buffer.duration);
        if (!segs.length) throw new Error("ไม่พบช่วงเสียงพูด ลองลดค่าความไวเสียง");
        setSegments(segs);
        setDuration((d) => d || buffer!.duration);
        toast.success(`พบช่วงพูด ${segs.length} ช่วง`);
        play("success");
        return { buffer, segs };
      } catch (e) {
        toast.error("อ่านเสียงจากไฟล์นี้ไม่ได้ ลองไฟล์ MP4/WebM ที่มีเสียง");
        throw e;
      } finally {
        setAnalyzing(false);
      }
    },
    [],
  );

  const onPickFile = async (f: File) => {
    audioBufferRef.current = null;
    setFile(f);
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setWords([]);
    setTranscript("");
    setSegments([]);
    setTime(0);
    const r = await analyze(f, threshold, minSilence).catch(() => undefined);
    if (r) setRemoveSilence(true); // AI Edit: ตัดช่วงเงียบอัตโนมัติทันที
  };

  // ── บันทึกงานอัตโนมัติ (ช่วงที่ตัด + ซับที่แก้แล้ว) ก่อนปิดหน้า ──────────
  useEffect(() => {
    setSavedInfo(loadProject());
  }, []);

  const snapshot = useCallback(
    () => ({
      fileName: file?.name ?? "clip",
      duration,
      segments,
      words,
      transcript,
      style,
      languages,
      threshold,
      minSilence,
      noiseReduction,
      sfx,
    }),
    [file, duration, segments, words, transcript, style, languages, threshold, minSilence, noiseReduction, sfx],
  );

  useEffect(() => {
    if (!segments.length && !words.length) return;
    const t = setTimeout(() => saveProject(snapshot()), 800);
    return () => clearTimeout(t);
  }, [snapshot, segments.length, words.length]);

  useEffect(() => {
    const onLeave = () => {
      if (segments.length || words.length) saveProject(snapshot());
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [snapshot, segments.length, words.length]);

  const restoreProject = () => {
    const p = loadProject();
    if (!p) { toast.error("ไม่มีงานที่บันทึกไว้"); return; }
    setSegments(p.segments);
    setWords(p.words);
    setTranscript(p.transcript);
    setStyle(p.style);
    setLanguages((p.languages as LangCode[]).length ? (p.languages as LangCode[]) : ["th"]);
    setThreshold(p.threshold);
    setMinSilence(p.minSilence);
    setNoiseReduction(p.noiseReduction ?? false);
    if (p.sfx) setSfx(p.sfx);
    setDuration((d) => d || p.duration);
    setRemoveSilence(true);
    setCaptionsOn(true);
    toast.success(`โหลดงานที่บันทึกไว้ (${p.fileName}) แล้ว — อัปโหลดคลิปเดิมเพื่อดูพรีวิว`);
  };

  // ── แปลซับเป็นภาษาอื่น (คงเวลาเดิม) ─────────────────────────────────────
  const translateCaptions = async (target: LangCode) => {
    if (!words.length) { toast.error("ยังไม่มีซับให้แปล"); return; }
    setTranslating(true);
    const id = toast.loading("กำลังแปลซับ…");
    try {
      const src = groupWords(words, style.wordsPerGroup);
      const lines = src.map((g) => g.words.map((w) => w.text).join(" "));
      const out: Word[] = [];
      const size = 40;
      const translated: string[] = [];
      for (let i = 0; i < lines.length; i += size) {
        const res = await translate({ data: { lines: lines.slice(i, i + size), target } });
        translated.push(...res.lines);
      }
      src.forEach((g, i) => {
        const segsForGroup = [{ start: g.start, end: g.end }];
        out.push(...alignWordsToSegments(translated[i] ?? "", segsForGroup, g.end - g.start));
      });
      if (!out.length) throw new Error("แปลไม่สำเร็จ");
      setWords(out);
      setTranscript(translated.join(" "));
      const lang = LANGUAGES.find((l) => l.code === target);
      if (lang) setStyle((s) => ({ ...s, fontFamily: lang.font }));
      setLanguages([target]);
      toast.success(`แปลซับเป็น ${lang?.label ?? target} แล้ว`, { id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "แปลไม่สำเร็จ", { id });
    } finally {
      setTranslating(false);
    }
  };



  const runTranscribe = async () => {
    if (!file) { toast.error("อัปโหลดคลิปก่อน"); return; }
    setTranscribing(true);
    try {
      let buffer = audioBufferRef.current;
      let segs = segments;
      if (!buffer || !segs.length) {
        const r = await analyze(file, threshold, minSilence);
        buffer = r.buffer;
        segs = r.segs;
      }
      const lang = languages[0] ?? "th";
      // ถอดเสียงทีละก้อน (เฉพาะช่วงที่มีเสียงพูด) เพื่อให้คำตรงกับเวลาที่พูดจริง
      const transcriptionSegments = refineSpeechSegments(buffer, segs, 4);
      // One short speech region per request keeps Lao/Thai words anchored to the
      // phrase where they were actually spoken instead of spreading a long
      // transcript over several disconnected regions.
      const chunks = transcriptionSegments.map((segment) => [segment]);
      const allWords: Word[] = [];
      const texts: string[] = [];

      if (chunks.length) {
        for (let i = 0; i < chunks.length; i++) {
          const chunkSegs = chunks[i]!;
          const wav = encodeSegmentsWav16k(buffer, chunkSegs, noiseReduction);
          if (wav.size < 4096) continue;
          const b64 = await blobToBase64(wav);
          const res = await transcribe({ data: { audioBase64: b64, language: lang } });
          const text = (res.text ?? "").trim();
          if (!text) continue;
          texts.push(text);
          const chunkDur = chunkSegs.reduce((n, s) => n + (s.end - s.start), 0);
          allWords.push(...alignWordsToSegments(text, chunkSegs, chunkDur));
          setTranscript(texts.join(" "));
          setWords([...allWords]);
        }
      } else {
        const wav = encodeWav16k(buffer);
        if (wav.size < 4096) throw new Error("ไฟล์เสียงสั้นเกินไป");
        const b64 = await blobToBase64(wav);
        const res = await transcribe({ data: { audioBase64: b64, language: lang } });
        const text = (res.text ?? "").trim();
        if (text) {
          texts.push(text);
          allWords.push(...alignWordsToSegments(text, segs, buffer!.duration));
        }
      }

      if (!allWords.length) throw new Error("ไม่พบคำพูดในคลิป");
      setTranscript(texts.join(" "));
      setWords(allWords);
      setCaptionsOn(true);
      setRemoveSilence(true);
      toast.success("สร้างซับไตเติล + ตัดช่วงเงียบเรียบร้อย");
      play("success");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ถอดเสียงไม่สำเร็จ");
      play("error");
    } finally {
      setTranscribing(false);
    }
  };

  const previewRange = (start: number, end: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, start - 0.18);
    void video.play();
    setPlaying(true);
    window.setTimeout(() => {
      if (video.currentTime <= end + 0.5) {
        video.pause();
        setPlaying(false);
      }
    }, Math.max(650, (end - start + 0.7) * 1000));
  };

  const retrySyncIssues = async (issues: SyncIssue[]) => {
    if (!file || !audioBufferRef.current) { toast.error("อัปโหลดคลิปก่อนตรวจซิงก์"); return; }
    if (!issues.length) { toast.success("เวลาซับเรียงต่อเนื่องดี ไม่พบจุดผิดปกติ"); return; }
    setRetryingSync(true);
    const id = toast.loading(`กำลังลองใหม่ ${issues.length} ช่วง…`);
    try {
      let next = [...words];
      for (const issue of issues.slice(0, 12)) {
        const old = next[issue.index];
        if (!old) continue;
        const region = { start: Math.max(0, old.start - 0.45), end: Math.min(duration, old.end + 0.45) };
        const wav = encodeSegmentsWav16k(audioBufferRef.current, [region]);
        if (wav.size < 2048) continue;
        const res = await transcribe({ data: { audioBase64: await blobToBase64(wav), language: languages[0] ?? "th" } });
        const replacements = alignWordsToSegments(res.text ?? old.text, [region], region.end - region.start);
        if (replacements.length) next = [...next.slice(0, issue.index), ...replacements, ...next.slice(issue.index + 1)];
      }
      next.sort((a, b) => a.start - b.start);
      setWords(next);
      setTranscript(wordsToTranscript(next));
      toast.success("ตรวจและซิงก์ช่วงที่ผิดปกติใหม่แล้ว", { id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ตรวจซิงก์ไม่สำเร็จ", { id });
    } finally {
      setRetryingSync(false);
    }
  };

  const exportTrimmedVideo = async () => {
    if (!videoUrl || !segments.length) { toast.error("อัปโหลดคลิปและวิเคราะห์เสียงก่อน"); return; }
    setRendering(true);
    const id = toast.loading("กำลังตัดช่วงเงียบและเรนเดอร์วิดีโอ… 0%");
    try {
      const blob = await exportTrimmedWebm(
        videoUrl,
        segments,
        (r) => toast.loading(`กำลังตัดช่วงเงียบและเรนเดอร์วิดีโอ… ${Math.round(r * 100)}%`, { id }),
        { noiseReduction, smoothCuts: true },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(file?.name ?? "clip").replace(/\.[^.]+$/, "")}-nosilence.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("ได้วิดีโอที่ตัดช่วงเงียบออกแล้ว", { id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เรนเดอร์วิดีโอไม่สำเร็จ", { id });
    } finally {
      setRendering(false);
    }
  };

  const exportCapCutPackage = async () => {
    if (!videoUrl || !segments.length || !groups.length) { toast.error("ต้องมีวิดีโอ ช่วงตัด และซับก่อน"); return; }
    setRendering(true);
    const id = toast.loading("กำลังสร้าง CapCut Package…");
    try {
      const video = await exportTrimmedWebm(videoUrl, [...segments], (ratio) => toast.loading(`กำลังสร้าง CapCut Package… ${Math.round(ratio * 100)}%`, { id }), { noiseReduction, smoothCuts: true });
      const baseName = (file?.name ?? "clip").replace(/\.[^.]+$/, "");
      const bundle = await buildCapCutPackage({ baseName, video, duration, keep: [...segments], removed: [...silences], groups: [...groups] });
      const url = URL.createObjectURL(bundle);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${baseName}-capcut.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("ดาวน์โหลดวิดีโอ + SRT ที่เวลาแม็ปตรงกันแล้ว", { id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "สร้าง CapCut Package ไม่สำเร็จ", { id });
    } finally { setRendering(false); }
  };


  const applyTranscriptEdit = () => {
    if (!transcript.trim()) { toast.error("ยังไม่มีข้อความ"); return; }
    setWords(alignWordsToSegments(transcript, segments, duration));
    toast.success("อัปเดตข้อความซับแล้ว");
  };

  const updateWords = (next: Word[]) => {
    setWords(next);
    setTranscript(wordsToTranscript(next));
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const remap = useCallback(
    (t: number) => (removeSilence && segments.length ? mapToTrimmed(t, segments) : t),
    [removeSilence, segments],
  );

  const exportSrt = () => {
    if (!groups.length) { toast.error("ยังไม่มีซับไตเติล"); return; }
    const baseName = (file?.name ?? "clip").replace(/\.[^.]+$/, "");
    download(`${baseName}-captions.srt`, buildSrt(groups, remap), "application/x-subrip");
    play("pop");
    toast.success("ดาวน์โหลด .srt แล้ว — ลากเข้า CapCut ได้เลย");
  };
  const exportEdl = () => {
    if (!segments.length) { toast.error("ยังไม่ได้วิเคราะห์เสียง"); return; }
    download(`${file?.name ?? "clip"}.edl`, buildEdl(segments, file?.name ?? "clip"));
    play("pop");
    toast.success("ดาวน์โหลด .edl (cut list) แล้ว");
  };
  const exportJson = () => {
    if (!segments.length) { toast.error("ยังไม่ได้วิเคราะห์เสียง"); return; }
    download(
      `${file?.name ?? "clip"}.capcut.json`,
      buildCutListJson({
        clipName: file?.name ?? "clip",
        duration,
        keep: segments,
        removed: silences,
        groups,
      }),
      "application/json",
    );
    toast.success("ดาวน์โหลดไฟล์ cut list แล้ว");
  };
  const exportXml = () => {
    if (!segments.length) { toast.error("ยังไม่ได้วิเคราะห์เสียง"); return; }
    const v = videoRef.current;
    download(
      `${(file?.name ?? "clip").replace(/\.[^.]+$/, "")}-timeline.xml`,
      buildFcpxml({
        clipName: file?.name ?? "clip",
        duration,
        keep: segments,
        width: v?.videoWidth || 1080,
        height: v?.videoHeight || 1920,
      }),
      "application/xml",
    );
    toast.success("ดาวน์โหลด .xml (timeline ตัดช่วงเงียบ) แล้ว");
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Scissors className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">ShortCut Studio</h1>
            <p className="text-xs text-muted-foreground">ตัดคลิปยาวให้เป็น Short แบบไวรัล</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
            }}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> อัปโหลดคลิป
          </Button>
          <Button onClick={exportSrt}>
            <Download className="mr-2 h-4 w-4" /> Export SRT
          </Button>
        </div>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* Left: controls */}
        <section className="order-2 rounded-2xl border border-border bg-card p-5 lg:order-1">
          <div className="mb-5 flex gap-2 rounded-xl bg-secondary p-1">
            {(
              [
                ["tools", "AI Tools"],
                ["styles", "Caption Style"],
                ["customize", "Customize"],
                ["text", "Edit Text"],
                ["audio", "Audio"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); play("hover"); }}
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "tools" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Captions className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">AI Captions</p>
                      <p className="text-xs text-muted-foreground">
                        ถอดเสียงและสร้างซับอัตโนมัติ ปรับได้ทีละคำ
                      </p>
                    </div>
                  </div>
                  <Switch checked={captionsOn} onCheckedChange={setCaptionsOn} />
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={runTranscribe} disabled={transcribing || !file}>
                    {transcribing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    สร้างซับด้วย AI
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setTab("styles")}>
                    Style
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setTab("text")}>
                    Edit
                  </Button>
                </div>
                <div className="mt-4">
                  <Label className="text-[11px] uppercase text-muted-foreground">ภาษาต้นฉบับในวิดีโอ</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {LANGUAGES.map((language) => (
                      <Button
                        key={language.code}
                        size="sm"
                        variant={languages[0] === language.code ? "default" : "outline"}
                        onClick={() => {
                          setLanguages((current) => [language.code, ...current.filter((code) => code !== language.code)]);
                          setStyle((current) => ({ ...current, fontFamily: language.font }));
                        }}
                      >
                        {language.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Waves className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">ลดเสียงรบกวน</p>
                      <p className="text-xs text-muted-foreground">กรองเสียงต่ำ เสียงฮัม และปรับระดับเสียงพูดให้นิ่งขึ้นตอนถอดเสียงและส่งออก</p>
                    </div>
                  </div>
                  <Switch checked={noiseReduction} onCheckedChange={setNoiseReduction} />
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Scissors className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Remove Silences</p>
                      <p className="text-xs text-muted-foreground">
                        ตัดช่วงเงียบ / dead-air ออกอัตโนมัติ
                      </p>
                    </div>
                  </div>
                  <Switch checked={removeSilence} onCheckedChange={setRemoveSilence} />
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase text-muted-foreground">
                      ความไวเสียง — {threshold} dB
                    </Label>
                    <Slider
                      value={[threshold]}
                      min={-60}
                      max={-15}
                      step={1}
                      onValueChange={([v]) => setThreshold(v ?? -34)}
                      onValueCommit={() => file && void analyze(file, threshold, minSilence)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase text-muted-foreground">
                      ช่วงเงียบขั้นต่ำ — {minSilence.toFixed(2)}s
                    </Label>
                    <Slider
                      value={[minSilence]}
                      min={0.1}
                      max={1.5}
                      step={0.05}
                      onValueChange={([v]) => setMinSilence(v ?? 0.35)}
                      onValueCommit={() => file && void analyze(file, threshold, minSilence)}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    ตัดออกได้ {savedSeconds.toFixed(1)}s · เหลือ {keptDuration(segments).toFixed(1)}s
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!file || analyzing}
                    onClick={() => file && void analyze(file, threshold, minSilence)}
                  >
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : "วิเคราะห์ใหม่"}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">

                <p className="mb-1 text-sm font-medium">แปลซับด้วย AI</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  แปลข้อความซับเป็นภาษาอื่นโดยคงจังหวะเวลาเดิม
                </p>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <Button
                      key={l.code}
                      size="sm"
                      variant="secondary"
                      disabled={translating || !words.length}
                      onClick={() => void translateCaptions(l.code)}
                    >
                      {translating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      แปลเป็น {l.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="mb-1 text-sm font-medium">งานที่บันทึกไว้</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  {savedInfo
                    ? `บันทึกล่าสุด: ${savedInfo.fileName} · ${new Date(savedInfo.savedAt).toLocaleString()}`
                    : "ระบบจะบันทึกช่วงที่ตัดและซับที่แก้ไว้อัตโนมัติก่อนปิดหน้า"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { saveProject(snapshot()); setSavedInfo(loadProject()); toast.success("บันทึกงานแล้ว"); }}>
                    บันทึกตอนนี้
                  </Button>
                  <Button size="sm" variant="secondary" onClick={restoreProject}>
                    โหลดงานกลับ
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { clearProject(); setSavedInfo(null); toast.success("ลบงานที่บันทึกแล้ว"); }}>
                    ล้างงานที่บันทึก
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="mb-1 text-sm font-medium">ส่งออกเข้า CapCut</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  ดาวน์โหลดแพ็กเกจเดียวที่มีวิดีโอตัดช่วงเงียบ + SRT ซึ่งใช้ไทม์ไลน์เดียวกัน แล้ว Import ทั้งสองไฟล์เข้า CapCut
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void exportCapCutPackage()} disabled={rendering || !segments.length || !groups.length}>
                    {rendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    CapCut Package .zip
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportSrt}>
                    <FileDown className="mr-2 h-4 w-4" /> .srt
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void exportTrimmedVideo()}
                    disabled={rendering || !segments.length}
                  >
                    {rendering ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    วิดีโอตัดช่วงเงียบ .webm
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportXml}>
                    <FileDown className="mr-2 h-4 w-4" /> .xml (สำหรับ editor ที่รองรับ)
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportEdl}>
                    <FileDown className="mr-2 h-4 w-4" /> .edl
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportJson}>
                    <FileDown className="mr-2 h-4 w-4" /> cut list .json
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      transcript
                        ? download(`${file?.name ?? "clip"}.txt`, transcript)
                        : toast.error("ยังไม่มีข้อความ")
                    }
                  >
                    transcript .txt
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "styles" && (
            <StylePicker
              activeId={style.id}
              onSelect={(preset) => {
                setStyle(preset);
                  void play(preset.animation);
                toast.success(`ใช้สไตล์ ${preset.name}`);
              }}
            />
          )}

          {tab === "customize" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  ภาษา (เลือกเพิ่ม/เอาออกได้)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => {
                    const on = languages.includes(l.code);
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          const next = on
                            ? languages.filter((c) => c !== l.code)
                            : [...languages, l.code];
                          if (!next.length) { toast.error("ต้องเลือกอย่างน้อย 1 ภาษา"); return; }
                          setLanguages(next);
                          if (!on) setStyle((s) => ({ ...s, fontFamily: l.font }));
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-secondary text-muted-foreground",
                        )}
                      >
                        {l.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  ภาษาแรกที่เลือกจะใช้ถอดเสียง และรายชื่อฟอนต์จะกรองตามภาษาที่เลือก
                </p>
              </div>
              <StyleControls
                style={style}
                onChange={(p) => {
                  setStyle((s) => ({ ...s, ...p }));
                  if (p.animation) void play(p.animation);
                }}
                scripts={languages.map((c) => (c === "en" ? "latin" : c))}
              />
            </div>
          )}

          {tab === "text" && (
            <div className="space-y-6">
              <WordTimelineEditor
                words={words}
                duration={duration}
                onChange={updateWords}
                onPreview={previewRange}
                onRetryIssues={(issues) => void retrySyncIssues(issues)}
                retrying={retryingSync}
              />
              <div className="border-t border-border pt-5">
              <Label className="text-xs text-muted-foreground">
                แก้ทั้งข้อความ — การอัปเดตส่วนนี้จะคำนวณเวลาใหม่ทั้งคลิป
              </Label>
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={12}
                placeholder="กด “สร้างซับด้วย AI” หรือพิมพ์ข้อความเองที่นี่..."
              />
              <div className="flex gap-2">
                <Button onClick={applyTranscriptEdit}>
                  <Wand2 className="mr-2 h-4 w-4" /> อัปเดตซับ
                </Button>
                <span className="self-center text-xs text-muted-foreground">
                  {words.length} คำ · {groups.length} บล็อก
                </span>
              </div>
              </div>
            </div>
          )}

          {tab === "audio" && (
            <AudioPreview
              animation={style.animation}
              enabled={sfx.enabled}
              volume={sfx.volume}
              pack={sfx.pack}
              onChange={(patch) => setSfx((current) => ({ ...current, ...patch }))}
            />
          )}
        </section>

        {/* Right: preview */}
        <section className="order-1 lg:order-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium"><Smartphone className="h-4 w-4" /> TikTok Preview</div>
              <Switch checked={tiktokPreview} onCheckedChange={setTiktokPreview} aria-label="เปิดพรีวิว TikTok" />
            </div>
            <div
              ref={frameRef}
              className="relative mx-auto aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-xl bg-black"
            >
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="h-full w-full object-cover"
                  playsInline
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                  onEnded={() => setPlaying(false)}
                  onClick={togglePlay}
                />
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
                >
                  <Upload className="h-6 w-6" />
                  แตะเพื่ออัปโหลดคลิป
                </button>
              )}
              {captionsOn && (
                <CaptionOverlay
                  group={activeGroup}
                  time={time}
                  style={style}
                  height={frameHeight}
                  onPositionChange={({ posX, posY }) => setStyle((current) => ({ ...current, posX, posY }))}
                />
              )}
              {tiktokPreview && <TikTokSafeAreaOverlay />}
            </div>
            {videoUrl && <p className="mt-2 text-center text-xs text-muted-foreground">ลากข้อความบนวิดีโอเพื่อย้ายตำแหน่งได้ทันที</p>}

            <div className="mt-4 space-y-3">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                {duration > 0 &&
                  silences.map((s, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-full bg-destructive/60"
                      style={{
                        left: `${(s.start / duration) * 100}%`,
                        width: `${((s.end - s.start) / duration) * 100}%`,
                      }}
                    />
                  ))}
                <div
                  className="absolute top-0 h-full w-0.5 bg-primary"
                  style={{ left: `${duration ? (time / duration) * 100 : 0}%` }}
                />
              </div>

              <Slider
                value={[time]}
                min={0}
                max={Math.max(duration, 0.1)}
                step={0.01}
                onValueChange={([v]) => {
                  if (videoRef.current) videoRef.current.currentTime = v ?? 0;
                }}
              />

              <div className="flex items-center justify-between">
                <Button size="icon" variant="secondary" onClick={togglePlay} disabled={!videoUrl}>
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <span className="font-mono text-xs text-muted-foreground">
                  {fmt(time)} / {fmt(duration)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
