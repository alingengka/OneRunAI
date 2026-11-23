/**
 * The editor's "สร้างซับด้วย AI" steps (src/routes/app.tsx, runTranscribe),
 * run on the server for the Claude connector. The work is split into rounds
 * so a long clip can be finished over several requests: each round
 * transcribes the chunks it has time for and the state is saved in between.
 */
import {
  baseStyle,
  groupCaptions,
  joinCaptionWords,
  type CaptionMode,
  type Word,
} from "@/lib/captions";
import { buildSrt } from "@/lib/export";
import {
  addChunkOverlap,
  buildAsrChunks,
  defaultSilenceOptions,
  detectSpeechSegments,
  encodeSegmentsWav16k,
  refineSpeechSegments,
  smoothSpeechSegments,
  uncoveredSpeech,
  type Segment,
} from "@/lib/media/audio";
import {
  alignTextToTimingOnTimeline,
  closeSpeechGaps,
  forcedAlignWords,
  mapConcatTimeToTimeline,
  mergeAlignedChunks,
  type TimedWord,
} from "@/lib/media/forced-align";
import type { PcmBuffer } from "./wav";

export type Language = "lo" | "th" | "en";

export type TranscribeFn = (input: {
  audioBase64: string;
  language: Language;
  context: string;
  glossary: string[];
}) => Promise<{
  text: string;
  agreement: number;
  words?: TimedWord[];
  noSpeech?: boolean;
}>;

type ChunkState = {
  segs: Segment[];
  status: "pending" | "done" | "skipped" | "failed";
  attempts: number;
  text?: string;
  words?: Word[];
  measured?: TimedWord[];
};

export type JobState = {
  language: Language;
  glossary: string[];
  duration: number;
  /** Speech found in the audio, before chunking. */
  segs: Segment[];
  chunks: ChunkState[];
  /** Speech the engines skipped, sent again once every chunk is done. */
  fills: ChunkState[] | null;
  done: boolean;
};

/** How many chunks are transcribed at once, as in the editor. */
const CONCURRENCY = 3;
/** Tries per chunk before it counts as failed (the editor: 2, then 1 more). */
const MAX_ATTEMPTS = 3;

const asAudio = (buffer: PcmBuffer) => buffer as unknown as AudioBuffer;

/** Finds the speech and splits it into chunks, with the editor's settings. */
export function planJob(buffer: PcmBuffer, language: Language, glossary: string[]): JobState {
  const audio = asAudio(buffer);
  const detected = detectSpeechSegments(audio, defaultSilenceOptions);
  const segs = smoothSpeechSegments(detected, buffer.duration);
  if (!segs.length) throw new Error("ไม่พบเสียงพูดในไฟล์นี้");
  const lao = language === "lo";
  const refined = refineSpeechSegments(audio, segs, lao ? 12 : 8);
  const base = buildAsrChunks(refined, buffer.duration, {
    min: lao ? 5 : 20,
    max: lao ? 14 : 45,
    gap: lao ? 0.8 : 0.55,
    pad: lao ? 0.25 : 0.12,
  });
  const chunks = lao ? addChunkOverlap(base, buffer.duration, 0.38) : base;
  return {
    language,
    glossary,
    duration: buffer.duration,
    segs,
    chunks: chunks.map((chunk) => ({ segs: chunk, status: "pending", attempts: 0 })),
    fills: null,
    done: false,
  };
}

/** Seconds of audio a chunk sends to the AI, which is what quota counts. */
export function chunkSeconds(chunk: { segs: Segment[] }): number {
  return chunk.segs.reduce((n, s) => n + (s.end - s.start), 0);
}

async function wavBase64(buffer: PcmBuffer, segs: Segment[]): Promise<string | null> {
  const wav = encodeSegmentsWav16k(asAudio(buffer), segs, false);
  if (wav.size < 4096) return null;
  return Buffer.from(await wav.arrayBuffer()).toString("base64");
}

