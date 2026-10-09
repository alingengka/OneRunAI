import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
  Smartphone,
  Sparkles,
  Upload,
  Waves,
  Wand2,
  Maximize2,
  X,
  Save,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  AudioLines,
  Clapperboard,
  Type,
  Zap,
  SlidersHorizontal,
  Palette,
  Music2,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { CaptionOverlay } from "@/components/editor/CaptionOverlay";
import { TikTokSafeAreaOverlay } from "@/components/editor/TikTokSafeAreaOverlay";
import { WordTimelineEditor } from "@/components/editor/WordTimelineEditor";
import { WordTrack, type TimelineLanes } from "@/components/editor/WordTrack";
import { MobileWordBar } from "@/components/editor/MobileWordBar";
import { moveWordTo } from "@/lib/word-actions";
import { Inspector } from "@/components/editor/Inspector";
import { computePeaks, makeThumbnails } from "@/lib/media/timeline-assets";
import { CaptionList } from "@/components/editor/CaptionList";
import { StyleControls } from "@/components/editor/StyleControls";
import { StylePicker } from "@/components/editor/StylePicker";
import {
  alignWordsToSegments,
  baseStyle,
  groupCaptions,
  joinCaptionWords,
  captionModeOf,
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
  splitSegmentsAtWordGaps,
  uncoveredSpeech,
  estimateNoiseFloor,
  refineSpeechSegments,
  smoothSpeechSegments,
  type Segment,
} from "@/lib/media/audio";
import {
  alignTextToTiming,
  alignTextToTimingOnTimeline,
  closeSpeechGaps,
  forcedAlignWords,
  mapConcatTimeToTimeline,
  mergeAlignedChunks,
} from "@/lib/media/forced-align";
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
import {
  wordsToTranscript,
  buildRowWords,
  normalizeWordTimes,
  type SyncIssue,
} from "@/lib/caption-editing";
import { buildCapCutPackage } from "@/lib/capcut-package";
import type { SoundPack } from "@/lib/audio-system";
import { motionAt, type MotionKind } from "@/lib/media/motion";
import { Clocked, createPlaybackClock, nextBoundaryAfter } from "@/lib/playback-clock";
import { PlaybackDebug } from "@/components/editor/PlaybackDebug";
import { isPriming, markUserPlay, primeFirstFrame } from "@/lib/media/first-frame";
import {
  addSceneElement,
  buildScenes,
  reassignElementsAfterSplit,
  splitSceneAt,
  updateSceneElementFormat,
  updateSceneElementLayout,
  updateSceneElementAsset,
  type SceneAssetPatch,
  updateSceneElementMotionKind,
  updateSceneElementText,
  updateSceneElementTiming,
  type Scene,
  type SceneElement,
  type SceneElementKind,
} from "@/lib/scenes";
import { ScenesPanel } from "@/components/editor/ScenesPanel";
import { ViralTextOverlay } from "@/components/editor/ViralTextOverlay";
import { BrollOverlay } from "@/components/editor/BrollOverlay";

import { AccuracyPanel } from "@/components/editor/AccuracyPanel";
import { GlossaryManager } from "@/components/editor/GlossaryManager";
import { applyRulesToWords, parseGlossaryTerms, type LexRule } from "@/lib/lao-glossary";
import { buildAccuracyReport } from "@/lib/accuracy-report";
import { OneRunLogo } from "@/components/brand/OneRunLogo";
import { isAccountError } from "@/lib/account-shared";
import { runInOrderPool } from "@/lib/pool";
import { AccessGate } from "@/components/account/AccessGate";
import {
  CaptionColorControls,
  CaptionLayoutControls,
} from "@/components/editor/CaptionLayoutControls";
import { ExportMenu, loadExportPreset, type ExportType } from "@/components/editor/ExportMenu";
import { StickerOverlay } from "@/components/editor/StickerOverlay";
import { StickerPanel } from "@/components/editor/StickerPanel";
import {
  DEFAULT_TEXT_FONT,
  EMOJIS,
  newStickerId,
  suggestEmojiStickers,
  type Sticker,
} from "@/lib/media/stickers";
import { MobileTextSheet } from "@/components/editor/MobileTextSheet";
import { AccountMenu } from "@/components/account/AccountMenu";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "OneRunAI — AI Short Video Editor" },
      {
        name: "description",
        content: "สร้างซับไตเติลอัตโนมัติแบบทีละคำ ใส่สไตล์ และส่งออกวิดีโอพร้อมโพสต์ด้วย OneRunAI",
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
  component: GatedStudio,
});

function GatedStudio() {
  return (
    <AccessGate>
      <Studio />
    </AccessGate>
  );
}

type Tab =
  | "tools"
  | "styles"
  | "customize"
  | "text"
  | "accuracy"
  | "scenes"
  | "stickers"
  | "audio"
  | "export";

/** Editor menu: each section opens its default tab; some sections hold sub-tabs. */
type Section = "ai" | "captions" | "style" | "scenes" | "audio" | "export";

const SECTIONS: { id: Section; label: string; short: string; tab: Tab; icon: LucideIcon }[] = [
  { id: "ai", label: "เครื่องมือ AI", short: "AI", tab: "tools", icon: Sparkles },
  { id: "captions", label: "ซับไตเติล", short: "ซับ", tab: "text", icon: Captions },
  { id: "style", label: "สไตล์", short: "สไตล์", tab: "styles", icon: Palette },
  { id: "scenes", label: "ซีน & สติกเกอร์", short: "ซีน", tab: "scenes", icon: Clapperboard },
  { id: "audio", label: "เสียง", short: "เสียง", tab: "audio", icon: Music2 },
  { id: "export", label: "ส่งออก", short: "ส่งออก", tab: "export", icon: Download },
];

function sectionOf(tab: Tab): Section {
  if (tab === "tools") return "ai";
  if (tab === "text" || tab === "accuracy") return "captions";
  if (tab === "styles" || tab === "customize") return "style";
  if (tab === "stickers") return "scenes";
  return tab;
}

type LangCode = "th" | "lo" | "en";

const LANGUAGES: { code: LangCode; label: string; font: string }[] = [
  { code: "th", label: "ไทย", font: "'Kanit', 'Noto Sans Thai', sans-serif" },
  { code: "lo", label: "ລາວ", font: "'Noto Sans Lao Looped', 'Noto Sans Lao', sans-serif" },
  { code: "en", label: "English", font: "'Inter', system-ui, sans-serif" },
];

/** Cuts up to this long are fast-forwarded in the preview; longer ones are seeked. */
const FAST_SKIP_MAX = 1.2;

/** How many subtitle chunks are transcribed at the same time. */
const TRANSCRIBE_CONCURRENCY = 3;

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Matches Tailwind's lg breakpoint, where the desktop layout starts. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(min-width: 1024px)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

