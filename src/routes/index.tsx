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
  Maximize2,
  Save,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  AudioLines,
  Clapperboard,
  Type,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  reconcileSegmentsWithWords,
  estimateNoiseFloor,
  refineSpeechSegments,
  smoothSpeechSegments,
  type Segment,
} from "@/lib/media/audio";
import { alignTextToTiming, alignTextToTimingOnTimeline, closeSpeechGaps, forcedAlignWords, mapConcatTimeToTimeline, mergeAlignedChunks } from "@/lib/media/forced-align";
import type { TimedWord } from "@/lib/media/forced-align";
import { exportTrimmedWebm } from "@/lib/media/export-video";
import { exportBurnedVideo, targetSize, type ExportResolution } from "@/lib/media/export-burned";
import { exportWebCodecsVideo, supportsWebCodecsExport } from "@/lib/media/export-webcodecs";


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
import { motionAt } from "@/lib/media/motion";
import { addSceneElement, buildScenes, updateSceneElementFormat, updateSceneElementText, updateSceneElementTiming, type SceneElement, type SceneElementKind } from "@/lib/scenes";
import { ScenesPanel } from "@/components/editor/ScenesPanel";
import { ViralTextOverlay } from "@/components/editor/ViralTextOverlay";

import { AccuracyPanel } from "@/components/editor/AccuracyPanel";
import { GlossaryManager } from "@/components/editor/GlossaryManager";
import { applyRulesToWords, parseGlossaryTerms, type LexRule } from "@/lib/lao-glossary";
import { buildAccuracyReport } from "@/lib/accuracy-report";
import { OneRunLogo } from "@/components/brand/OneRunLogo";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OneRunAI — AI Short Video Editor" },
      {
        name: "description",
        content:
          "ตัดคลิปสั้น สร้างซับไตเติลอัตโนมัติแบบทีละคำ ตัดช่วงเงียบ และส่งออกวิดีโอพร้อมโพสต์ด้วย OneRunAI",
      },
      { property: "og:title", content: "OneRunAI — AI Short Video Editor" },
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