/** One chunk, as transcribeChunk in the editor does it. */
async function runChunk(
  buffer: PcmBuffer,
  chunk: ChunkState,
  state: JobState,
  context: string,
  transcribe: TranscribeFn,
): Promise<void> {
  chunk.attempts++;
  const audioBase64 = await wavBase64(buffer, chunk.segs);
  if (!audioBase64) {
    chunk.status = "skipped";
    return;
  }
  const res = await transcribe({
    audioBase64,
    language: state.language,
    context,
    glossary: state.glossary,
  });
  if (res.noSpeech) {
    chunk.status = "skipped";
    return;
  }
  const text = (res.text ?? "").trim();
  if (!text) throw new Error("empty");
  const measured = (res.words ?? []).map((word) => {
    const start = mapConcatTimeToTimeline(word.start, chunk.segs);
    return {
      text: word.text,
      start,
      end: Math.max(start + 0.06, mapConcatTimeToTimeline(word.end, chunk.segs)),
    };
  });
  const timed = alignTextToTimingOnTimeline(text, res.words ?? [], chunk.segs);
  const words = (
    timed ?? forcedAlignWords(asAudio(buffer), chunk.segs, text, chunkSeconds(chunk))
  ).map((word) => {
    const confidence = Math.max(
      0.15,
      Math.min(0.99, (word.confidence ?? 0.5) * 0.62 + res.agreement * 0.38),
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
  });
  chunk.status = "done";
  chunk.text = text;
  chunk.words = words;
  chunk.measured = measured;
}

/** Text already transcribed before chunk `index`, as spelling context. */
function contextBefore(state: JobState, index: number): string {
  return state.chunks
    .slice(0, index)
    .filter((chunk) => chunk.status === "done")
    .map((chunk) => chunk.text ?? "")
    .join(" ")
    .slice(-600);
}

function mergedWords(state: JobState): Word[] {
  let words: Word[] = [];
  for (const chunk of state.chunks) {
    if (chunk.status === "done" && chunk.words?.length) {
      words = mergeAlignedChunks(words, chunk.words);
    }
  }
  return words;
}

export type RoundOptions = {
  transcribe: TranscribeFn;
  /** Stop starting new chunks after this time (ms since epoch). */
  deadline: number;
  /** Called before a chunk is sent; returns a refund for when it fails. */
  reserve?: (seconds: number) => Promise<() => Promise<void>>;
  /** Errors that must stop the job (no quota) instead of counting as a failed try. */
  isFatal?: (error: unknown) => boolean;
};

async function runList(
  buffer: PcmBuffer,
  state: JobState,
  list: ChunkState[],
  context: (index: number) => string,
  opts: RoundOptions,
): Promise<void> {
  const todo = list
    .map((chunk, index) => ({ chunk, index }))
    .filter(({ chunk }) => chunk.status === "pending");
  let next = 0;
  let fatal: unknown = null;
  const lane = async () => {
    while (next < todo.length && fatal === null && Date.now() < opts.deadline) {
      const { chunk, index } = todo[next++]!;
      const refund = opts.reserve
        ? await opts.reserve(chunkSeconds(chunk)).catch((e) => {
            fatal ??= e;
            return null;
          })
        : async () => undefined;
      if (!refund) return;
      try {
        await runChunk(buffer, chunk, state, context(index), opts.transcribe);
      } catch (error) {
        await refund().catch(() => undefined);
        if (opts.isFatal?.(error)) {
          chunk.attempts--;
          fatal ??= error;
          return;
        }
        if (chunk.attempts >= MAX_ATTEMPTS) chunk.status = "failed";
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, lane));
  if (fatal !== null) throw fatal;
}

/**
 * Transcribes what fits before the deadline. When every chunk is done it
 * sends the skipped speech again, then marks the job done.
 */
export async function runRound(buffer: PcmBuffer, state: JobState, opts: RoundOptions) {
  // Pending chunks first, then failed tries again, as the editor does.
  const pending = (list: ChunkState[]) => list.some((chunk) => chunk.status === "pending");
  // Each pass uses up a try of every chunk it sends, so this ends.
  while (pending(state.chunks) && Date.now() < opts.deadline) {
    await runList(buffer, state, state.chunks, (i) => contextBefore(state, i), opts);
  }
  if (pending(state.chunks)) return;

  if (!state.fills) {
    const pad = 0.2;
    state.fills = uncoveredSpeech(state.segs, mergedWords(state))
      .slice(0, 8)
      .map((gap) => ({
        segs: [
          { start: Math.max(0, gap.start - pad), end: Math.min(state.duration, gap.end + pad) },
        ],
        status: "pending" as const,
        // one try only: this is a safety net
        attempts: MAX_ATTEMPTS - 1,
      }));
  }
  if (Date.now() >= opts.deadline) return;
  await runList(buffer, state, state.fills, () => "", opts);
  if (pending(state.fills)) return;
  state.done = true;
}

export function jobProgress(state: JobState): { done: number; total: number } {
  const all = [...state.chunks, ...(state.fills ?? [])];
  return {
    done: all.filter((chunk) => chunk.status !== "pending").length,
    total: all.length,
  };
}

export type JobResult = {
  srt: string;
  text: string;
  /** Time ranges no engine could transcribe, in seconds. */
  failed: Segment[];
};

/** The finished subtitles, grouped into lines as the editor does by default. */
export function jobResult(
  state: JobState,
  opts: { captionMode?: CaptionMode; wordsPerCaption?: number } = {},
): JobResult {
  let words = mergedWords(state);
  // Fill-ins go only where no word is yet, as in the editor.
  for (const fill of state.fills ?? []) {
    const extra = (fill.words ?? []).filter(
      (word) =>
        !words.some((other) => word.start < other.end - 0.02 && word.end > other.start + 0.02),
    );
    if (extra.length) words = [...words, ...extra].sort((a, b) => a.start - b.start);
  }
  const measured = state.chunks
    .flatMap((chunk) => chunk.measured ?? [])
    .sort((a, b) => a.start - b.start);
  words = closeSpeechGaps(words, state.segs, measured.length ? { heard: measured } : {});
  const groups = groupCaptions(words, {
    captionMode: opts.captionMode ?? baseStyle.captionMode,
    wordsPerGroup: opts.wordsPerCaption ?? baseStyle.wordsPerGroup,
  });
  const failed = state.chunks
    .filter((chunk) => chunk.status === "failed")
    .map((chunk) => ({
      start: chunk.segs[0]?.start ?? 0,
      end: chunk.segs[chunk.segs.length - 1]?.end ?? 0,
    }));
  return {
    srt: buildSrt(groups),
    text: groups.map((group) => joinCaptionWords(group.words).replace(/\n/g, " ")).join("\n"),
    failed,
  };
}