function Studio() {
  const {
    play,
    setVolume: setAudioVolume,
    setEnabled: setAudioEnabled,
    setPack: setAudioPack,
  } = useAudioFeedback();
  const transcribeFn = useServerFn(transcribeAudio);
  // Surface engine failures (e.g. a bad API key) once instead of silently
  // returning lower-quality subtitles.
  const warnedRef = useRef(new Set<string>());
  const transcribe = useCallback(
    async (args: Parameters<typeof transcribeFn>[0]) => {
      const res = await transcribeFn(args);
      for (const warning of res.warnings ?? []) {
        if (warnedRef.current.has(warning)) continue;
        warnedRef.current.add(warning);
        toast.warning(warning, { duration: 6000 });
      }
      return res;
    },
    [transcribeFn],
  );
  const translate = useServerFn(translateLines);
  const videoRef = useRef<HTMLVideoElement>(null);
  /** The tool panel; a new tab starts at its top, not where the last one was scrolled. */
  const panelRef = useRef<HTMLElement>(null);
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
  /**
   * `clock` ticks with the video; `time` (React state) follows it only when
   * paused or when something on screen outside the preview changes (a word,
   * caption group, sticker or scene starts or ends), so playback does not
   * re-render the whole editor every frame.
   */
  const clock = useMemo(() => createPlaybackClock(), []);
  // ?debug=1 shows playback numbers on the preview (for phone stutter reports).
  const [debugPlayback, setDebugPlayback] = useState(false);
  useEffect(() => {
    setDebugPlayback(new URLSearchParams(window.location.search).get("debug") === "1");
  }, []);
  const [time, setCoarseTime] = useState(0);
  const setTime = useCallback(
    (t: number) => {
      clock.set(t);
      setCoarseTime(t);
    },
    [clock],
  );
  const [playing, setPlaying] = useState(false);
  const [frameHeight, setFrameHeight] = useState(0);
  const [frameWidth, setFrameWidth] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const previewSlotRef = useRef<HTMLDivElement>(null);
  const [previewSlot, setPreviewSlot] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  /** Phone: the text layer open in the bottom edit sheet. */
  const [textSheet, setTextSheet] = useState<string | null>(null);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [transcript, setTranscript] = useState("");
  const [glossary, setGlossary] = useState("");
  const [lexRules, setLexRules] = useState<LexRule[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(baseStyle);
  const [tab, setTab] = useState<Tab>("tools");
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [tab]);
  const [selectedWord, setSelectedWord] = useState<number | null>(null);
  const isDesktop = useIsDesktop();
  const [timelineThumbs, setTimelineThumbs] = useState<{ thumbs: string[]; step: number } | null>(
    null,
  );
  const [peaks, setPeaks] = useState<number[]>([]);
  const [languages, setLanguages] = useState<LangCode[]>(["th"]);

  const [captionsOn, setCaptionsOn] = useState(true);
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [resolution, setResolution] = useState<ExportResolution>("1080");
  const [exportFps, setExportFps] = useState(30);
  const [exportType, setExportType] = useState<ExportType>("captions");
  useEffect(() => {
    const preset = loadExportPreset();
    if (!preset) return;
    setResolution(preset.resolution);
    setExportFps(preset.fps);
    setExportType(preset.type);
  }, []);
  const [tiktokPreview, setTiktokPreview] = useState(false);
  useEffect(() => {
    const el = previewSlotRef.current;
    if (!el) return;
    const measure = () => setPreviewSlot({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  /** Tallest 9:16 (or TikTok-frame) player that fits the right column. */
  const desktopFrameHeight =
    isDesktop && !expanded && previewSlot.height > 0
      ? Math.floor(
          Math.min(previewSlot.height, previewSlot.width * (tiktokPreview ? 1920 / 886 : 16 / 9)),
        )
      : 0;
  const [autoResync, setAutoResync] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);
  const [sfx, setSfx] = useState<{ enabled: boolean; volume: number; pack: SoundPack }>({
    enabled: true,
    volume: 0.35,
    pack: "clean",
  });
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

  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const scenes = useMemo(
    () =>
      [...splitPoints]
        .sort((a, b) => a - b)
        .reduce((acc, t) => splitSceneAt(acc, t), buildScenes(segments, words)),
    [segments, words, splitPoints],
  );
  const droppedRanges = useMemo(
    () => scenes.filter((s) => dropped.includes(s.id)).map((s) => ({ start: s.start, end: s.end })),
    [scenes, dropped],
  );
  const isDropped = useCallback(
    (t: number) => droppedRanges.some((r) => t >= r.start - 0.001 && t <= r.end + 0.001),
    [droppedRanges],
  );
  /**
   * What goes into the export: the whole clip minus scenes the user turned
   * off. Silence cutting was removed (users trim in CapCut first); speech
   * segments are still detected, but only to split audio for transcription.
   */
  const outputSegments = useMemo(() => {
    if (!duration) return [];
    const ranges = [...droppedRanges].sort((a, b) => a.start - b.start);
    return invertSegments(ranges, duration);
  }, [droppedRanges, duration]);
  const visibleWords = useMemo(() => words.filter((w) => !isDropped(w.start)), [words, isDropped]);

  /** Parts left out of the export (turned-off scenes), skipped in the preview. */
  const silences = useMemo(
    () => (duration ? invertSegments(outputSegments, duration) : []),
    [outputSegments, duration],
  );
  const groups = useMemo(
    () =>
      groupCaptions(visibleWords, {
        captionMode: style.captionMode,
        wordsPerGroup: style.wordsPerGroup,
      }),
    [visibleWords, style.captionMode, style.wordsPerGroup],
  );
  const activeGroup = useMemo(
    () => groups.find((g) => time >= g.start && time <= g.end) ?? null,
    [groups, time],
  );
  const selectedWordValid =
    selectedWord != null && selectedWord < words.length ? selectedWord : null;
  /** Desktop: a word, text or sticker is selected, so its settings column shows. */
  const desktopInspector =
    isDesktop &&
    (selectedWordValid != null || stickers.some((sticker) => sticker.id === selectedSticker));
  /** The caption line around the selected word (for "re-transcribe this line"). */
  const selectedLineRange = useMemo(() => {
    const word = selectedWordValid != null ? words[selectedWordValid] : undefined;
    const group = word ? groups.find((g) => g.words.includes(word)) : undefined;
    return group
      ? { start: group.start, end: group.end }
      : { start: word?.start ?? 0, end: word?.end ?? 0 };
  }, [selectedWordValid, words, groups]);
  const timelineLanes = useMemo<TimelineLanes>(
    () => ({
      ...(timelineThumbs ? { thumbs: timelineThumbs.thumbs, thumbStep: timelineThumbs.step } : {}),
      ...(peaks.length ? { peaks, peakStep: 0.05 } : {}),
      stickers: stickers.map((sticker) => ({
        id: sticker.id,
        start: sticker.start,
        end: sticker.end,
        label:
          sticker.kind === "emoji"
            ? (EMOJIS.find((emoji) => emoji.code === sticker.asset)?.char ?? "😀")
            : sticker.kind === "text"
              ? `T ${sticker.asset.replace(/\s+/g, " ").slice(0, 24)}`
              : "สติกเกอร์",
      })),
    }),
    [timelineThumbs, peaks, stickers],
  );

  // Video thumbnails for the timeline, made in the background after a clip loads.
  useEffect(() => {
    setTimelineThumbs(null);
    if (!file || !(duration > 0)) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      // Phones decode thumbnails with the same hardware as the preview, so
      // make fewer and hold off while the clip plays (it stuttered).
      const phone = window.matchMedia("(pointer: coarse)").matches;
      void makeThumbnails(file, duration, {
        max: phone ? 36 : 80,
        hold: () => alive && !!videoRef.current && !videoRef.current.paused,
        cancelled: () => !alive,
      }).then((result) => {
        if (alive && result) setTimelineThumbs(result);
      });
    }, 600);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [file, duration]);
  const activeGroupIndex = useMemo(
    () => groups.findIndex((g) => time >= g.start && time <= g.end),
    [groups, time],
  );
  const previewLineCount = useMemo(() => {
    if (!activeGroup) return 3;
    const manual = activeGroup.words.filter((w) => w.text === LINE_BREAK).length;
    if (manual) return manual + 1;
    const per = Math.max(0, Math.round(style.wordsPerLine ?? 0));
    const visible = activeGroup.words.filter((w) => w.text !== LINE_BREAK).length;
    return per > 0 ? Math.max(1, Math.ceil(visible / per)) : 1;
  }, [activeGroup, style.wordsPerLine]);

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
    const ro = new ResizeObserver(() => {
      setFrameHeight(el.clientHeight);
      setFrameWidth(el.clientWidth);
      setFrameWidth(el.clientWidth);
    });
    ro.observe(el);
    setFrameHeight(el.clientHeight);
    return () => ro.disconnect();
  }, [videoUrl]);

  // playback clock + silence skipping
  const lastClockRef = useRef(0);
  const transformRef = useRef("");
  useEffect(() => {
    transformRef.current = ""; // a new <video> element starts untransformed
  }, [videoUrl]);
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const sceneElementsRef = useRef(sceneElements);
  sceneElementsRef.current = sceneElements;
  /**
   * Times where something outside the preview changes during playback: the
   * caption list's current line, sound effects, the sticker and scene panels.
   * Word-by-word highlighting lives in the preview, which follows the clock.
   */
  const boundaries = useMemo(() => {
    const out: number[] = [];
    for (const g of groups) out.push(g.start, g.end);
    for (const st of stickers) out.push(st.start, st.end);
    for (const sc of scenes) out.push(sc.start, sc.end);
    return out.sort((a, b) => a - b);
  }, [groups, stickers, scenes]);
  const boundariesRef = useRef(boundaries);
  boundariesRef.current = boundaries;
  const coarseTimeRef = useRef({ time: -1, next: 0 });
  useEffect(() => {
    coarseTimeRef.current.next = -Infinity; // re-evaluate against the new list
  }, [boundaries]);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  /** Fast-forwarding through a cut right now (muted, high playbackRate). */
  const skippingRef = useRef(false);
  useEffect(() => {
    let raf = 0;
    const endSkip = (v: HTMLVideoElement) => {
      if (!skippingRef.current) return;
      skippingRef.current = false;
      v.playbackRate = 1;
      v.muted = mutedRef.current;
    };
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const t = v.currentTime;
        // Only while playing: scrubbing a paused video through a cut must not jump.
        const gap =
          silences.length && !v.paused
            ? silences.find((g) => t >= g.start && t < g.end - 0.03)
            : undefined;
        if (gap) {
          const remaining = gap.end - t;
          let fastForward = remaining <= FAST_SKIP_MAX;
          if (fastForward) {
            // A seek stalls the picture and sound on phones; racing through a
            // short cut muted at up to 16x does not. The rate eases off near
            // the end so playback lands on the next spoken part.
            try {
              v.playbackRate = Math.min(16, Math.max(1, remaining / 0.03));
              if (!skippingRef.current) {
                skippingRef.current = true;
                v.muted = true;
              }
            } catch {
              fastForward = false; // browser refuses high rates: seek instead
            }
          }
          if (!fastForward) {
            endSkip(v);
            const next = outputSegments.find((s) => s.start >= gap.end - 0.001);
            v.currentTime = next ? next.start : v.duration;
          }
        } else {
          endSkip(v);
        }
        // ~30 updates a second is smooth for captions; phones run requestAnimationFrame
        // at 120Hz, and re-rendering that often made playback stutter.
        const now = v.currentTime;
        if (v.paused || Math.abs(now - lastClockRef.current) >= 1 / 30) {
          lastClockRef.current = now;
          clock.set(now);
        }
        // Scene motion on the preview, same formula as the export. Set on the
        // element directly so it does not need a React render.
        const motion = motionAt(now, scenesRef.current, sceneElementsRef.current);
        const transform = `scale(${motion.scale}) translate(${motion.translateX * 100}%, ${motion.translateY * 100}%)`;
        // Compare with what we last wrote: the browser normalises the style
        // string, and re-setting it every frame recomposited the video.
        if (transformRef.current !== transform) {
          transformRef.current = transform;
          v.style.transform = transform;
        }
        const coarse = coarseTimeRef.current;
        if (
          v.paused
            ? now !== coarse.time
            : now >= coarse.next || now < coarse.time || now - coarse.time >= 2
        ) {
          coarse.time = now;
          coarse.next = nextBoundaryAfter(boundariesRef.current, now);
          setCoarseTime(now);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [outputSegments, silences, clock]);

  useEffect(() => {
    setAudioEnabled(sfx.enabled);
    setAudioVolume(sfx.volume);
    setAudioPack(sfx.pack);
  }, [sfx, setAudioEnabled, setAudioPack, setAudioVolume]);

  useEffect(() => {
    if (
      !playing ||
      !sfx.enabled ||
      activeGroupIndex < 0 ||
      activeGroupIndex === lastSoundGroupRef.current
    )
      return;
    lastSoundGroupRef.current = activeGroupIndex;
    void play(style.animation);
  }, [activeGroupIndex, play, playing, sfx.enabled, style.animation]);

  const analyze = useCallback(async (target: File, thresholdDb: number, minSil: number) => {
    setAnalyzing(true);
    try {
      let buffer = audioBufferRef.current;
      if (!buffer) {
        buffer = await decodeAudioFromFile(target);
        audioBufferRef.current = buffer;
        setPeaks(computePeaks(buffer));
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
      play("success");
      return { buffer, segs };
    } catch (e) {
      const noSpeech = e instanceof Error && e.message.startsWith("ไม่พบช่วงเสียงพูด");
      toast.error(noSpeech ? e.message : "อ่านเสียงจากไฟล์นี้ไม่ได้ ลองไฟล์ MP4/WebM ที่มีเสียง");
      throw e;
    } finally {
      setAnalyzing(false);
    }
  }, []);

  /**
   * iPhones copy (and often convert) a video picked from Photos before the
   * page gets it, which can take many seconds for a long 4K clip. Show that
   * something is happening from the moment the picker closes.
   */
  const [receivingFile, setReceivingFile] = useState(false);
  const pickerOpenRef = useRef(false);
  const openFilePicker = () => {
    pickerOpenRef.current = true;
    fileInputRef.current?.click();
  };
  useEffect(() => {
    const input = fileInputRef.current;
    const onBack = () => {
      if (!pickerOpenRef.current || document.visibilityState !== "visible") return;
      // Give a quick pick a moment to arrive before showing the overlay.
      window.setTimeout(() => {
        if (pickerOpenRef.current) setReceivingFile(true);
      }, 400);
    };
    const onCancel = () => {
      pickerOpenRef.current = false;
      setReceivingFile(false);
    };
    window.addEventListener("focus", onBack);
    document.addEventListener("visibilitychange", onBack);
    input?.addEventListener("cancel", onCancel);
    return () => {
      window.removeEventListener("focus", onBack);
      document.removeEventListener("visibilitychange", onBack);
      input?.removeEventListener("cancel", onCancel);
    };
  }, []);
  useEffect(() => {
    if (!receivingFile) return;
    const timer = window.setTimeout(() => {
      pickerOpenRef.current = false;
      setReceivingFile(false);
      toast.error("ยังไม่ได้รับคลิปจากเครื่อง ลองเลือกใหม่ หรือเลือกผ่าน “Choose File”");
    }, 120_000);
    return () => window.clearTimeout(timer);
  }, [receivingFile]);
  const takePickedFile = (input: HTMLInputElement) => {
    const f = input.files?.[0];
    if (!f) return;
    pickerOpenRef.current = false;
    setReceivingFile(false);
    // Clear the input so choosing the same file again still fires onChange.
    input.value = "";
    void onPickFile(f);
  };

  const onPickFile = async (f: File) => {
    audioBufferRef.current = null;
    setPeaks([]);
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
      setStickers([]);
      setSplitPoints([]);
      setProjectName(f.name.replace(/\.[^.]+$/, ""));
    }
    setTime(0);
    if (preserveRestored) {
      analysisPromiseRef.current = null;
      return;
    }
    const pending = analyze(f, threshold, minSilence).catch(() => undefined);
    analysisPromiseRef.current = pending;
    await pending;
    if (analysisPromiseRef.current === pending) analysisPromiseRef.current = null;
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
      stickers,
      splitPoints,
      projectName,
      sfx,
    }),
    [
      file,
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
      stickers,
      splitPoints,
      projectName,
      sfx,
    ],
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
    if (!p) {
      toast.error("ไม่มีงานที่บันทึกไว้");
      return;
    }
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
    setStickers(p.stickers ?? []);
    setSplitPoints(p.splitPoints ?? []);
    setProjectName(p.projectName ?? p.fileName.replace(/\.[^.]+$/, ""));
    restoredProjectRef.current = true;
    if (p.sfx) setSfx(p.sfx);
    setDuration((d) => d || p.duration);
    setCaptionsOn(true);
    toast.success(`โหลดงานที่บันทึกไว้ (${p.fileName}) แล้ว — อัปโหลดคลิปเดิมเพื่อดูพรีวิว`);
  };

  // ── แปลซับเป็นภาษาอื่น (คงเวลาเดิม) ─────────────────────────────────────
  const translateCaptions = async (target: LangCode) => {
    if (!words.length) {
      toast.error("ยังไม่มีซับให้แปล");
      return;
    }
    setTranslating(true);
    const id = toast.loading("กำลังแปลซับ…");
    try {
      const src = groupCaptions(words, style);
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
    if (!file) {
      toast.error("อัปโหลดคลิปก่อน");
      return;
    }
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
      // Longer chunks mean far fewer AI calls (and rate limits): Thai/English
      // go to Scribe, which handles long audio and returns word times; Lao
      // runs several engines per chunk, so it stays a little shorter.
      const baseChunks = buildAsrChunks(transcriptionSegments, buffer.duration, {
        // Lao: long audio makes the models drop the end of what was said.
        min: lang === "lo" ? 5 : 20,
        max: lang === "lo" ? 14 : 45,
        gap: lang === "lo" ? 0.8 : 0.55,
        pad: lang === "lo" ? 0.25 : 0.12,
      });
      const chunks =
        lang === "lo" ? addChunkOverlap(baseChunks, buffer.duration, 0.38) : baseChunks;
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
              data: {
                audioBase64: b64,
                language: lang,
                context: texts.join(" ").slice(-600),
                glossary: terms,
              },
            });
            const text = (res.text ?? "").trim();
            if (!text) {
              lastError = new Error("empty");
              continue;
            }
            const chunkDur = chunkSegs.reduce((n, s) => n + (s.end - s.start), 0);
            for (const word of res.words ?? []) {
              const start = mapConcatTimeToTimeline(word.start, chunkSegs);
              measured.push({
                text: word.text,
                start,
                end: Math.max(start + 0.06, mapConcatTimeToTimeline(word.end, chunkSegs)),
              });
            }
            const timed = alignTextToTimingOnTimeline(text, res.words ?? [], chunkSegs);
            const aligned = (timed ?? forcedAlignWords(buffer!, chunkSegs, text, chunkDur)).map(
              (word) => {
                const acoustic = word.confidence ?? 0.5;
                const confidence = Math.max(
                  0.15,
                  Math.min(0.99, acoustic * 0.62 + res.agreement * 0.38),
                );
                return {
                  ...word,
                  confidence,
                  confidenceLabel:
                    confidence >= 0.78
                      ? ("high" as const)
                      : confidence >= 0.52
                        ? ("review" as const)
                        : ("low" as const),
                };
              },
            );
            return { skipped: false as const, text, aligned };
          } catch (error) {
            // No access / no quota: retrying the other chunks cannot help.
            if (isAccountError(error)) throw error;
            lastError = error;
          }
        }
        return { failed: true as const, error: lastError };
      };

      if (chunks.length) {
        const missing: Segment[][] = [];
        const progressId = toast.loading(`กำลังถอดเสียง 0/${chunks.length} ช่วง…`);
        let done = 0;
        try {
          // Chunks run in parallel; each one gets whatever earlier text has
          // already been committed as spelling context.
          await runInOrderPool(
            chunks.length,
            TRANSCRIBE_CONCURRENCY,
            async (i) => {
              const out = await transcribeChunk(chunks[i]!, 2);
              done++;
              toast.loading(`กำลังถอดเสียง ${done}/${chunks.length} ช่วง…`, { id: progressId });
              return out;
            },
            (i, out) => {
              if ("skipped" in out && out.skipped) return;
              if ("failed" in out) {
                missing.push(chunks[i]!);
                return;
              }
              texts.push(out.text);
              const merged = mergeAlignedChunks(allWords, out.aligned);
              allWords.splice(0, allWords.length, ...merged);
              setTranscript(texts.join(" "));
              setWords([...allWords]);
            },
          );
        } finally {
          toast.dismiss(progressId);
        }

        // ด่านสุดท้าย: ช่วงไหนยังไม่มีคำ ให้ลองใหม่อีกครั้งก่อนแสดงผล
        const stillMissing: Segment[][] = [];
        await runInOrderPool(
          missing.length,
          TRANSCRIBE_CONCURRENCY,
          (i) => transcribeChunk(missing[i]!, 1),
          (i, out) => {
            if ("skipped" in out && out.skipped) return;
            if ("failed" in out) {
              stillMissing.push(missing[i]!);
              return;
            }
            texts.push(out.text);
            allWords.push(...out.aligned);
            allWords.sort((a, b) => a.start - b.start);
            setWords([...allWords]);
          },
        );
        // Safety net: speech the engines skipped (often the end of a chunk).
        // The analysis heard voice there but no word landed in it, so send
        // just that part again.
        const skipped = uncoveredSpeech(segs, allWords).slice(0, 8);
        if (skipped.length) {
          const pad = 0.2;
          await runInOrderPool(
            skipped.length,
            TRANSCRIBE_CONCURRENCY,
            (i) =>
              transcribeChunk(
                [
                  {
                    start: Math.max(0, skipped[i]!.start - pad),
                    end: Math.min(buffer!.duration, skipped[i]!.end + pad),
                  },
                ],
                1,
              ),
            (_i, out) => {
              if (!("aligned" in out) || !out.aligned?.length) return;
              // The gap sits between existing words: add only words that do
              // not overlap them, then keep time order.
              const fill = out.aligned.filter(
                (word) =>
                  !allWords.some(
                    (other) => word.start < other.end - 0.02 && word.end > other.start + 0.02,
                  ),
              );
              if (!fill.length) return;
              texts.push(fill.map((word) => word.text).join(" "));
              allWords.push(...fill);
              allWords.sort((a, b) => a.start - b.start);
              setWords([...allWords]);
            },
          );
        }

        if (stillMissing.length) {
          const ranges = stillMissing
            .map(
              (segs2) =>
                `${(segs2[0]?.start ?? 0).toFixed(1)}–${(segs2[segs2.length - 1]?.end ?? 0).toFixed(1)} วิ`,
            )
            .join(", ");
          toast.error(
            `ถอดเสียงไม่สำเร็จ ${stillMissing.length} ช่วง (${ranges}) — กด "สร้างซับด้วย AI" อีกครั้งเพื่อลองช่วงที่ขาด`,
          );
        }
      } else {
        const wav = encodeWav16k(buffer);
        if (wav.size < 4096) throw new Error("ไฟล์เสียงสั้นเกินไป");
        const b64 = await blobToBase64(wav);
        const res = await transcribe({
          data: { audioBase64: b64, language: lang, glossary: parseGlossaryTerms(glossary) },
        });
        const text = (res.text ?? "").trim();
        if (text) {
          texts.push(text);
          for (const word of res.words ?? []) {
            const start = mapConcatTimeToTimeline(word.start, segs);
            measured.push({
              text: word.text,
              start,
              end: Math.max(start + 0.06, mapConcatTimeToTimeline(word.end, segs)),
            });
          }
          allWords.push(
            ...(alignTextToTimingOnTimeline(text, res.words ?? [], segs) ??
              forcedAlignWords(buffer!, segs, text, buffer!.duration)),
          );
        }
      }

      measuredTimingRef.current = measured.sort((a, b) => a.start - b.start);
      if (!allWords.length) throw new Error("ไม่พบคำพูดในคลิป");
      // ปิดช่องว่างที่ยังมีเสียงพูดจริง (เกิดที่รอยต่อ chunk: คำครบแต่เวลาหดเข้าใน)
      allWords.splice(0, allWords.length, ...closeSpeechGaps(allWords, segs));
      // งาน A: ใช้เวลาคำจริงขยายขอบช่วงพูด ไม่ให้ energy gate ตัดพยางค์ต้น/ท้ายขาด

      // Measured word times (Scribe) show every pause, even in a noisy place,
      // so cuts come from the words; estimated times only nudge the edges.
      const reconciled = measured.length
        ? splitSegmentsAtWordGaps(segs, measured, {
            minGap: Math.max(0.25, minSilence),
            duration: buffer.duration,
          })
        : reconcileSegmentsWithWords(segs, allWords, { duration: buffer.duration });
      if (reconciled.length) setSegments(reconciled);
      const ruled = applyRulesToWords(allWords, lexRules);
      if (ruled.changed) setLexRules(ruled.rules);
      setTranscript(wordsToTranscript(ruled.words));
      setWords(ruled.words);
      setCaptionsOn(true);
      toast.success("สร้างซับไตเติลเรียบร้อย");
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
    markUserPlay(video);
    void video.play();
    setPlaying(true);
    window.setTimeout(
      () => {
        if (video.currentTime <= end + 0.5) {
          video.pause();
          setPlaying(false);
        }
      },
      Math.max(650, (end - start + 0.7) * 1000),
    );
  };

  const retrySyncIssues = async (issues: SyncIssue[]) => {
    if (!file || !audioBufferRef.current) {
      toast.error("อัปโหลดคลิปก่อนตรวจซิงก์");
      return;
    }
    const lowConfidence = words.flatMap((word, index) =>
      word.confidenceLabel === "low"
        ? [{ index, start: word.start, end: word.end, reason: "ความมั่นใจต่ำ" }]
        : [],
    );
    if (!issues.length && !lowConfidence.length) {
      toast.success("เวลาซับเรียงต่อเนื่องดี ไม่พบจุดผิดปกติ");
      return;
    }
    setRetryingSync(true);
    const id = toast.loading(
      `กำลังลองใหม่ ${new Set([...issues, ...lowConfidence].map((issue) => issue.index)).size} ช่วง…`,
    );
    try {
      let next = [...words];
      const queue = [...issues, ...lowConfidence].filter(
        (issue, index, all) =>
          all.findIndex((candidate) => candidate.index === issue.index) === index,
      );
      for (const issue of queue.slice(0, 12)) {
        const old = next[issue.index];
        if (!old) continue;
        const region = {
          start: Math.max(0, old.start - 0.45),
          end: Math.min(duration, old.end + 0.45),
        };
        const wav = encodeSegmentsWav16k(audioBufferRef.current, [region]);
        if (wav.size < 2048) continue;
        const localContext = next
          .slice(Math.max(0, issue.index - 5), issue.index)
          .map((word) => word.text)
          .join(" ");
        const terms = parseGlossaryTerms(glossary);
        const res = await transcribe({
          data: {
            audioBase64: await blobToBase64(wav),
            language: languages[0] ?? "th",
            context: localContext,
            glossary: terms,
            fresh: true,
          },
        });
        const replacementText = res.text ?? old.text;
        const replacements =
          alignTextToTimingOnTimeline(replacementText, res.words ?? [], [region]) ??
          forcedAlignWords(
            audioBufferRef.current,
            [region],
            replacementText,
            region.end - region.start,
          );
        if (replacements.length)
          next = [...next.slice(0, issue.index), ...replacements, ...next.slice(issue.index + 1)];
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
    if (!buffer) {
      toast.error("อัปโหลดคลิปก่อนถอดเสียงใหม่");
      return;
    }
    const region = {
      start: Math.max(0, start - 0.2),
      end: Math.min(duration || buffer.duration, end + 0.2),
    };
    if (region.end - region.start < 0.25) {
      toast.error("ช่วงสั้นเกินไป");
      return;
    }
    setRetryingSync(true);
    const id = toast.loading(
      `กำลังถอดเสียงใหม่ ${region.start.toFixed(1)}s – ${region.end.toFixed(1)}s…`,
    );
    try {
      const wav = encodeSegmentsWav16k(buffer, [region], false);
      if (wav.size < 2048) throw new Error("เสียงในช่วงนี้น้อยเกินไป");
      const before = words.filter((word) => word.end <= region.start);
      const after = words.filter((word) => word.start >= region.end);
      const context = before
        .slice(-8)
        .map((word) => word.text)
        .join(" ");
      const res = await transcribe({
        data: {
          audioBase64: await blobToBase64(wav),
          language: languages[0] ?? "th",
          context,
          glossary: parseGlossaryTerms(glossary),
          fresh: true,
        },
      });
      const text = (res.text ?? "").trim();
      if (!text) throw new Error("ไม่พบคำพูดในช่วงนี้");
      const timed = alignTextToTimingOnTimeline(text, res.words ?? [], [region]);
      const aligned = (
        timed ?? forcedAlignWords(buffer, [region], text, region.end - region.start)
      ).map((word) => {
        const acoustic = word.confidence ?? 0.5;
        const confidence = Math.max(0.15, Math.min(0.99, acoustic * 0.62 + res.agreement * 0.38));
        return {
          ...word,
          confidence,
          confidenceLabel:
            confidence >= 0.78
              ? ("high" as const)
              : confidence >= 0.52
                ? ("review" as const)
                : ("low" as const),
        };
      });
      const ruled = applyRulesToWords(
        [...before, ...aligned, ...after].sort((a, b) => a.start - b.start),
        lexRules,
      );
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
    if (!weak.length) {
      toast.success("ไม่พบช่วงที่ต้องถอดใหม่");
      return;
    }
    for (const span of weak) await retranscribeRange(span.start, span.end);
    toast.success(`ถอดใหม่ ${weak.length} ช่วงที่อ่อนแล้ว`);
  };

  /** ตัวช่วยจัดการงานเรนเดอร์: มีสถานะ % และปุ่มยกเลิกจริง */
  const runJob = async (
    label: string,
    work: (signal: AbortSignal, onProgress: (r: number) => void) => Promise<void>,
  ) => {
    const controller = new AbortController();
    jobAbort.current = controller;
    setRendering(true);
    setJob({ label, ratio: 0 });
    try {
      await work(controller.signal, (r) => setJob({ label, ratio: Math.max(0, Math.min(1, r)) }));
      if (!controller.signal.aborted) play("success");
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
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
    if (!videoUrl || !outputSegments.length) {
      toast.error("อัปโหลดคลิปและวิเคราะห์เสียงก่อน");
      return;
    }
    void runJob("เรนเดอร์วิดีโอ", async (signal, onProgress) => {
      const blob = await exportTrimmedWebm(videoUrl, [...outputSegments], onProgress, {
        noiseReduction,
        noiseFloor: noiseFloorRef.current,
        smoothCuts: true,
        signal,
      });
      if (signal.aborted) return;
      saveBlob(blob, `${baseName()}-onerun.webm`);
      toast.success("ได้วิดีโอ .webm แล้ว");
    });
  };

  /** ส่งออกวิดีโอสำเร็จรูป: ฝังซับลงในภาพ ใช้โพสต์ได้เลย */
  const updateSticker = (id: string, patch: Partial<Sticker>) =>
    setStickers((current) => current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSticker = (id: string) => {
    setStickers((current) => current.filter((s) => s.id !== id));
    setSelectedSticker((current) => (current === id ? null : current));
    setTextSheet((current) => (current === id ? null : current));
  };
  /** Free text layer at the playhead (CapCut "Add text"), selected and ready to type. */
  const addTextLayer = () => {
    const start = Math.max(0, Math.min(time, Math.max(0, duration - 0.5)));
    const layer: Sticker = {
      id: newStickerId(),
      kind: "text",
      asset: "ข้อความ",
      start,
      end: Math.min(duration || start + 3, start + 3),
      x: 50,
      y: 35,
      size: 6,
      rotation: 0,
      color: "#ffffff",
      stroke: "#111111",
      font: DEFAULT_TEXT_FONT,
    };
    videoRef.current?.pause();
    setStickers((current) => [...current, layer]);
    setSelectedWord(null);
    setSelectedSticker(layer.id);
    if (!isDesktop) setTextSheet(layer.id);
  };
  const duplicateSticker = (id: string) => {
    const source = stickers.find((s) => s.id === id);
    if (!source) return;
    const copy = { ...source, id: newStickerId(), y: Math.min(95, source.y + 8) };
    setStickers((current) => [...current, copy]);
    setSelectedSticker(copy.id);
    if (textSheet) setTextSheet(copy.id);
  };
  /**
   * Turns the caption line around a word into a free text layer (same words,
   * timing, place and look), so it can be moved, overlapped, trimmed, cut or
   * deleted on its own like a CapCut text clip.
   */
  const detachCaptionLine = (wordIndex: number) => {
    const word = words[wordIndex];
    const group = word ? groups.find((g) => g.words.includes(word)) : undefined;
    if (!group) return;
    const layer: Sticker = {
      id: newStickerId(),
      kind: "text",
      asset: joinCaptionWords(group.words, style.joinWords) || word!.text,
      start: group.start,
      end: Math.max(group.end, group.start + 0.2),
      x: style.posX,
      y: style.posY,
      size: style.size,
      rotation: 0,
      color: style.color,
      stroke: style.stroke === "none" ? undefined : style.strokeColor,
      font: style.fontFamily,
    };
    const taken = new Set(group.words);
    updateWords(words.filter((w) => !taken.has(w)));
    setStickers((current) => [...current, layer]);
    setSelectedWord(null);
    setSelectedSticker(layer.id);
    if (!isDesktop) setTextSheet(layer.id);
    toast.success("แยกเป็นข้อความอิสระแล้ว — ลากย้าย ยืดหด ตัด หรือลบได้");
  };
  /** Cuts a text or sticker in two at the playhead (CapCut "Split"). */
  const splitStickerAtPlayhead = (id: string) => {
    const source = stickers.find((s) => s.id === id);
    const at = videoRef.current?.currentTime ?? time;
    if (!source || at <= source.start + 0.1 || at >= source.end - 0.1) {
      toast.error("เลื่อนเส้นเวลาไปไว้กลางข้อความก่อน แล้วค่อยกดตัด");
      return;
    }
    const second = { ...source, id: newStickerId(), start: at };
    setStickers((current) =>
      current.flatMap((s) => (s.id === id ? [{ ...s, end: at }, second] : [s])),
    );
    setSelectedSticker(second.id);
    if (textSheet) setTextSheet(second.id);
  };
  const editTextLayer = (id: string) => {
    setSelectedSticker(id);
    if (!isDesktop) setTextSheet(id);
  };

  const exportFinalVideo = (type: ExportType = exportType) => {
    if (type === "srt") {
      exportSrt();
      return;
    }
    if (!videoUrl || !outputSegments.length) {
      toast.error("อัปโหลดคลิปและวิเคราะห์เสียงก่อน");
      return;
    }
    const webCodecs = supportsWebCodecsExport();
    if (!webCodecs) {
      toast.warning(
        "เบราว์เซอร์นี้ไม่รองรับ WebCodecs กำลังใช้โหมดสำรอง (อาจกระตุก) แนะนำ Chrome หรือ Edge",
      );
    } else if (resolution === "4k") {
      toast.info("4K จะใช้เวลาเรนเดอร์นานกว่ามาก แต่ไฟล์ที่ได้จะเดินเฟรมครบ ไม่กระตุก");
    }
    // The preview would compete with the export for the phone's video hardware.
    videoRef.current?.pause();
    setPlaying(false);
    void runJob("เรนเดอร์วิดีโอพร้อมซับ", async (signal, onProgress) => {
      const shared = {
        noiseReduction,
        noiseFloor: noiseFloorRef.current,
        smoothCuts: true,
        captions: type === "captions",
        signal,
        scenes,
        sceneElements,
        resolution,
        fps: exportFps,
        stickers,
      };
      const seconds = outputSegments.reduce((n, s) => n + (s.end - s.start), 0);

      if (webCodecs) {
        const run = (options: typeof shared) =>
          exportWebCodecsVideo(
            videoUrl,
            [...outputSegments],
            [...groups],
            style,
            onProgress,
            options,
          );
        let result: Awaited<ReturnType<typeof run>>;
        try {
          result = await run(shared);
        } catch (error) {
          // A phone encoder that keeps failing usually copes with smaller frames.
          const encoderTrouble =
            error instanceof Error && /เข้ารหัสวิดีโอ/.test(error.message) && !signal.aborted;
          if (!encoderTrouble || resolution === "720") throw error;
          toast.info("เครื่องนี้เข้ารหัสความละเอียดนี้ไม่ไหว กำลังลองใหม่ที่ 720p…");
          result = await run({ ...shared, resolution: "720" });
        }
        if (signal.aborted) return;
        console.info("[export-webcodecs] completed", result);
        saveBlob(result.blob, `${baseName()}-final.${result.ext}`);
        toast.success(
          `ได้วิดีโอพร้อมโพสต์แล้ว ${result.width}x${result.height} · ${result.fps}fps · ${result.frames} เฟรม`,
        );
        if (result.audioCopied && noiseReduction) {
          toast.info("เบราว์เซอร์นี้ใช้เสียงต้นฉบับของคลิป จึงไม่ได้ลดเสียงรบกวนในไฟล์ส่งออก");
        }
        return;
      }

      const {
        blob,
        ext,
        width,
        height,
        fps,
        plannedFps,
        fpsAdapted,
        frames,
        chunks,
        expectedDuration,
        segments: exportDiagnostics,
      } = await exportBurnedVideo(
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
      const durationDelta = Math.abs(
        exportDiagnostics.reduce((sum, segment) => sum + segment.played, 0) - expectedDuration,
      );
      if (durationDelta > Math.max(0.12, 2 / fps)) {
        throw new Error(
          `วิดีโอเล่นช่วงที่เลือกไม่ครบ (คลาดเคลื่อน ${durationDelta.toFixed(2)} วินาที)`,
        );
      }
      saveBlob(blob, `${baseName()}-final.${ext}`);
      const realFps = seconds > 0 ? frames / seconds : fps;
      toast.success(`ได้วิดีโอพร้อมโพสต์แล้ว ${width}x${height} · ~${realFps.toFixed(0)}fps`);
      if (fpsAdapted) {
        toast.warning(
          `เครื่องนี้เรนเดอร์ ${width}x${height} ได้ไม่ถึง ${plannedFps}fps จึงปรับเป็น ${fps}fps อัตโนมัติ`,
        );
      }
    });
  };

  const exportCapCutPackage = () => {
    if (!videoUrl || !outputSegments.length || !groups.length) {
      toast.error("ต้องมีวิดีโอ ช่วงตัด และซับก่อน");
      return;
    }
    void runJob("สร้าง CapCut Package", async (signal, onProgress) => {
      const video = await exportTrimmedWebm(
        videoUrl,
        [...outputSegments],
        (r) => onProgress(r * 0.9),
        {
          noiseReduction,
          noiseFloor: noiseFloorRef.current,
          smoothCuts: true,
          signal,
        },
      );
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
    if (!transcript.trim()) {
      toast.error("ยังไม่มีข้อความ");
      return;
    }
    const timed = alignTextToTiming(transcript, measuredTimingRef.current);
    setWords(
      timed ??
        (audioBufferRef.current
          ? forcedAlignWords(audioBufferRef.current, segments, transcript, duration)
          : alignWordsToSegments(transcript, segments, duration)),
    );
    toast.success("อัปเดตข้อความซับแล้ว");
  };

  const updateWords = (next: Word[]) => {
    setWords(next);
    setTranscript(wordsToTranscript(next));
  };

  /** Retime one word from the bottom timeline (drag handles). */
  /** A word dragged on the timeline to a new place (may pass other words). */
  const moveWord = (index: number, start: number, end: number) => {
    const moved = moveWordTo(words, index, start, end, duration);
    updateWords(moved);
    // Keep the dragged word selected at its new position in the list.
    const target = words[index];
    const at = moved.findIndex((w) => w.text === target?.text && Math.abs(w.start - start) < 1e-6);
    if (at >= 0) setSelectedWord(at);
  };

  const retimeWord = (index: number, start: number, end: number) => {
    updateWords(
      normalizeWordTimes(
        words.map((word, i) => (i === index ? { ...word, start, end } : word)),
        duration,
      ),
    );
  };

  /** แก้ข้อความของบล็อกซับที่กำลังแสดงบนพรีวิว ("\n" = แยกแถว) */
  const editActiveGroupText = (text: string) => {
    if (!activeGroup) return;
    const first = words.findIndex((w) => w === activeGroup.words[0]);
    if (first < 0) return;
    const last = first + activeGroup.words.length;
    const rows = text
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
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
        const rowEnd =
          i === rows.length - 1 ? activeGroup.end : cursor + (row.length / totalChars) * span;
        if (i > 0) replacement.push({ text: LINE_BREAK, start: cursor, end: cursor });
        replacement.push(
          ...alignWordsToSegments(row, [{ start: cursor, end: rowEnd }], rowEnd - cursor),
        );
        cursor = rowEnd;
      });
    }
    if (!replacement.length) return;
    updateWords([...words.slice(0, first), ...replacement, ...words.slice(last)]);
    toast.success(
      autoResync && segments.length
        ? "แก้ข้อความและรีซิงก์เวลาให้ตรงเสียงพูดแล้ว"
        : "อัปเดตข้อความบนพรีวิวแล้ว",
    );
  };

  const playClock = useCallback(() => {
    const v = videoRef.current;
    return v && !v.paused ? v.currentTime : null;
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    // The muted warm-up counts as paused: the person wants to start playing.
    if (v.paused || isPriming(v)) {
      markUserPlay(v);
      v.muted = mutedRef.current; // the warm-up plays muted
      setPlaying(true);
      // The button must not claim it is playing when the browser refused.
      v.play()?.catch(() => setPlaying(v.paused ? false : true));
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  // Space bar plays / pauses, except while typing in a text field.
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;
  // Delete / Backspace removes the selected word or sticker (desktop, like CapCut).
  const deleteSelectionRef = useRef<() => boolean>(() => false);
  deleteSelectionRef.current = () => {
    if (selectedWordValid != null) {
      updateWords(words.filter((_, i) => i !== selectedWordValid));
      setSelectedWord(null);
      return true;
    }
    if (selectedSticker) {
      removeSticker(selectedSticker);
      return true;
    }
    return false;
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")
      ) {
        return;
      }
      if (deleteSelectionRef.current()) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")
      ) {
        return;
      }
      // Also covers a focused button, which would otherwise be clicked again.
      event.preventDefault();
      togglePlayRef.current();
    };
    // A focused button activates on Space keyup; swallow that too.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.key !== " ") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const remap = useCallback(
    (t: number) => (outputSegments.length ? mapToTrimmed(t, outputSegments) : t),
    [outputSegments],
  );

  const exportSrt = () => {
    if (!groups.length) {
      toast.error("ยังไม่มีซับไตเติล");
      return;
    }
    download(`${baseName()}-captions.srt`, buildSrt(groups, remap), "application/x-subrip");
    play("pop");
    toast.success("ดาวน์โหลด .srt แล้ว — ลากเข้า CapCut ได้เลย");
  };
  const exportEdl = () => {
    if (!outputSegments.length) {
      toast.error("ยังไม่ได้วิเคราะห์เสียง");
      return;
    }
    download(`${file?.name ?? "clip"}.edl`, buildEdl(outputSegments, file?.name ?? "clip"));
    play("pop");
    toast.success("ดาวน์โหลด .edl (cut list) แล้ว");
  };
  const exportJson = () => {
    if (!outputSegments.length) {
      toast.error("ยังไม่ได้วิเคราะห์เสียง");
      return;
    }
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
    if (!outputSegments.length) {
      toast.error("ยังไม่ได้วิเคราะห์เสียง");
      return;
    }
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
    toast.success("ดาวน์โหลด .xml (timeline) แล้ว");
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = Math.max(0, t);
      setTime(v.currentTime);
    }
  };

  const saveNow = () => {
    saveProject(snapshot());
    setSavedInfo(loadProject());
    toast.success("บันทึกงานแล้ว");
  };

  const toggleSceneElement = (id: string) => {
    setSceneElements((current) =>
      current.map((element) =>
        element.id === id ? { ...element, enabled: !element.enabled } : element,
      ),
    );
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

  const updateElementMotionKind = (id: string, motionKind: MotionKind) => {
    setSceneElements((current) => updateSceneElementMotionKind(current, id, motionKind));
  };

  const updateElementLayout = (
    id: string,
    patch: { offsetX?: number; offsetY?: number; scalePercent?: number },
  ) => {
    setSceneElements((current) => updateSceneElementLayout(current, id, patch));
  };

  const updateElementAsset = (id: string, patch: SceneAssetPatch) => {
    setSceneElements((current) => updateSceneElementAsset(current, id, patch));
  };

  const addElement = (sceneId: string, kind: SceneElementKind) => {
    setSceneElements((current) => addSceneElement(current, sceneId, kind));
  };

  /** แบ่งซีนตรงเวลาที่กำลังเล่น (ถ้า playhead ไม่อยู่ในซีน ใช้กึ่งกลางซีน) */
  const splitScene = (scene: Scene) => {
    const inside = time > scene.start + 0.05 && time < scene.end - 0.05;
    const at = inside ? time : (scene.start + scene.end) / 2;
    const next = splitSceneAt(scenes, at);
    if (next.length === scenes.length) {
      toast.error("ซีนสั้นเกินไปสำหรับการแบ่ง");
      return;
    }
    setSceneElements((current) => reassignElementsAfterSplit(current, scene, next));
    setSplitPoints((current) => [...current, at]);
    toast.success("แบ่งซีนแล้ว");
  };

  return (
    <main className="studio-shell flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        className="orbit-decoration pointer-events-none absolute -right-32 top-24 -z-10 h-72 w-[32rem] opacity-60"
        aria-hidden="true"
      />
      <header className="studio-header sticky top-0 z-40 flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <OneRunLogo className="shrink-0 [&>span+span]:hidden sm:[&>span+span]:inline" />
          <div className="hidden h-8 w-px bg-border sm:block" />
          <div className="min-w-0 max-w-[280px] flex-1">
            <h1 className="sr-only">OneRunAI Short Video Editor</h1>
            <Input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              aria-label="ชื่อโปรเจกต์"
              className="h-8 border-transparent bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:border-input sm:text-base"
            />
            <p className="hidden px-1 text-xs text-muted-foreground sm:block">
              AI short video workspace
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Visually hidden but still rendered: iOS can drop the change event
              of a display:none input. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*"
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
            // Some iOS versions fire only one of these; whichever comes first wins.
            onInput={(e) => takePickedFile(e.currentTarget)}
            onChange={(e) => takePickedFile(e.currentTarget)}
          />
          <Button
            variant="secondary"
            onClick={() => openFilePicker()}
            className="px-3 sm:px-4"
            aria-label="อัปโหลดคลิป"
          >
            <Upload className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">อัปโหลดคลิป</span>
          </Button>
          <Button variant="secondary" onClick={saveNow} className="hidden md:inline-flex">
            <Save className="mr-2 h-4 w-4" /> บันทึก
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={darkMode ? "ใช้โหมดสว่าง" : "ใช้โหมดมืด"}
            title={darkMode ? "ใช้โหมดสว่าง" : "ใช้โหมดมืด"}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <ExportMenu
            settings={{ resolution, fps: exportFps, type: exportType }}
            onChange={(patch) => {
              if (patch.resolution) setResolution(patch.resolution);
              if (patch.fps) setExportFps(patch.fps);
              if (patch.type) setExportType(patch.type);
            }}
            onExport={() => exportFinalVideo()}
            busy={rendering}
            disabled={exportType === "srt" ? !groups.length : !outputSegments.length}
          />
          <AccountMenu />
        </div>
      </header>

      {receivingFile && (
        <div
          role="status"
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-background/85 px-6 text-center backdrop-blur-sm"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-base font-semibold">กำลังรับคลิปจากเครื่อง…</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            คลิปยาวหรือ 4K จาก iPhone อาจใช้เวลาสักครู่ กรุณาอย่าปิดหน้านี้
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              pickerOpenRef.current = false;
              setReceivingFile(false);
            }}
          >
            ยกเลิก
          </Button>
        </div>
      )}

      {job && (
        <div className="mx-auto w-full max-w-[1500px] shrink-0 px-2 pt-2 sm:px-6 sm:pt-4">
          <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-3 py-1.5 sm:p-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="truncate">{job.label}</span>
                <span>{Math.round((job.ratio ?? 0) * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(job.ratio ?? 0) * 100}%` }}
                />
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={cancelJob}>
              ยกเลิก
            </Button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "mx-auto flex min-h-0 w-full min-w-0 max-w-[1600px] flex-1 flex-col gap-2 overflow-hidden p-2 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:gap-3 sm:p-3 sm:pb-[calc(4.25rem+env(safe-area-inset-bottom))] lg:grid lg:gap-3 lg:p-3 lg:pb-3",
          // Desktop (as in the editor design): menu · wide work panel · video,
          // the word timeline across the whole bottom. Selecting a word, text
          // or sticker opens its settings as an extra column beside the panel.
          desktopInspector
            ? "lg:grid-cols-[184px_minmax(0,1fr)_320px_minmax(340px,440px)]"
            : "lg:grid-cols-[184px_minmax(0,1fr)_minmax(340px,440px)]",
          // The timeline row exists only once a clip is loaded.
          duration > 0 ? "lg:grid-rows-[minmax(0,1fr)_auto]" : "lg:grid-rows-[minmax(0,1fr)]",
        )}
      >
        {/* Desktop menu */}
        <nav
          aria-label="เมนูเครื่องมือ"
          className="studio-panel hidden min-h-0 flex-col gap-1 overflow-y-auto rounded-2xl border border-border bg-card p-2.5 lg:col-start-1 lg:row-start-1 lg:flex"
        >
          {SECTIONS.map(({ id, label, short, tab: target, icon: Icon }) => {
            const current = sectionOf(tab) === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={current ? "page" : undefined}
                onClick={() => {
                  if (!current) setTab(target);
                  play("hover");
                }}
                title={label}
                className={cn(
                  "flex h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors",
                  current
                    ? "bg-accent font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className={cn("h-[18px] w-[18px] shrink-0", current && "text-primary")} />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
          <div className="mt-auto border-t border-border px-3 pt-3 text-xs text-muted-foreground">
            ภาษาของคลิป
            <span className="mt-1 block text-sm font-semibold text-foreground">
              {LANGUAGES.find((language) => language.code === languages[0])?.label ?? "-"}
            </span>
          </div>
        </nav>

        {/* Controls panel */}
        <section
          ref={panelRef}
          className="studio-panel order-3 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-3 sm:p-5 lg:order-none lg:col-start-2 lg:row-start-1 lg:rounded-2xl lg:p-5"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 empty:hidden sm:mb-4">
            <h2 className="hidden text-lg font-bold sm:block">
              {SECTIONS.find((s) => s.id === sectionOf(tab))?.label}
            </h2>
            {(sectionOf(tab) === "captions" || sectionOf(tab) === "scenes") && (
              <div
                role="group"
                aria-label="มุมมองย่อย"
                className="flex rounded-lg bg-secondary p-1"
              >
                {(
                  (sectionOf(tab) === "captions"
                    ? [
                        ["text", "แก้คำ"],
                        ["accuracy", "ความแม่นยำ & คลังคำ"],
                      ]
                    : [
                        ["scenes", "ซีน & B-roll"],
                        ["stickers", "ข้อความ & สติกเกอร์"],
                      ]) as [Tab, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      tab === key
                        ? "bg-card font-semibold text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {tab === "tools" && (
            <div className="space-y-8">
              <section aria-labelledby="ai-tools-heading">
                {/* The panel header already says "เครื่องมือ AI". */}
                <h2 id="ai-tools-heading" className="sr-only">
                  เครื่องมือ AI
                </h2>

                <div className="divide-y divide-border">
                  <div className="py-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                        <Captions className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">AI Captions</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          ถอดเสียงและสร้างซับอัตโนมัติ ปรับได้ทีละคำ
                        </p>
                      </div>
                      <Switch
                        className="mt-1 shrink-0"
                        checked={captionsOn}
                        onCheckedChange={setCaptionsOn}
                        aria-label="เปิดคำบรรยาย"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 sm:ml-[52px]">
                      <Button
                        size="sm"
                        onClick={runTranscribe}
                        disabled={transcribing || !file || analyzing}
                      >
                        {transcribing || analyzing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        สร้างซับด้วย AI
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setTab("styles")}>
                        สไตล์
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setTab("text")}>
                        แก้ไข
                      </Button>
                      {analyzing ? (
                        <span className="basis-full text-xs text-muted-foreground">
                          กำลังเตรียมไฟล์เสียง…
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 ml-0 border-l-2 border-primary/20 pl-3 sm:ml-[52px]">
                      <Label className="text-[11px] uppercase text-muted-foreground">
                        ภาษาต้นฉบับในวิดีโอ
                      </Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {LANGUAGES.map((language) => (
                          <Button
                            key={language.code}
                            size="sm"
                            variant={languages[0] === language.code ? "default" : "outline"}
                            onClick={() => {
                              setLanguages((current) => [
                                language.code,
                                ...current.filter((code) => code !== language.code),
                              ]);
                              setStyle((current) => ({ ...current, fontFamily: language.font }));
                            }}
                          >
                            {language.label}
                          </Button>
                        ))}
                      </div>
                      {languages[0] === "lo" && (
                        <Accordion type="single" collapsible className="mt-3">
                          <AccordionItem value="glossary" className="border-0">
                            <AccordionTrigger className="text-xs text-muted-foreground hover:no-underline">
                              ตั้งค่าขั้นสูง
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="max-w-xl space-y-1.5">
                                <Label className="text-[11px] uppercase text-muted-foreground">
                                  คำศัพท์ / ชื่อเฉพาะภาษาลาว
                                </Label>
                                <Textarea
                                  value={glossary}
                                  onChange={(event) => setGlossary(event.target.value)}
                                  rows={3}
                                  placeholder="ใส่ชื่อคน สถานที่ แบรนด์ หรือคำเฉพาะ คั่นด้วย comma หรือขึ้นบรรทัดใหม่"
                                />
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                        <Type className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Viral Text</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          เพิ่มข้อความดึงดูดสายตาในแต่ละซีน
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setTab("scenes")}>
                      แก้ไข
                    </Button>
                  </div>

                  <div className="py-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                        <AudioLines className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">เสียงประกอบ</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          เพิ่มจังหวะเสียงให้ข้อความและการเปลี่ยนซีน
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => setTab("audio")}
                      >
                        แก้ไข
                      </Button>
                      <Switch
                        className="mt-1 shrink-0"
                        checked={sfx.enabled}
                        onCheckedChange={(enabled) =>
                          setSfx((current) => ({ ...current, enabled }))
                        }
                        aria-label="เปิดเสียงประกอบ"
                      />
                    </div>
                    <div className="mt-4 ml-0 space-y-2 border-l-2 border-primary/20 pl-3 sm:ml-[52px]">
                      <Label className="flex justify-between text-xs text-muted-foreground">
                        <span>ระดับเสียงประกอบ</span>
                        <span className="font-mono text-foreground">
                          {Math.round(sfx.volume * 100)}%
                        </span>
                      </Label>
                      <Slider
                        value={[sfx.volume * 100]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={([volume]) =>
                          setSfx((current) => ({ ...current, volume: (volume ?? 35) / 100 }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                        <Zap className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Motion Graphic</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          เพิ่มองค์ประกอบเคลื่อนไหวให้ซีน
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setTab("stickers")}>
                      แก้ไข
                    </Button>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                        <Clapperboard className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">B-roll</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          เพิ่มภาพประกอบให้แต่ละช่วงของวิดีโอ
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setTab("scenes")}>
                      แก้ไข
                    </Button>
                  </div>
                </div>
              </section>

              <section
                className="border-t border-border pt-6"
                aria-labelledby="video-tools-heading"
              >
                <div className="mb-1">
                  <h2 id="video-tools-heading" className="text-base font-bold text-foreground">
                    ปรับแต่งวิดีโอ
                  </h2>
                </div>
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                        <Waves className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">ลดเสียงรบกวน</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                          กรองเสียงต่ำ เสียงฮัม และปรับระดับเสียงพูดให้นิ่งขึ้น
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={noiseReduction}
                      onCheckedChange={setNoiseReduction}
                      aria-label="ลดเสียงรบกวน"
                    />
                  </div>
                </div>
              </section>

              <section
                className="border-t border-border pt-6"
                aria-labelledby="caption-actions-heading"
              >
                <h2
                  id="caption-actions-heading"
                  className="mb-4 text-sm font-semibold text-foreground"
                >
                  ภาษาและการแปล
                </h2>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                      <Wand2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">แปลซับด้วย AI</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        แปลข้อความโดยคงจังหวะเวลาเดิม
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-2">
                    {words.length ? (
                      LANGUAGES.map((language) => (
                        <Button
                          key={language.code}
                          aria-label={`แปลเป็น ${language.label}`}
                          size="sm"
                          variant="outline"
                          disabled={translating || !words.length}
                          onClick={() => void translateCaptions(language.code)}
                        >
                          {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{" "}
                          แปลเป็น {language.label}
                        </Button>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        สร้างซับก่อนเลือกภาษาแปล
                      </span>
                    )}
                  </div>
                </div>
              </section>

              <section className="border-t border-border pt-4" aria-labelledby="saved-work-heading">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground">
                    <Save className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 id="saved-work-heading" className="text-sm font-semibold">
                      งานที่บันทึกไว้
                    </h2>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {savedInfo
                        ? `บันทึกล่าสุด: ${savedInfo.fileName} · ${new Date(savedInfo.savedAt).toLocaleString()}`
                        : "ระบบบันทึกช่วงที่ตัดและซับที่แก้ให้อัตโนมัติ"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          saveProject(snapshot());
                          setSavedInfo(loadProject());
                          toast.success("บันทึกงานแล้ว");
                        }}
                      >
                        บันทึกตอนนี้
                      </Button>
                      <Button size="sm" variant="outline" onClick={restoreProject}>
                        โหลดงานกลับ
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          clearProject();
                          setSavedInfo(null);
                          toast.success("ลบงานที่บันทึกแล้ว");
                        }}
                      >
                        ล้างงานที่บันทึก
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              <Button variant="secondary" className="w-full" onClick={() => setTab("export")}>
                <Download className="h-4 w-4" /> ไปที่หน้า Export
              </Button>
            </div>
          )}

          {tab === "stickers" && (
            <Button className="mb-3 w-full" onClick={addTextLayer} disabled={!videoUrl}>
              <Type className="mr-2 h-4 w-4" /> เพิ่มข้อความ
            </Button>
          )}
          {tab === "stickers" && (
            <StickerPanel
              stickers={stickers}
              time={time}
              duration={duration}
              selectedId={selectedSticker}
              onSelect={(id) => {
                setSelectedSticker(id);
                const picked = stickers.find((s) => s.id === id);
                if (picked && (time < picked.start || time > picked.end))
                  seekTo(picked.start + 0.05);
              }}
              onAdd={(sticker) => {
                setStickers((current) => [...current, sticker]);
                setSelectedSticker(sticker.id);
              }}
              onChange={updateSticker}
              onRemove={removeSticker}
              onAutoEmoji={() => {
                const suggested = suggestEmojiStickers(visibleWords);
                if (!suggested.length) {
                  toast.info("ไม่พบคำที่เข้ากับอิโมจิในซับ ลองเลือกเพิ่มเองได้เลย");
                  return;
                }
                setStickers((current) => [...current, ...suggested]);
                toast.success(`ใส่อิโมจิแล้ว ${suggested.length} จุด`);
              }}
              canAuto={visibleWords.length > 0}
            />
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
              onUpdateElementMotionKind={updateElementMotionKind}
              onUpdateElementLayout={updateElementLayout}
              onUpdateElementAsset={updateElementAsset}
              onSplitScene={splitScene}
            />
          )}

          {tab === "export" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs">
                พร้อมส่งออก: ความยาว {keptDuration(outputSegments).toFixed(1)}s · ซับ{" "}
                {groups.length} บล็อก
              </div>

              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                <p className="mb-1 text-sm font-medium">
                  ส่งออกวิดีโอสำเร็จรูป (ไม่ต้องใช้ CapCut)
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  ฝังซับลงในภาพตามสไตล์ปัจจุบัน (ไม่รวมซีนที่ปิดไว้) โพสต์ลง TikTok / Reels ได้ทันที
                </p>
                <div className="mb-3 space-y-2">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    ความละเอียดที่ส่งออก
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: "source", label: "ต้นฉบับ" },
                        { id: "4k", label: "4K (ไม่แนะนำ)" },
                        { id: "1080", label: "1080 (HD)" },
                        { id: "720", label: "720" },
                      ] as { id: ExportResolution; label: string }[]
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setResolution(option.id);
                          const v = videoRef.current;
                          if (v?.videoWidth) {
                            const t = targetSize(v.videoWidth, v.videoHeight, option.id);
                            if (t.upscaled) {
                              toast.warning(
                                `ต้นฉบับ ${v.videoWidth}x${v.videoHeight} เล็กกว่า ${t.width}x${t.height} — เป็นการขยายภาพ (upscale) ไม่ได้เพิ่มรายละเอียดจริง`,
                              );
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
                    ใช้ได้เฉพาะปุ่ม "เรนเดอร์วิดีโอพร้อมซับ" (เรนเดอร์ผ่าน canvas) — ไฟล์ .webm และ
                    CapCut Package ยังใช้ความละเอียดต้นฉบับ
                  </p>
                  {resolution === "4k" ? (
                    <p className="text-[11px] text-amber-500">
                      จากการทดสอบจริง เครื่องส่วนใหญ่เรนเดอร์ 4K ผ่านเบราว์เซอร์ได้เพียง ~6–12fps
                      ระบบจะลด fps ให้อัตโนมัติเพื่อให้ภาพเดินสม่ำเสมอแทนที่จะเฟรมหลุดเป็นช่วง ๆ
                      แนะนำให้ใช้ 1080 สำหรับงานจริง
                    </p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  onClick={() => exportFinalVideo(captionsOn ? "captions" : "clean")}
                  disabled={rendering || !outputSegments.length}
                >
                  {rendering ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  เรนเดอร์วิดีโอพร้อมซับ
                </Button>
              </div>

              <div className="rounded-xl border border-border p-4">
                <p className="mb-1 text-sm font-medium">ส่งออกเข้า CapCut / โปรแกรมตัดต่อ</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  ดาวน์โหลดแพ็กเกจเดียวที่มีวิดีโอ + SRT ซึ่งใช้ไทม์ไลน์เดียวกัน แล้ว Import
                  ทั้งสองไฟล์เข้า CapCut
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={exportCapCutPackage}
                    disabled={rendering || !outputSegments.length || !groups.length}
                  >
                    {rendering ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    CapCut Package .zip
                  </Button>
                  <Button size="sm" variant="secondary" onClick={exportSrt}>
                    <FileDown className="mr-2 h-4 w-4" /> .srt
                  </Button>
                  <Button
                    size="sm"
                    onClick={exportTrimmedVideo}
                    disabled={rendering || !outputSegments.length}
                  >
                    {rendering ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    วิดีโอ .webm
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

          {(tab === "styles" || tab === "customize") && (
            <div className="mb-5 flex items-center gap-2 border-b border-border">
              <div className="grid min-w-0 flex-1 grid-cols-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setTab("styles")}
                  className={cn(
                    "relative h-12 rounded-none px-2 text-sm text-muted-foreground shadow-none",
                    tab === "styles" &&
                      "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary",
                  )}
                >
                  เลือกสไตล์
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setTab("customize")}
                  className={cn(
                    "relative h-12 rounded-none px-2 text-sm text-muted-foreground shadow-none",
                    tab === "customize" &&
                      "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary",
                  )}
                >
                  แก้คำบรรยาย
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setTab("customize")}
                className="mb-1 hidden shrink-0 sm:inline-flex"
              >
                <SlidersHorizontal /> ปรับแต่ง Ani
              </Button>
            </div>
          )}

          {(tab === "styles" || tab === "customize") && (
            <div className="mb-5">
              <CaptionLayoutControls
                style={style}
                onChange={(patch) => setStyle((current) => ({ ...current, ...patch }))}
              />
              <div className="mt-4">
                <CaptionColorControls
                  style={style}
                  onChange={(patch) => setStyle((current) => ({ ...current, ...patch }))}
                />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                อยากให้บางคำเป็นสีอื่น: ไปที่ ซับไตเติล → แตะคำ → เลือก “สีของคำนี้”
              </p>
            </div>
          )}

          {tab === "styles" && (
            <StylePicker
              activeId={style.id}
              activeStyle={style}
              language={languages[0] ?? "th"}
              onChange={(patch) => setStyle((current) => ({ ...current, ...patch }))}
              onSelect={(preset) => {
                setStyle((current) => ({
                  ...preset,
                  captionMode: current.captionMode ?? preset.captionMode,
                  joinWords: current.joinWords ?? preset.joinWords,
                  // presets on the default Latin font keep the font picked for the language
                  fontFamily:
                    preset.fontFamily === baseStyle.fontFamily
                      ? current.fontFamily
                      : preset.fontFamily,
                }));
                void play(preset.animation);
                toast.success(`ใช้สไตล์ ${preset.name}`);
              }}
            />
          )}

          {tab === "customize" && (
            <div className="space-y-5">
              <StyleControls
                style={style}
                onChange={(p) => {
                  setStyle((s) => ({ ...s, ...p }));
                  if (p.animation) void play(p.animation);
                }}
                scripts={languages.map((c) => (c === "en" ? "latin" : c))}
                lineCount={Math.max(2, previewLineCount)}
                language={languages[0] ?? "th"}
              />
              <Accordion type="single" collapsible className="border-t border-border">
                <AccordionItem value="caption-languages" className="border-b-0">
                  <AccordionTrigger className="hover:no-underline">ภาษาและฟอนต์</AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      ภาษา (เลือกเพิ่ม/เอาออกได้)
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map((l) => {
                        const on = languages.includes(l.code);
                        return (
                          <Button
                            key={l.code}
                            type="button"
                            size="sm"
                            variant={on ? "default" : "secondary"}
                            onClick={() => {
                              const next = on
                                ? languages.filter((c) => c !== l.code)
                                : [...languages, l.code];
                              if (!next.length) {
                                toast.error("ต้องเลือกอย่างน้อย 1 ภาษา");
                                return;
                              }
                              setLanguages(next);
                              if (!on) setStyle((s) => ({ ...s, fontFamily: l.font }));
                            }}
                          >
                            {l.label}
                          </Button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ภาษาแรกที่เลือกจะใช้ถอดเสียง และรายชื่อฟอนต์จะกรองตามภาษาที่เลือก
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {tab === "text" && (
            <div className="space-y-5">
              <CaptionList
                groups={groups}
                words={words}
                duration={duration}
                activeIndex={activeGroupIndex}
                selected={selectedWord != null && selectedWord < words.length ? selectedWord : null}
                onSelect={setSelectedWord}
                onSeek={seekTo}
                onPreview={previewRange}
                onChange={updateWords}
                onRetranscribe={(start, end) => void retranscribeRange(start, end)}
                busy={retryingSync}
                popoverEdit={false}
              />

              {words.some((w) => w.confidenceLabel === "low" || w.confidenceLabel === "review") && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <span className="min-w-0 flex-1">
                    มี{" "}
                    {
                      words.filter(
                        (w) => w.confidenceLabel === "low" || w.confidenceLabel === "review",
                      ).length
                    }{" "}
                    คำที่ AI ไม่แน่ใจ (ขีดเส้นใต้สีเหลือง)
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => setTab("accuracy")}>
                    ตรวจทีละคำ
                  </Button>
                </div>
              )}

              <Accordion type="multiple" className="border-t border-border">
                <AccordionItem value="bulk-text">
                  <AccordionTrigger className="text-sm">
                    แก้ทั้งข้อความในครั้งเดียว
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      การอัปเดตส่วนนี้จะคำนวณเวลาของคำใหม่ทั้งคลิป
                    </p>
                    <Textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      rows={10}
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
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="advanced-words">
                  <AccordionTrigger className="text-sm">
                    เครื่องมือคำขั้นสูง (แยก/รวมคำ, ตรวจซิงก์)
                  </AccordionTrigger>
                  <AccordionContent>
                    <WordTimelineEditor
                      words={words}
                      duration={duration}
                      onChange={updateWords}
                      onPreview={previewRange}
                      onRetryIssues={(issues) => void retrySyncIssues(issues)}
                      retrying={retryingSync}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
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
                    toast.success(
                      ruled.changed ? `แก้คำตามกฎ ${ruled.changed} จุด` : "ไม่พบคำที่ต้องแก้ตามกฎ",
                    );
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
        <section
          className={cn(
            "order-1 min-w-0 shrink-0 lg:order-none lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col",
            desktopInspector ? "lg:col-start-4" : "lg:col-start-3",
          )}
        >
          <div className="studio-panel rounded-xl border border-border bg-card p-2 sm:p-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            {expanded && (
              <>
                <div className="fixed inset-0 z-[65] bg-black" aria-hidden="true" />
                <div className="fixed inset-x-0 top-0 z-[80] flex items-center justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-11 w-11 rounded-full bg-black/60 text-white hover:bg-black/80"
                    onClick={togglePlay}
                    aria-label={playing ? "หยุด" : "เล่น"}
                  >
                    {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                  <span className="rounded-full bg-black/60 px-3 py-1 font-mono text-xs text-white">
                    <Clocked clock={clock}>{(t) => fmt(t)}</Clocked> / {fmt(duration)}
                  </span>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-11 w-11 rounded-full bg-black/60 text-white hover:bg-black/80"
                    onClick={() => setExpanded(false)}
                    aria-label="ออกจากเต็มจอ"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </>
            )}
            {/* Desktop: the player fills all the height of the right column (CapCut). */}
            <div
              ref={previewSlotRef}
              className="lg:flex lg:min-h-0 lg:flex-1 lg:items-center lg:justify-center"
            >
              <div
                ref={frameRef}
                style={desktopFrameHeight ? { height: desktopFrameHeight } : undefined}
                title={
                  videoUrl
                    ? "ลากข้อความเพื่อย้าย · ลากจุดมุมเพื่อย่อ/ขยาย · ลากปุ่มด้านบนเพื่อหมุน · ดับเบิลคลิกเพื่อแก้ข้อความ"
                    : undefined
                }
                className={cn(
                  "mx-auto max-w-full overflow-hidden bg-preview",
                  tiktokPreview ? "aspect-[886/1920]" : "aspect-[9/16]",
                  expanded
                    ? "fixed left-1/2 top-1/2 z-[70] h-[100dvh] w-auto max-w-[100vw] -translate-x-1/2 -translate-y-1/2"
                    : "relative h-[26dvh] w-auto rounded-xl shadow-primary-lg ring-1 ring-primary/20 sm:h-[30dvh]",
                )}
              >
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    preload="auto"
                    // iOS Safari shows a blank box until a video has played once
                    onLoadedData={(e) => primeFirstFrame(e.currentTarget)}
                    className="h-full w-full object-cover will-change-transform"
                    playsInline
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onEnded={() => setPlaying(false)}
                    // Follow the real state: iOS can pause on its own (calls,
                    // other audio), and a play can start late.
                    onPause={(e) => {
                      if (!isPriming(e.currentTarget)) setPlaying(false);
                    }}
                    onPlaying={(e) => {
                      if (!isPriming(e.currentTarget)) setPlaying(true);
                    }}
                    onClick={togglePlay}
                  />
                ) : (
                  <button
                    onClick={() => openFilePicker()}
                    className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground"
                  >
                    <Upload className="h-6 w-6" />
                    แตะเพื่ออัปโหลดคลิป
                  </button>
                )}
                {/* Only the preview layers follow every clock tick. */}
                <Clocked clock={clock}>
                  {(t) => (
                    <>
                      <BrollOverlay
                        scenes={scenes}
                        sceneElements={sceneElements}
                        time={t}
                        playing={playing}
                      />
                      {captionsOn && (
                        <CaptionOverlay
                          group={groups.find((g) => t >= g.start && t <= g.end) ?? null}
                          time={t}
                          style={style}
                          height={frameHeight}
                          safeArea={tiktokPreview}
                          onPositionChange={({ posX, posY }) =>
                            setStyle((current) => ({ ...current, posX, posY }))
                          }
                          onEditText={(text) => editActiveGroupText(text)}
                          onTransform={(patch) => setStyle((current) => ({ ...current, ...patch }))}
                          showHandles={!playing && !(tab === "stickers" && selectedSticker)}
                        />
                      )}
                      <ViralTextOverlay
                        scenes={scenes}
                        sceneElements={sceneElements}
                        time={t}
                        height={frameHeight}
                      />
                      {stickers.length > 0 && (
                        <StickerOverlay
                          stickers={stickers}
                          time={t}
                          width={frameWidth}
                          height={frameHeight}
                          selectedId={selectedSticker}
                          onSelect={setSelectedSticker}
                          onChange={updateSticker}
                          onRemove={removeSticker}
                          onEdit={editTextLayer}
                          interactive={!playing}
                        />
                      )}
                    </>
                  )}
                </Clocked>
                {tiktokPreview && <TikTokSafeAreaOverlay />}
              </div>
            </div>

            {debugPlayback && <PlaybackDebug videoRef={videoRef} />}
            <div className="mt-2 space-y-2 lg:mt-4 lg:space-y-3">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:gap-y-3">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-10 w-10 shrink-0"
                  onClick={togglePlay}
                  disabled={!videoUrl}
                  aria-label={playing ? "หยุด" : "เล่น"}
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Clocked clock={clock}>
                  {(t) => (
                    <Slider
                      className="min-w-0 flex-1 lg:order-first lg:basis-full"
                      value={[t]}
                      min={0}
                      max={Math.max(duration, 0.1)}
                      step={0.01}
                      aria-label="ตำแหน่งวิดีโอ"
                      onValueChange={([v]) => {
                        if (videoRef.current) videoRef.current.currentTime = v ?? 0;
                      }}
                    />
                  )}
                </Clocked>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground sm:text-xs lg:flex-1">
                  <Clocked clock={clock}>{(t) => fmt(t)}</Clocked>
                  <span className="hidden sm:inline"> / {fmt(duration)}</span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-10 shrink-0 gap-1 px-2.5 font-semibold"
                  onClick={addTextLayer}
                  disabled={!videoUrl}
                  aria-label="เพิ่มข้อความ"
                  title="เพิ่มข้อความ"
                >
                  <Type className="h-4 w-4" />
                  <span className="hidden sm:inline lg:hidden 2xl:inline">ข้อความ</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    if (videoRef.current) videoRef.current.muted = next;
                  }}
                  disabled={!videoUrl}
                  aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                {/* Desktop: TikTok safe-area frame toggle sits with the player controls. */}
                <label className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground lg:flex">
                  <Smartphone className="h-4 w-4" />
                  <span className="hidden 2xl:inline">TikTok</span>
                  <Switch
                    checked={tiktokPreview}
                    onCheckedChange={setTiktokPreview}
                    aria-label="เปิดพรีวิว TikTok"
                  />
                </label>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  onClick={() => setExpanded(true)}
                  disabled={!videoUrl}
                  aria-label="ขยายเต็มจอ"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Desktop: settings for the selection, on the right */}
        {desktopInspector && (
          <Inspector
            className="hidden lg:col-start-3 lg:row-start-1 lg:block"
            words={words}
            duration={duration}
            selectedWord={selectedWordValid}
            lineRange={selectedLineRange}
            sticker={stickers.find((sticker) => sticker.id === selectedSticker) ?? null}
            stickerLabel={
              timelineLanes.stickers?.find((item) => item.id === selectedSticker)?.label ?? ""
            }
            style={style}
            busy={retryingSync}
            onWordsChange={updateWords}
            onSelectWord={setSelectedWord}
            onPreview={previewRange}
            onRetranscribe={(start, end) => void retranscribeRange(start, end)}
            onStickerChange={updateSticker}
            onStickerRemove={removeSticker}
            onStickerDuplicate={duplicateSticker}
            onStickerSplit={splitStickerAtPlayhead}
            onDetachLine={detachCaptionLine}
            onOpenStickers={() => setTab("stickers")}
            onStyleChange={(patch) => setStyle((current) => ({ ...current, ...patch }))}
          />
        )}

        {/* Phone: word timeline right under the video */}
        {duration > 0 && (
          <div className="studio-panel order-2 min-w-0 shrink-0 overflow-hidden rounded-xl border border-border bg-card lg:hidden">
            <WordTrack
              words={words}
              duration={duration}
              time={time}
              cuts={silences}
              selected={selectedWord != null && selectedWord < words.length ? selectedWord : null}
              onSelect={(index) => {
                setSelectedSticker(null);
                setSelectedWord(index);
              }}
              onSeek={seekTo}
              onRetime={retimeWord}
              onMove={moveWord}
              compact
              centered
              clock={playClock}
              lanes={timelineLanes}
              selectedSticker={selectedSticker}
              onStickerTime={(id, start, end) => updateSticker(id, { start, end })}
              onSelectSticker={(id) => {
                setSelectedWord(null);
                setSelectedSticker(id);
                setTab("stickers");
              }}
              onDeselect={() => {
                setSelectedWord(null);
                setSelectedSticker(null);
              }}
              onScrubStart={() => {
                if (playing) {
                  videoRef.current?.pause();
                  setPlaying(false);
                }
              }}
            />
          </div>
        )}

        {/* Desktop: word timeline under the menu and inspector; the preview
            runs the full height beside it, like CapCut */}
        {duration > 0 && (
          <div className="hidden min-w-0 lg:col-span-full lg:col-start-1 lg:row-start-2 lg:block">
            <div className="studio-panel overflow-hidden rounded-xl border border-border bg-card">
              <WordTrack
                words={words}
                duration={duration}
                time={time}
                cuts={silences}
                selected={selectedWord != null && selectedWord < words.length ? selectedWord : null}
                onSelect={(index) => {
                  setSelectedSticker(null);
                  setSelectedWord(index);
                }}
                onSeek={seekTo}
                onRetime={retimeWord}
                onMove={moveWord}
                clock={playClock}
                lanes={timelineLanes}
                selectedSticker={selectedSticker}
                onStickerTime={(id, start, end) => updateSticker(id, { start, end })}
                onSelectSticker={(id) => {
                  setSelectedWord(null);
                  setSelectedSticker(id);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Phone: editing a text layer */}
      {!isDesktop &&
        (() => {
          const layer = textSheet ? stickers.find((s) => s.id === textSheet) : undefined;
          return layer ? (
            <MobileTextSheet
              sticker={layer}
              onChange={(patch) => updateSticker(layer.id, patch)}
              onDuplicate={() => duplicateSticker(layer.id)}
              onRemove={() => removeSticker(layer.id)}
              onSplit={() => splitStickerAtPlayhead(layer.id)}
              onClose={() => setTextSheet(null)}
            />
          ) : null;
        })()}

      {/* Phone: tools for the selected word replace the bottom menu */}
      {!isDesktop && selectedWordValid != null && (
        <MobileWordBar
          words={words}
          index={selectedWordValid}
          duration={duration}
          lineRange={selectedLineRange}
          busy={retryingSync}
          onChange={updateWords}
          onSelect={setSelectedWord}
          onPreview={previewRange}
          onRetranscribe={(start, end) => void retranscribeRange(start, end)}
          onDetach={() => detachCaptionLine(selectedWordValid)}
        />
      )}

      {/* Phone: bottom toolbar */}
      <nav
        hidden={!isDesktop && selectedWordValid != null}
        aria-label="เมนูเครื่องมือ"
        className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-6 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {SECTIONS.map(({ id, short, tab: target, icon: Icon }) => {
          const current = sectionOf(tab) === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={current ? "page" : undefined}
              onClick={() => {
                if (!current) setTab(target);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px]",
                current ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {short}
            </button>
          );
        })}
      </nav>
    </main>
  );
}
