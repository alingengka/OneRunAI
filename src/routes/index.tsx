import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAudioFeedback } from "@/hooks/use-audio-feedback";
import { AudioPreview } from "@/components/audio-preview";
import { toast } from "sonner";
import {
  Captions,
  CheckCircle2,
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
  AlertTriangle,
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
  LINE_BREAK,

  type CaptionStyle,
  type Word,
} from "@/lib/captions";
import {
  blobToBase64,
  addChunkOverlap,
  buildAsrChunks,
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
import { forcedAlignWords, mergeAlignedChunks } from "@/lib/media/forced-align";
import { exportTrimmedWebm } from "@/lib/media/export-video";
import { exportBurnedVideo } from "@/lib/media/export-burned";

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
import { wordsToTranscript, buildRowWords, syncAccuracy, type SyncIssue } from "@/lib/caption-editing";
import { buildCapCutPackage } from "@/lib/capcut-package";
import type { SoundPack } from "@/lib/audio-system";
import { buildScenes } from "@/lib/scenes";
import { ScenesPanel } from "@/components/editor/ScenesPanel";
import { StepBar, type Step } from "@/components/editor/StepBar";


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

type Tab = "tools" | "styles" | "customize" | "text" | "scenes" | "audio" | "export";

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
  const [glossary, setGlossary] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(baseStyle);
  const [tab, setTab] = useState<Tab>("tools");
  const [languages, setLanguages] = useState<LangCode[]>(["th"]);


  const [captionsOn, setCaptionsOn] = useState(true);
  const [removeSilence, setRemoveSilence] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [tiktokPreview, setTiktokPreview] = useState(false);
  const [autoResync, setAutoResync] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);
  const [sfx, setSfx] = useState<{ enabled: boolean; volume: number; pack: SoundPack }>({ enabled: true, volume: 0.35, pack: "clean" });
  const [savedInfo, setSavedInfo] = useState<{ savedAt: number; fileName: string } | null>(null);
  const lastSoundGroupRef = useRef<number>(-1);

  const [dropped, setDropped] = useState<string[]>([]);
  const [job, setJob] = useState<{ label: string; ratio: number | null } | null>(null);
  const jobAbort = useRef<AbortController | null>(null);
  const [threshold, setThreshold] = useState(defaultSilenceOptions.thresholdDb);
  const [minSilence, setMinSilence] = useState(defaultSilenceOptions.minSilence);

  const scenes = useMemo(() => buildScenes(segments, words), [segments, words]);
  const droppedRanges = useMemo(
    () => scenes.filter((s) => dropped.includes(s.id)).map((s) => ({ start: s.start, end: s.end })),
    [scenes, dropped],
  );
  const isDropped = useCallback(
    (t: number) => droppedRanges.some((r) => t >= r.start - 0.001 && t <= r.end + 0.001),
    [droppedRanges],
  );
  /** ช่วงที่จะเก็บไว้จริง = ช่วงพูด ลบซีนที่ผู้ใช้ปิดไว้ */
  const keepSegments = useMemo(
    () => segments.filter((s) => !isDropped((s.start + s.end) / 2)),
    [segments, isDropped],
  );
  const visibleWords = useMemo(() => words.filter((w) => !isDropped(w.start)), [words, isDropped]);

  const silences = useMemo(
    () => (duration ? invertSegments(keepSegments, duration) : []),
    [keepSegments, duration],
  );
  const groups = useMemo(() => groupWords(visibleWords, style.wordsPerGroup), [visibleWords, style.wordsPerGroup]);
  const activeGroup = useMemo(
    () => groups.find((g) => time >= g.start && time <= g.end) ?? null,
    [groups, time],
  );
  const activeGroupIndex = useMemo(() => groups.findIndex((g) => time >= g.start && time <= g.end), [groups, time]);
  const accuracy = useMemo(() => syncAccuracy(words, segments, duration), [words, segments, duration]);
  const confidenceSummary = useMemo(() => {
    const timed = words.filter((word) => word.text !== LINE_BREAK);
    const scored = timed.filter((word) => typeof word.confidence === "number");
    if (!scored.length) return { score: null, high: 0, review: 0, low: 0 };
    const score = scored.reduce((sum, word) => sum + (word.confidence ?? 0), 0) / scored.length;
    return {
      score,
      high: scored.filter((word) => word.confidenceLabel === "high").length,
      review: scored.filter((word) => word.confidenceLabel === "review").length,
      low: scored.filter((word) => word.confidenceLabel === "low").length,
    };
  }, [words]);
  const previewLineCount = useMemo(() => {
    if (!activeGroup) return 3;
    const manual = activeGroup.words.filter((w) => w.text === LINE_BREAK).length;
    if (manual) return manual + 1;
    const per = Math.max(0, Math.round(style.wordsPerLine ?? 0));
    const visible = activeGroup.words.filter((w) => w.text !== LINE_BREAK).length;
    return per > 0 ? Math.max(1, Math.ceil(visible / per)) : 1;
  }, [activeGroup, style.wordsPerLine]);
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
        if (removeSilence && keepSegments.length) {
          const gap = silences.find((g) => t >= g.start && t < g.end - 0.02);
          if (gap) {
            const next = keepSegments.find((s) => s.start >= gap.end - 0.001);
            v.currentTime = next ? next.start : v.duration;
          }
        }
        setTime(v.currentTime);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [removeSilence, keepSegments, silences]);

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
      glossary,
      style,
      languages,
      threshold,
      minSilence,
      noiseReduction,
      sfx,
    }),
    [file, duration, segments, words, transcript, glossary, style, languages, threshold, minSilence, noiseReduction, sfx],
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
    setGlossary(p.glossary ?? "");
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
      // ถอดเสียงทีละวลี (รวมช่วงพูดที่ต่อเนื่องกัน) เพื่อให้โมเดลมีบริบทพอ
      // และคำยังยึดกับช่วงเวลาที่พูดจริง
      const transcriptionSegments = refineSpeechSegments(buffer, segs, lang === "lo" ? 12 : 8);
      const baseChunks = buildAsrChunks(transcriptionSegments, buffer.duration, {
        // Lao needs longer phrases (and a little more head/tail room) for the
        // model to resolve tone marks and word boundaries correctly.
        min: lang === "lo" ? 4.5 : 2.4,
        max: lang === "lo" ? 18 : 14,
        gap: lang === "lo" ? 0.8 : 0.55,
        pad: lang === "lo" ? 0.25 : 0.12,
      });
      const chunks = lang === "lo" ? addChunkOverlap(baseChunks, buffer.duration, 0.38) : baseChunks;
      const allWords: Word[] = [];
      const texts: string[] = [];

      if (chunks.length) {
        for (let i = 0; i < chunks.length; i++) {
          const chunkSegs = chunks[i]!;
          // Send clean, undistorted audio to the model: the noise-gate is for
          // the exported mix, not for recognition.
          const wav = encodeSegmentsWav16k(buffer, chunkSegs, false);
          if (wav.size < 4096) continue;
          const b64 = await blobToBase64(wav);
          const terms = glossary.split(/[\n,]/).map((term) => term.trim()).filter(Boolean).slice(0, 40);
          const res = await transcribe({
            data: { audioBase64: b64, language: lang, context: texts.join(" ").slice(-600), glossary: terms },
          });
          const text = (res.text ?? "").trim();
          if (!text) continue;
          texts.push(text);
          const chunkDur = chunkSegs.reduce((n, s) => n + (s.end - s.start), 0);
          const aligned = forcedAlignWords(buffer, chunkSegs, text, chunkDur).map((word) => {
            const acoustic = word.confidence ?? 0.5;
            const confidence = Math.max(0.15, Math.min(0.99, acoustic * 0.62 + res.agreement * 0.38));
            return { ...word, confidence, confidenceLabel: confidence >= 0.78 ? "high" as const : confidence >= 0.52 ? "review" as const : "low" as const };
          });
          const merged = mergeAlignedChunks(allWords, aligned);
          allWords.splice(0, allWords.length, ...merged);
          setTranscript(texts.join(" "));
          setWords([...allWords]);
        }
      } else {


        const wav = encodeWav16k(buffer);
        if (wav.size < 4096) throw new Error("ไฟล์เสียงสั้นเกินไป");
        const b64 = await blobToBase64(wav);
        const res = await transcribe({ data: { audioBase64: b64, language: lang, glossary: glossary.split(/[\n,]/).map((term) => term.trim()).filter(Boolean).slice(0, 40) } });
        const text = (res.text ?? "").trim();
        if (text) {
          texts.push(text);
          allWords.push(...forcedAlignWords(buffer!, segs, text, buffer!.duration));
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
        const replacements = forcedAlignWords(audioBufferRef.current, [region], res.text ?? old.text, region.end - region.start);
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

  /** ตัวช่วยจัดการงานเรนเดอร์: มีสถานะ % และปุ่มยกเลิกจริง */
  const runJob = async (label: string, work: (signal: AbortSignal, onProgress: (r: number) => void) => Promise<void>) => {
    const controller = new AbortController();
    jobAbort.current = controller;
    setRendering(true);
    setJob({ label, ratio: 0 });
    try {
      await work(controller.signal, (r) => setJob({ label, ratio: Math.max(0, Math.min(1, r)) }));
      if (!controller.signal.aborted) play("success");
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        toast.message("ยกเลิกงานแล้ว");
      } else {
        toast.error(error instanceof Error ? error.message : "ทำงานไม่สำเร็จ");
        play("error");
      }
    } finally {
      jobAbort.current = null;
      setJob(null);
      setRendering(false);
    }
  };

  const cancelJob = () => {
    jobAbort.current?.abort();
  };

  const saveBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const baseName = () => (file?.name ?? "clip").replace(/\.[^.]+$/, "");

  const exportTrimmedVideo = () => {
    if (!videoUrl || !keepSegments.length) { toast.error("อัปโหลดคลิปและวิเคราะห์เสียงก่อน"); return; }
    void runJob("ตัดช่วงเงียบและเรนเดอร์วิดีโอ", async (signal, onProgress) => {
      const blob = await exportTrimmedWebm(videoUrl, [...keepSegments], onProgress, {
        noiseReduction,
        smoothCuts: true,
        signal,
      });
      if (signal.aborted) return;
      saveBlob(blob, `${baseName()}-nosilence.webm`);
      toast.success("ได้วิดีโอที่ตัดช่วงเงียบออกแล้ว");
    });
  };

  /** ส่งออกวิดีโอสำเร็จรูป: ตัดช่วงเงียบ + ฝังซับลงในภาพ ใช้โพสต์ได้เลย */
  const exportFinalVideo = () => {
    if (!videoUrl || !keepSegments.length) { toast.error("อัปโหลดคลิปและวิเคราะห์เสียงก่อน"); return; }
    void runJob("เรนเดอร์วิดีโอพร้อมซับ", async (signal, onProgress) => {
      const { blob, ext } = await exportBurnedVideo(
        videoUrl,
        [...keepSegments],
        [...groups],
        style,
        onProgress,
        { noiseReduction, smoothCuts: true, captions: captionsOn, signal },
      );
      if (signal.aborted) return;
      saveBlob(blob, `${baseName()}-final.${ext}`);
      toast.success("ได้วิดีโอพร้อมโพสต์แล้ว (ซับฝังในภาพ)");
    });
  };

  const exportCapCutPackage = () => {
    if (!videoUrl || !keepSegments.length || !groups.length) { toast.error("ต้องมีวิดีโอ ช่วงตัด และซับก่อน"); return; }
    void runJob("สร้าง CapCut Package", async (signal, onProgress) => {
      const video = await exportTrimmedWebm(videoUrl, [...keepSegments], (r) => onProgress(r * 0.9), {
        noiseReduction,
        smoothCuts: true,
        signal,
      });
      if (signal.aborted) return;
      const bundle = await buildCapCutPackage({
        baseName: baseName(),
        video,
        duration,
        keep: [...keepSegments],
        removed: [...silences],
        groups: [...groups],
      });
      onProgress(1);
      saveBlob(bundle, `${baseName()}-capcut.zip`);
      toast.success("ดาวน์โหลดวิดีโอ + SRT ที่เวลาแม็ปตรงกันแล้ว");
    });
  };


  const applyTranscriptEdit = () => {
    if (!transcript.trim()) { toast.error("ยังไม่มีข้อความ"); return; }
    setWords(
      audioBufferRef.current
        ? forcedAlignWords(audioBufferRef.current, segments, transcript, duration)
        : alignWordsToSegments(transcript, segments, duration),
    );
    toast.success("อัปเดตข้อความซับแล้ว");
  };

  const updateWords = (next: Word[]) => {
    setWords(next);
    setTranscript(wordsToTranscript(next));
  };

  /** แก้ข้อความของบล็อกซับที่กำลังแสดงบนพรีวิว ("\n" = แยกแถว) */
  const editActiveGroupText = (text: string) => {
    if (!activeGroup) return;
    const first = words.findIndex((w) => w === activeGroup.words[0]);
    if (first < 0) return;
    const last = first + activeGroup.words.length;
    const rows = text.split("\n").map((r) => r.trim()).filter(Boolean);
    if (!rows.length) return;
    const span = Math.max(0.12, activeGroup.end - activeGroup.start);
    let replacement: Word[];
    if (autoResync && segments.length) {
      // รีซิงก์อัตโนมัติ: กระจายคำตามช่วงเสียงพูดจริงภายในบล็อกนี้
      replacement = buildRowWords(rows, activeGroup.start, activeGroup.end, segments);
    } else {
      const totalChars = rows.reduce((n, r) => n + r.length, 0) || 1;
      replacement = [];
      let cursor = activeGroup.start;
      rows.forEach((row, i) => {
        const rowEnd = i === rows.length - 1 ? activeGroup.end : cursor + (row.length / totalChars) * span;
        if (i > 0) replacement.push({ text: LINE_BREAK, start: cursor, end: cursor });
        replacement.push(...alignWordsToSegments(row, [{ start: cursor, end: rowEnd }], rowEnd - cursor));
        cursor = rowEnd;
      });
    }
    if (!replacement.length) return;
    updateWords([...words.slice(0, first), ...replacement, ...words.slice(last)]);
    toast.success(autoResync && segments.length ? "แก้ข้อความและรีซิงก์เวลาให้ตรงเสียงพูดแล้ว" : "อัปเดตข้อความบนพรีวิวแล้ว");
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
    (t: number) => (removeSilence && keepSegments.length ? mapToTrimmed(t, keepSegments) : t),
    [removeSilence, keepSegments],
  );

  const exportSrt = () => {
    if (!groups.length) { toast.error("ยังไม่มีซับไตเติล"); return; }
    download(`${baseName()}-captions.srt`, buildSrt(groups, remap), "application/x-subrip");
    play("pop");
    toast.success("ดาวน์โหลด .srt แล้ว — ลากเข้า CapCut ได้เลย");
  };
  const exportEdl = () => {
    if (!keepSegments.length) { toast.error("ยังไม่ได้วิเคราะห์เสียง"); return; }
    download(`${file?.name ?? "clip"}.edl`, buildEdl(keepSegments, file?.name ?? "clip"));
    play("pop");
    toast.success("ดาวน์โหลด .edl (cut list) แล้ว");
  };
  const exportJson = () => {
    if (!keepSegments.length) { toast.error("ยังไม่ได้วิเคราะห์เสียง"); return; }
    download(
      `${file?.name ?? "clip"}.capcut.json`,
      buildCutListJson({
        clipName: file?.name ?? "clip",
        duration,
        keep: keepSegments,
        removed: silences,
        groups,
      }),
      "application/json",
    );
    toast.success("ดาวน์โหลดไฟล์ cut list แล้ว");
  };
  const exportXml = () => {
    if (!keepSegments.length) { toast.error("ยังไม่ได้วิเคราะห์เสียง"); return; }
    const v = videoRef.current;
    download(
      `${baseName()}-timeline.xml`,
      buildFcpxml({
        clipName: file?.name ?? "clip",
        duration,
        keep: keepSegments,
        width: v?.videoWidth || 1080,
        height: v?.videoHeight || 1920,
      }),
      "application/xml",
    );
    toast.success("ดาวน์โหลด .xml (timeline ตัดช่วงเงียบ) แล้ว");
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (v) { v.currentTime = Math.max(0, t); setTime(v.currentTime); }
  };

  const steps: Step[] = [
    {
      key: "tools",
      label: "1 · อัปโหลด",
      hint: file ? file.name : "เลือกไฟล์วิดีโอ/เสียง",
      state: analyzing ? "busy" : file ? "done" : tab === "tools" ? "active" : "todo",
    },
    {
      key: "tools",
      label: "2 · AI ซับ + ตัดเงียบ",
      hint: words.length ? `${words.length} คำ · ตัดออก ${savedSeconds.toFixed(1)}s` : "สร้างซับด้วย AI",
      state: transcribing ? "busy" : words.length ? "done" : file ? "active" : "todo",
    },
    {
      key: "scenes",
      label: "3 · ซีน",
      hint: scenes.length ? `${scenes.length} ซีน · ตัดทิ้ง ${dropped.length}` : "แบ่งคลิปเป็นซีน",
      state: tab === "scenes" ? "active" : scenes.length ? "done" : "todo",
    },
    {
      key: "styles",
      label: "4 · สไตล์",
      hint: style.name,
      state: tab === "styles" || tab === "customize" ? "active" : words.length ? "done" : "todo",
    },
    {
      key: "text",
      label: "5 · แก้คำ",
      hint: accuracy.label,
      state: retryingSync ? "busy" : tab === "text" ? "active" : words.length ? "done" : "todo",
    },
    {
      key: "export",
      label: "6 · ส่งออก",
      hint: rendering ? (job?.label ?? "กำลังเรนเดอร์") : "เรนเดอร์วิดีโอ / CapCut",
      state: rendering ? "busy" : tab === "export" ? "active" : "todo",
    },
  ];

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

      <div className="mx-auto grid max-w-[1500px] gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
        {/* Left: controls */}
        <section className="order-2 rounded-lg border border-border bg-card p-4 sm:p-5 lg:order-1">
          <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1">
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
                {languages[0] === "lo" && (
                  <div className="mt-4 space-y-1.5">
                    <Label className="text-[11px] uppercase text-muted-foreground">ຄຳສັບ / ชื่อเฉพาะภาษาลาว</Label>
                    <Textarea
                      value={glossary}
                      onChange={(event) => setGlossary(event.target.value)}
                      rows={3}
                      placeholder="ใส่ชื่อคน สถานที่ แบรนด์ หรือคำเฉพาะ คั่นด้วย comma หรือขึ้นบรรทัดใหม่"
                    />
                  </div>
                )}
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

              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                <p className="mb-1 text-sm font-medium">ส่งออกวิดีโอสำเร็จรูป (ไม่ต้องใช้ CapCut)</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  ตัดช่วงเงียบ + ฝังซับไตเติลลงในภาพตามสไตล์ที่ตั้งไว้ ได้ไฟล์วิดีโอที่โพสต์ลง TikTok / Reels ได้ทันที
                </p>
                <Button size="sm" onClick={() => void exportFinalVideo()} disabled={rendering || !segments.length}>
                  {rendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  เรนเดอร์วิดีโอพร้อมซับ
                </Button>
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
                lineCount={Math.max(2, previewLineCount)}
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
        <section className="order-1 lg:order-2 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium"><Smartphone className="h-4 w-4" /> TikTok Preview</div>
              <Switch checked={tiktokPreview} onCheckedChange={setTiktokPreview} aria-label="เปิดพรีวิว TikTok" />
            </div>
            <div
              ref={frameRef}
              className={`relative mx-auto w-full overflow-hidden rounded-xl bg-black ${tiktokPreview ? "aspect-[886/1920] max-w-[314px]" : "aspect-[9/16] max-w-[340px]"}`}
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
                  safeArea={tiktokPreview}
                  onPositionChange={({ posX, posY }) => setStyle((current) => ({ ...current, posX, posY }))}
                  onEditText={(text) => editActiveGroupText(text)}
                />
              )}
              {tiktokPreview && <TikTokSafeAreaOverlay />}
            </div>
            {videoUrl && <p className="mt-2 text-center text-xs text-muted-foreground">ลากข้อความเพื่อย้ายตำแหน่ง · ดับเบิลคลิกเพื่อแก้ไข (ขึ้นบรรทัดใหม่ = แยกแถว)</p>}

            <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">รีซิงก์เวลาอัตโนมัติเมื่อแก้ข้อความ</div>
                <Switch checked={autoResync} onCheckedChange={setAutoResync} aria-label="เปิดโหมดรีซิงก์อัตโนมัติ" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">สถานะความแม่นยำ</span>
                <span
                  className={
                    accuracy.tone === "good"
                      ? "rounded-full bg-primary/15 px-2 py-1 font-medium text-primary"
                      : accuracy.tone === "ok"
                        ? "rounded-full bg-secondary px-2 py-1 font-medium text-foreground"
                        : "rounded-full bg-destructive/15 px-2 py-1 font-medium text-destructive"
                  }
                >
                  {accuracy.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                <div className="rounded-md bg-primary/10 p-2">
                  <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-primary" />
                  <div className="font-semibold">{confidenceSummary.high}</div>
                  <div className="text-muted-foreground">มั่นใจสูง</div>
                </div>
                <div className="rounded-md bg-secondary p-2">
                  <AlertTriangle className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                  <div className="font-semibold">{confidenceSummary.review}</div>
                  <div className="text-muted-foreground">ควรฟังตรวจ</div>
                </div>
                <div className="rounded-md bg-destructive/10 p-2">
                  <AlertTriangle className="mx-auto mb-1 h-4 w-4 text-destructive" />
                  <div className="font-semibold">{confidenceSummary.low}</div>
                  <div className="text-muted-foreground">ต้องแก้</div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {confidenceSummary.score === null
                  ? "สร้างซับใหม่เพื่อวัดความมั่นใจจาก transcript และเสียงจริง"
                  : `หลักฐานความมั่นใจรวม ${Math.round(confidenceSummary.score * 100)}% — ใช้สำหรับชี้จุดตรวจ ไม่ใช่การรับประกันความถูกต้องของทุกคำ`}
              </p>
            </div>


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