type Tab = "tools" | "styles" | "customize" | "text" | "accuracy" | "scenes" | "audio" | "export";

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
  /** เวลาคำที่ผู้ถอดเสียงวัดมาจริง (Scribe) บนไทม์ไลน์ต้นฉบับ */
  const measuredTimingRef = useRef<TimedWord[]>([]);
  /** ช่วงพูดดิบจาก energy analysis — ใช้เป็น input ของการถอดเสียงเสมอ
   *  (แยกจาก state `segments` ที่ถูก reconcile ด้วยเวลาคำแล้วสำหรับการตัดจริง)
   *  ถ้าปนกัน การกด "สร้างซับด้วย AI" ซ้ำจะสร้าง chunk จากช่วงที่ถูกขยาย/รวมไปแล้ว
   *  ทำให้บริบทที่ส่งเข้าโมเดลเพี้ยนและความแม่นยำตก */
  const analysisSegmentsRef = useRef<Segment[]>([]);
  /** งานวิเคราะห์เสียงที่กำลังทำอยู่ของไฟล์ล่าสุด — ปุ่มถอดเสียงต้องรอให้เสร็จก่อน */
  const analysisPromiseRef = useRef<Promise<unknown> | null>(null);
  /** ระดับเสียงรบกวนพื้นหลังของคลิป ใช้เป็น threshold ของ noise gate ตอน export */
  const noiseFloorRef = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [frameHeight, setFrameHeight] = useState(0);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [transcript, setTranscript] = useState("");
  const [glossary, setGlossary] = useState("");
  const [lexRules, setLexRules] = useState<LexRule[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(baseStyle);
  const [tab, setTab] = useState<Tab>("tools");
  const [languages, setLanguages] = useState<LangCode[]>(["th"]);


  const [captionsOn, setCaptionsOn] = useState(true);
  const [removeSilence, setRemoveSilence] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [resolution, setResolution] = useState<ExportResolution>("source");
  const [tiktokPreview, setTiktokPreview] = useState(false);
  const [autoResync, setAutoResync] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);
  const [sfx, setSfx] = useState<{ enabled: boolean; volume: number; pack: SoundPack }>({ enabled: true, volume: 0.35, pack: "clean" });
  const [savedInfo, setSavedInfo] = useState<{ savedAt: number; fileName: string } | null>(null);
  const [projectName, setProjectName] = useState("Untitled short");
  const [sceneElements, setSceneElements] = useState<SceneElement[]>([]);
  const [muted, setMuted] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const restoredProjectRef = useRef(false);
  const lastSoundGroupRef = useRef<number>(-1);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("onerunai-theme");
    const useDark = storedTheme !== "light";
    setDarkMode(useDark);
    document.documentElement.classList.toggle("dark", useDark);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("onerunai-theme", next ? "dark" : "light");
  };

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
  const outputSegments = useMemo(() => {
    if (removeSilence) return keepSegments;
    if (!duration) return [];
    const ranges = [...droppedRanges].sort((a, b) => a.start - b.start);
    return invertSegments(ranges, duration);
  }, [removeSilence, keepSegments, droppedRanges, duration]);
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
  // งาน B: พรีวิว motion จริงบนวิดีโอ ใช้สูตรเดียวกับตอน export
  const previewMotion = useMemo(
    () => motionAt(time, scenes, sceneElements),
    [time, scenes, sceneElements],
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

  // สถานะจริงของหน้าตัดต่อ ให้ชุดทดสอบ regression (guard:lao) อ่านผ่านเบราว์เซอร์ได้
  useEffect(() => {
    (window as unknown as { __shortcutState?: unknown }).__shortcutState = {
      words: visibleWords,
      groups,
      style,
      duration,
      transcribing,
      analyzing,
      segmentCount: segments.length,
      segments,
      speechSegments: analysisSegmentsRef.current,
    };
  }, [visibleWords, groups, style, duration, transcribing, analyzing, segments]);


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
        analysisSegmentsRef.current = segs;
        noiseFloorRef.current = estimateNoiseFloor(buffer);
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
    // ไฟล์ใหม่ต้องไม่ใช้ผลวิเคราะห์ของไฟล์เก่า ไม่งั้นการกดถอดเสียงทันที
    // จะได้ช่วงพูดของคลิปก่อนหน้า → ซับออกมาไม่ครบ
    analysisSegmentsRef.current = [];
    measuredTimingRef.current = [];
    setFile(f);
    setVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    const preserveRestored = restoredProjectRef.current;
    restoredProjectRef.current = false;
    if (!preserveRestored) {
      setWords([]);
      setTranscript("");
      setSegments([]);
      setDropped([]);
      setSceneElements([]);
      setProjectName(f.name.replace(/\.[^.]+$/, ""));
    }
    setTime(0);
    if (preserveRestored) { analysisPromiseRef.current = null; return; }
    const pending = analyze(f, threshold, minSilence).catch(() => undefined);
    analysisPromiseRef.current = pending;
    const r = await pending;
    if (analysisPromiseRef.current === pending) analysisPromiseRef.current = null;
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
      lexRules,
      style,
      languages,
      threshold,
      minSilence,
      noiseReduction,
      dropped,
      sceneElements,
      projectName,
      sfx,
    }),
    [file, duration, segments, words, transcript, glossary, lexRules, style, languages, threshold, minSilence, noiseReduction, dropped, sceneElements, projectName, sfx],
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
    setLexRules(p.lexRules ?? []);
    setStyle(p.style);
    setLanguages((p.languages as LangCode[]).length ? (p.languages as LangCode[]) : ["th"]);
    setThreshold(p.threshold);
    setMinSilence(p.minSilence);
    setNoiseReduction(p.noiseReduction ?? false);
    setDropped(p.dropped ?? []);
    setSceneElements(p.sceneElements ?? []);
    setProjectName(p.projectName ?? p.fileName.replace(/\.[^.]+$/, ""));
    restoredProjectRef.current = true;
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
      // ถ้าไฟล์ยังวิเคราะห์ไม่เสร็จ ต้องรอให้เสร็จก่อน ไม่งั้นจะถอดเสียงจาก
      // ช่วงพูดที่ยังไม่ครบ (หรือของไฟล์ก่อนหน้า) แล้วซับออกมาไม่ครบ
      if (analysisPromiseRef.current) await analysisPromiseRef.current.catch(() => undefined);
      let buffer = audioBufferRef.current;
      // ใช้ช่วงพูดดิบเสมอ ไม่ใช่ช่วงที่ reconcile แล้ว เพื่อไม่ให้การถอดเสียงรอบถัดไปเพี้ยน
      let segs = analysisSegmentsRef.current.length ? analysisSegmentsRef.current : [];
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
      // เก็บเวลาคำที่วัดได้จริง (Scribe) บนไทม์ไลน์ต้นฉบับ ไว้ใช้ตอนแก้ข้อความ
      const measured: TimedWord[] = [];

      /** ถอดเสียงหนึ่ง chunk พร้อมลองซ้ำอัตโนมัติ (ห้ามปล่อยให้ช่วงไหนหายเงียบ ๆ) */
      const transcribeChunk = async (chunkSegs: Segment[], attempts: number) => {
        const wav = encodeSegmentsWav16k(buffer!, chunkSegs, false);
        if (wav.size < 4096) return { skipped: true as const };
        const b64 = await blobToBase64(wav);
        const terms = parseGlossaryTerms(glossary);
        let lastError: unknown = null;
        for (let attempt = 0; attempt < attempts; attempt++) {
          try {
            const res = await transcribe({
              data: { audioBase64: b64, language: lang, context: texts.join(" ").slice(-600), glossary: terms },
            });
            const text = (res.text ?? "").trim();
            if (!text) { lastError = new Error("empty"); continue; }
            const chunkDur = chunkSegs.reduce((n, s) => n + (s.end - s.start), 0);
            for (const word of res.words ?? []) {
              const start = mapConcatTimeToTimeline(word.start, chunkSegs);
              measured.push({ text: word.text, start, end: Math.max(start + 0.06, mapConcatTimeToTimeline(word.end, chunkSegs)) });
            }
            const timed = alignTextToTimingOnTimeline(text, res.words ?? [], chunkSegs);
            const aligned = (timed ?? forcedAlignWords(buffer!, chunkSegs, text, chunkDur)).map((word) => {
              const acoustic = word.confidence ?? 0.5;
              const confidence = Math.max(0.15, Math.min(0.99, acoustic * 0.62 + res.agreement * 0.38));
              return { ...word, confidence, confidenceLabel: confidence >= 0.78 ? "high" as const : confidence >= 0.52 ? "review" as const : "low" as const };
            });
            return { skipped: false as const, text, aligned };
          } catch (error) {
            lastError = error;
          }
        }
        return { failed: true as const, error: lastError };
      };

      if (chunks.length) {
        const missing: Segment[][] = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunkSegs = chunks[i]!;
          const out = await transcribeChunk(chunkSegs, 2);
          if ("skipped" in out && out.skipped) continue;
          if ("failed" in out) { missing.push(chunkSegs); continue; }
          texts.push(out.text);
          const merged = mergeAlignedChunks(allWords, out.aligned);
          allWords.splice(0, allWords.length, ...merged);

          setTranscript(texts.join(" "));
          setWords([...allWords]);
        }

        // ด่านสุดท้าย: ช่วงไหนยังไม่มีคำ ให้ลองใหม่อีกครั้งก่อนแสดงผล
        const stillMissing: Segment[][] = [];
        for (const chunkSegs of missing) {
          const out = await transcribeChunk(chunkSegs, 1);
          if ("skipped" in out && out.skipped) continue;
          if ("failed" in out) { stillMissing.push(chunkSegs); continue; }
          texts.push(out.text);
          allWords.push(...out.aligned);
          allWords.sort((a, b) => a.start - b.start);
          setWords([...allWords]);
        }
        if (stillMissing.length) {
          const ranges = stillMissing
            .map((segs2) => `${(segs2[0]?.start ?? 0).toFixed(1)}–${(segs2[segs2.length - 1]?.end ?? 0).toFixed(1)} วิ`)
            .join(", ");
          toast.error(`ถอดเสียงไม่สำเร็จ ${stillMissing.length} ช่วง (${ranges}) — กด "สร้างซับด้วย AI" อีกครั้งเพื่อลองช่วงที่ขาด`);
        }
      } else {



        const wav = encodeWav16k(buffer);
        if (wav.size < 4096) throw new Error("ไฟล์เสียงสั้นเกินไป");
        const b64 = await blobToBase64(wav);
        const res = await transcribe({ data: { audioBase64: b64, language: lang, glossary: parseGlossaryTerms(glossary) } });
        const text = (res.text ?? "").trim();
        if (text) {
          texts.push(text);
          for (const word of res.words ?? []) {
            const start = mapConcatTimeToTimeline(word.start, segs);
            measured.push({ text: word.text, start, end: Math.max(start + 0.06, mapConcatTimeToTimeline(word.end, segs)) });
          }
          allWords.push(
            ...(alignTextToTimingOnTimeline(text, res.words ?? [], segs)
              ?? forcedAlignWords(buffer!, segs, text, buffer!.duration)),
          );
        }
      }

      measuredTimingRef.current = measured.sort((a, b) => a.start - b.start);
      if (!allWords.length) throw new Error("ไม่พบคำพูดในคลิป");
      // ปิดช่องว่างที่ยังมีเสียงพูดจริง (เกิดที่รอยต่อ chunk: คำครบแต่เวลาหดเข้าใน)
      allWords.splice(0, allWords.length, ...closeSpeechGaps(allWords, segs));
      // งาน A: ใช้เวลาคำจริงขยายขอบช่วงพูด ไม่ให้ energy gate ตัดพยางค์ต้น/ท้ายขาด

      const timingForCuts = measured.length ? measured : allWords;
      const reconciled = reconcileSegmentsWithWords(segs, timingForCuts, { duration: buffer.duration });
      if (reconciled.length) setSegments(reconciled);
      const ruled = applyRulesToWords(allWords, lexRules);
      if (ruled.changed) setLexRules(ruled.rules);
      setTranscript(wordsToTranscript(ruled.words));
      setWords(ruled.words);
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
    const lowConfidence = words.flatMap((word, index) => word.confidenceLabel === "low"
      ? [{ index, start: word.start, end: word.end, reason: "ความมั่นใจต่ำ" }]
      : []);
    if (!issues.length && !lowConfidence.length) { toast.success("เวลาซับเรียงต่อเนื่องดี ไม่พบจุดผิดปกติ"); return; }
    setRetryingSync(true);
    const id = toast.loading(`กำลังลองใหม่ ${new Set([...issues, ...lowConfidence].map((issue) => issue.index)).size} ช่วง…`);
    try {
      let next = [...words];
      const queue = [...issues, ...lowConfidence].filter((issue, index, all) => all.findIndex((candidate) => candidate.index === issue.index) === index);
      for (const issue of queue.slice(0, 12)) {
        const old = next[issue.index];
        if (!old) continue;
        const region = { start: Math.max(0, old.start - 0.45), end: Math.min(duration, old.end + 0.45) };
        const wav = encodeSegmentsWav16k(audioBufferRef.current, [region]);
        if (wav.size < 2048) continue;
        const localContext = next.slice(Math.max(0, issue.index - 5), issue.index).map((word) => word.text).join(" ");
        const terms = parseGlossaryTerms(glossary);
        const res = await transcribe({ data: { audioBase64: await blobToBase64(wav), language: languages[0] ?? "th", context: localContext, glossary: terms } });
        const replacementText = res.text ?? old.text;
        const replacements = alignTextToTimingOnTimeline(replacementText, res.words ?? [], [region])
          ?? forcedAlignWords(audioBufferRef.current, [region], replacementText, region.end - region.start);
        if (replacements.length) next = [...next.slice(0, issue.index), ...replacements, ...next.slice(issue.index + 1)];
      }
      next.sort((a, b) => a.start - b.start);
      setWords(next);
      setTranscript(wordsToTranscript(next));
      toast.success(`ตรวจและซิงก์ใหม่ ${Math.min(queue.length, 12)} ช่วงแล้ว`, { id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ตรวจซิงก์ไม่สำเร็จ", { id });
    } finally {
      setRetryingSync(false);
    }
  };

  /** ถอดเสียงใหม่เฉพาะช่วงเวลาที่เลือก แทนการถอดใหม่ทั้งไฟล์ */
  const retranscribeRange = async (start: number, end: number) => {
    const buffer = audioBufferRef.current;
    if (!buffer) { toast.error("อัปโหลดคลิปก่อนถอดเสียงใหม่"); return; }
    const region = { start: Math.max(0, start - 0.2), end: Math.min(duration || buffer.duration, end + 0.2) };
    if (region.end - region.start < 0.25) { toast.error("ช่วงสั้นเกินไป"); return; }
    setRetryingSync(true);
    const id = toast.loading(`กำลังถอดเสียงใหม่ ${region.start.toFixed(1)}s – ${region.end.toFixed(1)}s…`);
    try {
      const wav = encodeSegmentsWav16k(buffer, [region], false);
      if (wav.size < 2048) throw new Error("เสียงในช่วงนี้น้อยเกินไป");
      const before = words.filter((word) => word.end <= region.start);
      const after = words.filter((word) => word.start >= region.end);
      const context = before.slice(-8).map((word) => word.text).join(" ");
      const res = await transcribe({
        data: {
          audioBase64: await blobToBase64(wav),
          language: languages[0] ?? "th",
          context,
          glossary: parseGlossaryTerms(glossary),
        },
      });
      const text = (res.text ?? "").trim();
      if (!text) throw new Error("ไม่พบคำพูดในช่วงนี้");
      const timed = alignTextToTimingOnTimeline(text, res.words ?? [], [region]);
      const aligned = (timed ?? forcedAlignWords(buffer, [region], text, region.end - region.start)).map((word) => {
        const acoustic = word.confidence ?? 0.5;
        const confidence = Math.max(0.15, Math.min(0.99, acoustic * 0.62 + res.agreement * 0.38));
        return { ...word, confidence, confidenceLabel: confidence >= 0.78 ? "high" as const : confidence >= 0.52 ? "review" as const : "low" as const };
      });
      const ruled = applyRulesToWords([...before, ...aligned, ...after].sort((a, b) => a.start - b.start), lexRules);
      if (ruled.changed) setLexRules(ruled.rules);
      setWords(ruled.words);
      setTranscript(wordsToTranscript(ruled.words));
      toast.success(`ถอดเสียงใหม่ ${aligned.length} คำในช่วงนี้แล้ว`, { id });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ถอดเสียงใหม่ไม่สำเร็จ", { id });
    } finally {
      setRetryingSync(false);
    }
  };

  /** ถอดใหม่ทุกช่วงที่ความมั่นใจต่ำหรือ alignment เพี้ยน */
  const retranscribeWeakSpots = async () => {
    const report = buildAccuracyReport(words, segments, duration, languages[0] ?? "th");
    const weak = report.spans.filter((span) => span.low > 0 || span.review > 1).slice(0, 8);
    if (!weak.length) { toast.success("ไม่พบช่วงที่ต้องถอดใหม่"); return; }
    for (const span of weak) await retranscribeRange(span.start, span.end);
    toast.success(`ถอดใหม่ ${weak.length} ช่วงที่อ่อนแล้ว`);
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
      const blob = await exportTrimmedWebm(videoUrl, [...outputSegments], onProgress, {
        noiseReduction,
        noiseFloor: noiseFloorRef.current,
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
    const webCodecs = supportsWebCodecsExport();
    if (!webCodecs) {
      toast.warning("เบราว์เซอร์นี้ไม่รองรับ WebCodecs กำลังใช้โหมดสำรอง (อาจกระตุก) แนะนำ Chrome หรือ Edge");
    } else if (resolution === "4k") {
      toast.info("4K จะใช้เวลาเรนเดอร์นานกว่ามาก แต่ไฟล์ที่ได้จะเดินเฟรมครบ ไม่กระตุก");
    }
    void runJob("เรนเดอร์วิดีโอพร้อมซับ", async (signal, onProgress) => {
      const shared = {
        noiseReduction,
        noiseFloor: noiseFloorRef.current,
        smoothCuts: true,
        captions: captionsOn,
        signal,
        scenes,
        sceneElements,
        resolution,
      };
      const seconds = outputSegments.reduce((n, s) => n + (s.end - s.start), 0);

      if (webCodecs) {
        const result = await exportWebCodecsVideo(videoUrl, [...outputSegments], [...groups], style, onProgress, shared);
        if (signal.aborted) return;
        console.info("[export-webcodecs] completed", result);
        saveBlob(result.blob, `${baseName()}-final.${result.ext}`);
        toast.success(
          `ได้วิดีโอพร้อมโพสต์แล้ว ${result.width}x${result.height} · ${result.fps}fps · ${result.frames} เฟรม`,
        );
        return;
      }

      const { blob, ext, width, height, fps, plannedFps, fpsAdapted, frames, chunks, expectedDuration, segments: exportDiagnostics } = await exportBurnedVideo(
        videoUrl,
        [...outputSegments],
        [...groups],
        style,
        onProgress,
        shared,
      );
      if (signal.aborted) return;
      console.info("[export-burned] completed", {
        expectedDuration,
        chunks,
        frames,
        fps,
        plannedFps,
        segments: exportDiagnostics,
      });
      const durationDelta = Math.abs(exportDiagnostics.reduce((sum, segment) => sum + segment.played, 0) - expectedDuration);
      if (durationDelta > Math.max(0.12, 2 / fps)) {
        throw new Error(`วิดีโอเล่นช่วงที่เลือกไม่ครบ (คลาดเคลื่อน ${durationDelta.toFixed(2)} วินาที)`);
      }
      saveBlob(blob, `${baseName()}-final.${ext}`);
      const realFps = seconds > 0 ? frames / seconds : fps;
      toast.success(`ได้วิดีโอพร้อมโพสต์แล้ว ${width}x${height} · ~${realFps.toFixed(0)}fps`);
      if (fpsAdapted) {
        toast.warning(`เครื่องนี้เรนเดอร์ ${width}x${height} ได้ไม่ถึง ${plannedFps}fps จึงปรับเป็น ${fps}fps อัตโนมัติ`);
      }
    });
  };


  const exportCapCutPackage = () => {
    if (!videoUrl || !keepSegments.length || !groups.length) { toast.error("ต้องมีวิดีโอ ช่วงตัด และซับก่อน"); return; }
    void runJob("สร้าง CapCut Package", async (signal, onProgress) => {
      const video = await exportTrimmedWebm(videoUrl, [...outputSegments], (r) => onProgress(r * 0.9), {
        noiseReduction,
        noiseFloor: noiseFloorRef.current,
        smoothCuts: true,
        signal,
      });
      if (signal.aborted) return;
      const bundle = await buildCapCutPackage({
        baseName: baseName(),
        video,
        duration,
        keep: [...outputSegments],
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
    const timed = alignTextToTiming(transcript, measuredTimingRef.current);
    setWords(
      timed
        ?? (audioBufferRef.current
          ? forcedAlignWords(audioBufferRef.current, segments, transcript, duration)
          : alignWordsToSegments(transcript, segments, duration)),
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
    (t: number) => (outputSegments.length ? mapToTrimmed(t, outputSegments) : t),
    [outputSegments],
  );

  const exportSrt = () => {
    if (!groups.length) { toast.error("ยังไม่มีซับไตเติล"); return; }
    download(`${baseName()}-captions.srt`, buildSrt(groups, remap), "application/x-subrip");
    play("pop");
    toast.success("ดาวน์โหลด .srt แล้ว — ลากเข้า CapCut ได้เลย");
  };
  const exportEdl = () => {
    if (!keepSegments.length) { toast.error("ยังไม่ได้วิเคราะห์เสียง"); return; }
    download(`${file?.name ?? "clip"}.edl`, buildEdl(outputSegments, file?.name ?? "clip"));
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
        keep: outputSegments,
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
        keep: outputSegments,
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

  const saveNow = () => {
    saveProject(snapshot());
    setSavedInfo(loadProject());
    toast.success("บันทึกงานแล้ว");
  };

  const toggleSceneElement = (id: string) => {
    setSceneElements((current) => current.map((element) => element.id === id ? { ...element, enabled: !element.enabled } : element));
  };

  const updateElementText = (id: string, text: string) => {
    setSceneElements((current) => updateSceneElementText(current, id, text));
  };

  const updateElementTiming = (id: string, offset: number, durationSec: number) => {
    setSceneElements((current) => updateSceneElementTiming(current, id, offset, durationSec));
  };

  const updateElementFormat = (id: string, patch: { bold?: boolean; italic?: boolean }) => {
    setSceneElements((current) => updateSceneElementFormat(current, id, patch));
  };


  const addElement = (sceneId: string, kind: SceneElementKind) => {
    setSceneElements((current) => addSceneElement(current, sceneId, kind));
  };


  return (
    <main className="studio-shell min-h-screen overflow-hidden bg-background text-foreground">
      <div className="orbit-decoration pointer-events-none absolute -right-32 top-24 -z-10 h-72 w-[32rem] opacity-60" aria-hidden="true" />
      <header className="studio-header sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <OneRunLogo className="shrink-0" />
          <div className="hidden h-8 w-px bg-border sm:block" />
          <div className="min-w-[140px] max-w-[280px] flex-1">
            <h1 className="sr-only">OneRunAI Short Video Editor</h1>
            <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="ชื่อโปรเจกต์" className="h-8 border-transparent bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:border-input sm:text-base" />
            <p className="hidden px-1 text-xs text-muted-foreground sm:block">AI short video workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickFile(f);
              }}
            />
          </span>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="hidden sm:inline-flex">
            <Upload className="mr-2 h-4 w-4" /> อัปโหลดคลิป
          </Button>
          <Button variant="secondary" onClick={saveNow} className="hidden md:inline-flex">
            <Save className="mr-2 h-4 w-4" /> บันทึก
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={darkMode ? "ใช้โหมดสว่าง" : "ใช้โหมดมืด"} title={darkMode ? "ใช้โหมดสว่าง" : "ใช้โหมดมืด"}>
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button onClick={() => setTab("export")}>
            <Download className="mr-2 h-4 w-4" /> ส่งออก
          </Button>
        </div>
      </header>

      {job && (
        <div className="mx-auto max-w-[1500px] px-4 pt-4 sm:px-6">
          <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="truncate">{job.label}</span>
                <span>{Math.round((job.ratio ?? 0) * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary transition-all" style={{ width: `${(job.ratio ?? 0) * 100}%` }} />
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={cancelJob}>
              ยกเลิก
            </Button>
          </div>
        </div>
      )}


      <div className="mx-auto grid min-w-0 max-w-[1500px] gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
        {/* Left: controls */}
        <section className="studio-panel order-2 min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 lg:order-1">
          <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1">
            {(
              [
                ["tools", "คำบรรยาย"],
                ["scenes", "Scenes"],
                ["styles", "Caption Style"],
                ["customize", "Customize"],
                ["text", "Edit Text"],
                ["accuracy", "Accuracy"],
                ["audio", "Audio"],
                ["export", "Export"],
              ] as [Tab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setTab(key); play("hover"); }}
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  tab === key ? "bg-card text-foreground shadow-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "tools" && (
            <div className="space-y-8">
              <nav className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="ทางลัดเครื่องมือตัดต่อ">
                <Button
                  variant="outline"
                  onClick={() => setTab("tools")}
                  className="h-24 flex-col gap-2 border-primary/50 bg-primary/5 px-2 text-primary shadow-primary sm:h-28"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15"><Captions className="h-5 w-5" /></span>
                  <span className="text-xs font-semibold text-foreground sm:text-sm">คำบรรยาย</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setTab("scenes")}
                  className="h-24 flex-col gap-2 border-border bg-card px-2 hover:border-primary/50 hover:bg-primary/5 sm:h-28"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Clapperboard className="h-5 w-5" /></span>
                  <span className="text-xs font-semibold sm:text-sm">แก้ซีน</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setTab("export")}
                  className="h-24 flex-col gap-2 border-border bg-card px-2 hover:border-primary/50 hover:bg-primary/5 sm:h-28"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Scissors className="h-5 w-5" /></span>
                  <span className="text-xs font-semibold sm:text-sm">ตัดวิดีโอ</span>
                </Button>
              </nav>

              <section aria-labelledby="ai-tools-heading">
                <div className="mb-1">
                  <h2 id="ai-tools-heading" className="text-base font-bold text-foreground">เครื่องมือ AI</h2>
                </div>

                <div className="divide-y divide-border">
                  <div className="py-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Captions className="h-5 w-5" /></span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">AI Captions</p>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">ถอดเสียงและสร้างซับอัตโนมัติ ปรับได้ทีละคำ</p>
                        </div>
                      </div>
                      <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                        <Button size="sm" onClick={runTranscribe} disabled={transcribing || !file || analyzing}>
                          {transcribing || analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                          สร้างซับด้วย AI
                        </Button>
                        {analyzing ? <span className="text-xs text-muted-foreground">กำลังเตรียมไฟล์เสียง…</span> : null}

                        <Button size="sm" variant="outline" onClick={() => setTab("styles")}>สไตล์</Button>
                        <Button size="sm" variant="ghost" onClick={() => setTab("text")}>แก้ไข</Button>
                      </div>
                      <Switch className="col-start-2 row-start-1 sm:col-start-3" checked={captionsOn} onCheckedChange={setCaptionsOn} aria-label="เปิดคำบรรยาย" />
                    </div>

                    <div className="mt-4 ml-0 border-l-2 border-primary/20 pl-3 sm:ml-12">
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
                      {languages[0] === "lo" && (
                        <div className="mt-3 max-w-xl space-y-1.5">
                          <Label className="text-[11px] uppercase text-muted-foreground">ຄຳສັບ / ชื่อเฉพาะภาษาลาว</Label>
                          <Textarea value={glossary} onChange={(event) => setGlossary(event.target.value)} rows={3} placeholder="ใส่ชื่อคน สถานที่ แบรนด์ หรือคำเฉพาะ คั่นด้วย comma หรือขึ้นบรรทัดใหม่" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Type className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Viral Text</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">เพิ่มข้อความดึงดูดสายตาในแต่ละซีน</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setTab("scenes")}>แก้ไข</Button>
                  </div>

                  <div className="py-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><AudioLines className="h-5 w-5" /></span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">เสียงประกอบ</p>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">เพิ่มจังหวะเสียงให้ข้อความและการเปลี่ยนซีน</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setTab("audio")}>แก้ไข</Button>
                      <Switch checked={sfx.enabled} onCheckedChange={(enabled) => setSfx((current) => ({ ...current, enabled }))} aria-label="เปิดเสียงประกอบ" />
                    </div>
                    <div className="mt-4 ml-0 space-y-2 border-l-2 border-primary/20 pl-3 sm:ml-12">
                      <Label className="flex justify-between text-xs text-muted-foreground"><span>ระดับเสียงประกอบ</span><span className="font-mono text-foreground">{Math.round(sfx.volume * 100)}%</span></Label>
                      <Slider value={[sfx.volume * 100]} min={0} max={100} step={5} onValueChange={([volume]) => setSfx((current) => ({ ...current, volume: (volume ?? 35) / 100 }))} />
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Zap className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Motion Graphic</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">เพิ่มองค์ประกอบเคลื่อนไหวให้ซีน</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setTab("scenes")}>แก้ไข</Button>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Clapperboard className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">B-roll</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">เพิ่มภาพประกอบให้แต่ละช่วงของวิดีโอ</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setTab("scenes")}>แก้ไข</Button>
                  </div>
                </div>
              </section>

              <section className="border-t border-border pt-6" aria-labelledby="video-tools-heading">
                <div className="mb-1">
                  <h2 id="video-tools-heading" className="text-base font-bold text-foreground">ปรับแต่งวิดีโอ</h2>
                </div>
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Waves className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">ลดเสียงรบกวน</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">กรองเสียงต่ำ เสียงฮัม และปรับระดับเสียงพูดให้นิ่งขึ้น</p>
                      </div>
                    </div>
                    <Switch checked={noiseReduction} onCheckedChange={setNoiseReduction} aria-label="ลดเสียงรบกวน" />
                  </div>

                  <div className="py-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Scissors className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">ตัดช่วงเงียบ</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">ลบ dead-air ออกจากวิดีโออัตโนมัติ</p>
                      </div>
                    </div>
                    <Button className="col-span-2 row-start-2 justify-self-start sm:col-span-1 sm:col-start-2 sm:row-start-1" size="sm" variant="outline" disabled={!file || analyzing} onClick={() => file && void analyze(file, threshold, minSilence)}>
                      {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : null} ปรับค่า
                    </Button>
                    <Switch className="col-start-2 row-start-1 sm:col-start-3" checked={removeSilence} onCheckedChange={setRemoveSilence} aria-label="ตัดช่วงเงียบ" />
                  </div>
                  <div className="mt-5 ml-0 grid gap-5 border-l-2 border-primary/20 pl-3 sm:ml-12">
                    <div className="space-y-2">
                      <Label className="flex justify-between text-xs text-muted-foreground"><span>ความไวเสียง</span><span className="font-mono text-foreground">{threshold} dB</span></Label>
                      <Slider value={[threshold]} min={-60} max={-15} step={1} onValueChange={([v]) => setThreshold(v ?? -34)} onValueCommit={() => file && void analyze(file, threshold, minSilence)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex justify-between text-xs text-muted-foreground"><span>ช่วงเงียบขั้นต่ำ</span><span className="font-mono text-foreground">{minSilence.toFixed(2)}s</span></Label>
                      <Slider value={[minSilence]} min={0.1} max={1.5} step={0.05} onValueChange={([v]) => setMinSilence(v ?? 0.35)} onValueCommit={() => file && void analyze(file, threshold, minSilence)} />
                    </div>
                    <p className="text-xs text-muted-foreground">ตัดออกได้ {savedSeconds.toFixed(1)}s · เหลือ {keptDuration(segments).toFixed(1)}s</p>
                  </div>
                  </div>
                </div>
              </section>

              <section className="border-t border-border pt-6" aria-labelledby="caption-actions-heading">
                <h2 id="caption-actions-heading" className="mb-4 text-sm font-semibold text-foreground">ภาษาและการแปล</h2>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Wand2 className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">แปลซับด้วย AI</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">แปลข้อความโดยคงจังหวะเวลาเดิม</p>
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-2">
                    {words.length ? LANGUAGES.map((language) => (
                      <Button key={language.code} aria-label={`แปลเป็น ${language.label}`} size="sm" variant="outline" disabled={translating || !words.length} onClick={() => void translateCaptions(language.code)}>
                        {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} แปลเป็น {language.label}
                      </Button>
                    )) : <span className="text-xs text-muted-foreground">สร้างซับก่อนเลือกภาษาแปล</span>}
                  </div>
                </div>
              </section>

              <section className="border-t border-border pt-4" aria-labelledby="saved-work-heading">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground"><Save className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <h2 id="saved-work-heading" className="text-sm font-semibold">งานที่บันทึกไว้</h2>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{savedInfo ? `บันทึกล่าสุด: ${savedInfo.fileName} · ${new Date(savedInfo.savedAt).toLocaleString()}` : "ระบบบันทึกช่วงที่ตัดและซับที่แก้ให้อัตโนมัติ"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => { saveProject(snapshot()); setSavedInfo(loadProject()); toast.success("บันทึกงานแล้ว"); }}>บันทึกตอนนี้</Button>
                      <Button size="sm" variant="outline" onClick={restoreProject}>โหลดงานกลับ</Button>
                      <Button size="sm" variant="ghost" onClick={() => { clearProject(); setSavedInfo(null); toast.success("ลบงานที่บันทึกแล้ว"); }}>ล้างงานที่บันทึก</Button>
                    </div>
                  </div>
                </div>
              </section>

              <Button variant="secondary" className="w-full" onClick={() => setTab("export")}>
                <Download className="h-4 w-4" /> ไปที่หน้า Export
              </Button>
            </div>
          )}

          {tab === "scenes" && (
            <ScenesPanel
              scenes={scenes}
              dropped={dropped}
              activeTime={time}
              onSeek={seekTo}
              onPreview={previewRange}
              onToggle={(id, keep) =>
                setDropped((current) => (keep ? current.filter((x) => x !== id) : [...current, id]))
              }
              elements={sceneElements}
              onAddElement={addElement}
              onToggleElement={toggleSceneElement}
              onUpdateElementText={updateElementText}
              onUpdateElementTiming={updateElementTiming}
              onUpdateElementFormat={updateElementFormat}
            />
          )}

          {tab === "export" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs">
                พร้อมส่งออก: {keepSegments.length} ช่วง · ความยาวสุดท้าย {keptDuration(keepSegments).toFixed(1)}s ·
                ตัดออก {savedSeconds.toFixed(1)}s · ซับ {groups.length} บล็อก
              </div>

              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                <p className="mb-1 text-sm font-medium">ส่งออกวิดีโอสำเร็จรูป (ไม่ต้องใช้ CapCut)</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  ตัดช่วงเงียบ + ซีนที่ปิดไว้ แล้วฝังซับลงในภาพตามสไตล์ปัจจุบัน โพสต์ลง TikTok / Reels ได้ทันที
                </p>
                <div className="mb-3 space-y-2">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">ความละเอียดที่ส่งออก</Label>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { id: "source", label: "ต้นฉบับ" },
                      { id: "4k", label: "4K (ไม่แนะนำ)" },
                      { id: "1080", label: "1080 (HD)" },
                      { id: "720", label: "720" },
                    ] as { id: ExportResolution; label: string }[]).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setResolution(option.id);
                          const v = videoRef.current;
                          if (v?.videoWidth) {
                            const t = targetSize(v.videoWidth, v.videoHeight, option.id);
                            if (t.upscaled) {
                              toast.warning(`ต้นฉบับ ${v.videoWidth}x${v.videoHeight} เล็กกว่า ${t.width}x${t.height} — เป็นการขยายภาพ (upscale) ไม่ได้เพิ่มรายละเอียดจริง`);
                            }
                          }
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs transition",
                          resolution === option.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-secondary text-muted-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ใช้ได้เฉพาะปุ่ม "เรนเดอร์วิดีโอพร้อมซับ" (เรนเดอร์ผ่าน canvas) — ไฟล์ .webm ตัดช่วงเงียบและ CapCut Package ยังใช้ความละเอียดต้นฉบับ
                  </p>
                  {resolution === "4k" ? (
                    <p className="text-[11px] text-amber-500">
                      จากการทดสอบจริง เครื่องส่วนใหญ่เรนเดอร์ 4K ผ่านเบราว์เซอร์ได้เพียง ~6–12fps ระบบจะลด fps ให้อัตโนมัติเพื่อให้ภาพเดินสม่ำเสมอแทนที่จะเฟรมหลุดเป็นช่วง ๆ แนะนำให้ใช้ 1080 สำหรับงานจริง
                    </p>
                  ) : null}

                </div>
                <Button size="sm" onClick={exportFinalVideo} disabled={rendering || !keepSegments.length}>
                  {rendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  เรนเดอร์วิดีโอพร้อมซับ
                </Button>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="mb-1 text-sm font-medium">ส่งออกเข้า CapCut / โปรแกรมตัดต่อ</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  ดาวน์โหลดแพ็กเกจเดียวที่มีวิดีโอตัดช่วงเงียบ + SRT ซึ่งใช้ไทม์ไลน์เดียวกัน แล้ว Import ทั้งสองไฟล์เข้า CapCut
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={exportCapCutPackage} disabled={rendering || !keepSegments.length || !groups.length}>
                    {rendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    CapCut Package .zip
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportSrt}>
                    <FileDown className="mr-2 h-4 w-4" /> .srt
                  </Button>
                  <Button size="sm" onClick={exportTrimmedVideo} disabled={rendering || !keepSegments.length}>
                    {rendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    วิดีโอตัดช่วงเงียบ .webm
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportXml}>
                    <FileDown className="mr-2 h-4 w-4" /> .xml
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
              activeStyle={style}
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

          {tab === "accuracy" && (
            <div className="space-y-8">
              <AccuracyPanel
                words={words}
                segments={segments}
                duration={duration}
                language={languages[0] ?? "th"}
                busy={retryingSync}
                onPreview={previewRange}
                onRetranscribe={(start, end) => void retranscribeRange(start, end)}
                onRetranscribeAllWeak={() => void retranscribeWeakSpots()}
              />
              <div className="border-t border-border pt-6">
                <GlossaryManager
                  glossary={glossary}
                  rules={lexRules}
                  onGlossaryChange={setGlossary}
                  onRulesChange={setLexRules}
                  onApplyNow={() => {
                    const ruled = applyRulesToWords(words, lexRules);
                    setLexRules(ruled.rules);
                    setWords(ruled.words);
                    setTranscript(wordsToTranscript(ruled.words));
                    toast.success(ruled.changed ? `แก้คำตามกฎ ${ruled.changed} จุด` : "ไม่พบคำที่ต้องแก้ตามกฎ");
                  }}
                />
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
        <section className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-4 lg:self-start">
          <div className="studio-panel rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium"><Smartphone className="h-4 w-4" /> TikTok Preview</div>
              <Switch checked={tiktokPreview} onCheckedChange={setTiktokPreview} aria-label="เปิดพรีวิว TikTok" />
            </div>
            <div
              ref={frameRef}
              className={`relative mx-auto w-full overflow-hidden rounded-xl bg-preview shadow-primary-lg ring-1 ring-primary/20 ${tiktokPreview ? "aspect-[886/1920] max-w-[314px]" : "aspect-[9/16] max-w-[340px]"}`}
            >
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="h-full w-full object-cover will-change-transform"
                  style={{
                    transform: `scale(${previewMotion.scale}) translate(${previewMotion.translateX * 100}%, ${previewMotion.translateY * 100}%)`,
                  }}
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
              <ViralTextOverlay scenes={scenes} sceneElements={sceneElements} time={time} height={frameHeight} />
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
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="secondary" onClick={togglePlay} disabled={!videoUrl} aria-label={playing ? "หยุด" : "เล่น"}>
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    if (videoRef.current) videoRef.current.muted = next;
                  }} disabled={!videoUrl} aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}>
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void frameRef.current?.requestFullscreen?.()} disabled={!videoUrl} aria-label="เต็มหน้าจอ">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
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
