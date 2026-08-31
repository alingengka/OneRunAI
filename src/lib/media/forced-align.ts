import { alignWordsToSegments, speechWeight, tokenizeWords } from "@/lib/captions";
import type { Word } from "@/lib/captions";
import type { Segment } from "./audio";

type Frame = { time: number; energy: number; segment: number };

const HOP = 0.01; // 10 ms
const WIN = 0.025; // 25 ms

/**
 * Build a perceptual energy envelope over the given speech segments only.
 * Frame times stay in the ORIGINAL clip timeline so word times remain usable
 * after dead-air removal remapping.
 */
function envelope(buffer: AudioBuffer, segs: Segment[]): Frame[] {
  const sr = buffer.sampleRate;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const win = Math.max(128, Math.round(sr * WIN));
  const hop = Math.max(64, Math.round(sr * HOP));
  const frames: Frame[] = [];

  for (let segment = 0; segment < segs.length; segment++) {
    const seg = segs[segment];
    if (!seg) continue;
    const from = Math.max(0, Math.floor(seg.start * sr));
    const to = Math.min(buffer.length, Math.ceil(seg.end * sr));
    for (let i = from; i < to; i += hop) {
      const end = Math.min(i + win, to);
      let sum = 0;
      let n = 0;
      for (const data of channels) {
        let previous = data[Math.max(0, i - 1)] ?? 0;
        for (let j = i; j < end; j++) {
          const v = data[j] ?? 0;
          const hp = v - previous * 0.97; // pre-emphasis: favour speech band
          previous = v;
          sum += hp * hp;
          n++;
        }
      }
      if (!n) continue;
      // sqrt(RMS) ≈ loudness; keeps quiet Lao syllables from collapsing to zero
      frames.push({ time: i / sr, energy: Math.sqrt(Math.sqrt(sum / n)), segment });
    }
  }
  return frames;
}

/** Smooth the envelope so a single noisy frame is not read as a syllable edge. */
function smoothed(frames: Frame[]): number[] {
  return frames.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - 1); k <= Math.min(frames.length - 1, i + 1); k++) {
      sum += frames[k]?.energy ?? 0;
      n++;
    }
    return sum / Math.max(1, n);
  });
}

/**
 * Forced alignment of a transcript to audio.
 *
 * Instead of spreading tokens evenly over speech time, tokens are distributed
 * over *accumulated acoustic energy*: a token that carries more spoken sound
 * gets more time, pauses and low-energy tails cost almost nothing. Boundaries
 * are then snapped to the nearest local energy valley (syllable break), which
 * is what makes unspaced scripts like Lao and Thai land on the actual beat of
 * the speech.
 */
export function forcedAlignWords(
  buffer: AudioBuffer,
  segs: Segment[],
  text: string,
  fallbackDuration: number,
): Word[] {
  const tokens = tokenizeWords(text);
  if (!tokens.length) return [];
  const useSegs = segs.filter((s) => s.end - s.start > 0.02);
  if (!useSegs.length) return alignWordsToSegments(text, segs, fallbackDuration);

  const frames = envelope(buffer, useSegs);
  if (frames.length < tokens.length + 2) {
    return alignWordsToSegments(text, useSegs, fallbackDuration);
  }
  const energy = smoothed(frames);
  const floor = [...energy].sort((a, b) => a - b)[Math.floor(energy.length * 0.1)] ?? 0;

  // cumulative energy above the noise floor
  const cumulative: number[] = new Array(frames.length);
  let total = 0;
  for (let i = 0; i < frames.length; i++) {
    total += Math.max(0, (energy[i] ?? 0) - floor);
    cumulative[i] = total;
  }
  if (total <= 0) return alignWordsToSegments(text, useSegs, fallbackDuration);

  const weights = tokens.map(speechWeight);
  const weightTotal = weights.reduce((sum, w) => sum + w, 0) || 1;

  // frame index where cumulative energy first reaches `target`
  const frameAt = (target: number): number => {
    let lo = 0;
    let hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((cumulative[mid] ?? 0) < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  // snap a boundary to the lowest-energy frame nearby (syllable valley)
  const snap = (index: number, minIndex: number): number => {
    const radius = 5; // ±50 ms
    let best = index;
    let bestEnergy = Number.POSITIVE_INFINITY;
    for (let k = Math.max(minIndex, index - radius); k <= Math.min(frames.length - 1, index + radius); k++) {
      const e = energy[k] ?? 0;
      if (e < bestEnergy) {
        bestEnergy = e;
        best = k;
      }
    }
    return best;
  };

  const words: Word[] = [];
  let previousIndex = 0;
  let cumulativeWeight = 0;

  tokens.forEach((token, i) => {
    cumulativeWeight += weights[i] ?? 0;
    const rawIndex = frameAt((cumulativeWeight / weightTotal) * total);
    const index =
      i === tokens.length - 1 ? frames.length - 1 : Math.max(previousIndex + 1, snap(rawIndex, previousIndex + 1));

    const startFrame = frames[previousIndex];
    const endFrame = frames[Math.min(frames.length - 1, index)];
    const start = startFrame?.time ?? useSegs[0]!.start;
    let end = (endFrame?.time ?? start) + HOP;

    // never let a word bleed across a silence gap between segments
    const seg = useSegs[startFrame?.segment ?? 0];
    if (seg && end > seg.end) end = seg.end;
    if (startFrame && endFrame && startFrame.segment !== endFrame.segment) end = seg?.end ?? end;
    if (end < start + 0.08) end = start + 0.08;

    const boundaryEnergy = energy[Math.min(frames.length - 1, index)] ?? floor;
    const localStart = Math.max(0, index - 5);
    const localEnd = Math.min(energy.length - 1, index + 5);
    let localPeak = floor;
    for (let k = localStart; k <= localEnd; k++) localPeak = Math.max(localPeak, energy[k] ?? floor);
    const valleyFit = localPeak > floor ? 1 - Math.min(1, Math.max(0, boundaryEnergy - floor) / (localPeak - floor)) : 0.5;
    const duration = end - start;
    const durationFit = Math.max(0, 1 - Math.abs(duration - Math.min(0.72, 0.18 + (weights[i] ?? 1) * 0.12)) / 0.9);
    const confidence = Math.max(0.2, Math.min(0.98, valleyFit * 0.55 + durationFit * 0.45));
    words.push({
      text: token,
      start,
      end,
      confidence,
      confidenceLabel: confidence >= 0.78 ? "high" : confidence >= 0.52 ? "review" : "low",
    });
    previousIndex = Math.min(frames.length - 1, index);
  });

  return words;
}

/** Merge overlapping chunk alignments while preferring higher-confidence words. */
export function mergeAlignedChunks(existing: Word[], incoming: Word[]): Word[] {
  if (!existing.length) return incoming;
  if (!incoming.length) return existing;
  const overlapStart = incoming[0]?.start ?? Number.POSITIVE_INFINITY;
  const stable = existing.filter((word) => word.end <= overlapStart + 0.04);
  const overlap = existing.filter((word) => word.end > overlapStart + 0.04);
  const normalized = (value: string) => value.normalize("NFC").replace(/[\s.,!?]/g, "").toLowerCase();
  const similar = (left: string, right: string) => {
    const a = [...normalized(left)];
    const b = [...normalized(right)];
    if (!a.length || !b.length) return false;
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
      let diagonal = row[0] ?? 0;
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const above = row[j] ?? 0;
        row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = above;
      }
    }
    return 1 - (row[b.length] ?? Math.max(a.length, b.length)) / Math.max(a.length, b.length) >= 0.72;
  };
  let skip = 0;
  const max = Math.min(6, overlap.length, incoming.length);
  for (let count = max; count >= 1; count--) {
    const left = overlap.slice(-count).map((word) => normalized(word.text)).join("");
    const right = incoming.slice(0, count).map((word) => normalized(word.text)).join("");
    if (left && (left === right || similar(left, right))) { skip = count; break; }
  }
  const retainedOverlap = skip
    ? overlap
    : overlap.filter((word) => {
        const midpoint = (word.start + word.end) / 2;
        const collision = incoming.find((candidate) => midpoint >= candidate.start && midpoint <= candidate.end);
        return !collision || (word.confidence ?? 0.5) >= (collision.confidence ?? 0.5);
      });
  return [...stable, ...retainedOverlap, ...incoming.slice(skip)]
    .sort((a, b) => a.start - b.start)
    .reduce<Word[]>((result, word) => {
      const previous = result[result.length - 1];
      if (previous && normalized(previous.text) === normalized(word.text) && word.start < previous.end + 0.08) {
        if ((word.confidence ?? 0) > (previous.confidence ?? 0)) result[result.length - 1] = word;
      } else result.push(word);
      return result;
    }, []);
}

export type TimedWord = { text: string; start: number; end: number };

function normalize(value: string): string {
  return value.normalize("NFC").replace(/[\s.,!?\u2028]/g, "");
}

/** 0–1 character similarity (normalised edit distance). */
function wordSimilarity(left: string, right: string): number {
  const a = [...normalize(left)];
  const b = [...normalize(right)];
  if (!a.length || !b.length) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return Math.max(0, 1 - (row[b.length] ?? 0) / Math.max(a.length, b.length));
}

const MATCH_FLOOR = 0.55;

/**
 * Map the ensemble's winning text onto real recogniser timestamps.
 *
 * The winning transcript can come from any engine, but only ElevenLabs Scribe
 * reports measured word times. A Needleman–Wunsch style alignment pairs each
 * winning word with the closest Scribe word (approximate, cross-spelling), so
 * matched words take their real start/end. Words with no counterpart are
 * interpolated *between their two matched neighbours* (weighted by spoken
 * length), never spread over the whole clip.
 *
 * Returns null when too few words could be matched — the caller should then
 * fall back to energy-envelope forced alignment.
 */
export function alignTextToTiming(
  text: string,
  timing: TimedWord[],
  options: { minMatchRatio?: number } = {},
): Word[] | null {
  const tokens = tokenizeWords(text);
  const times = timing.filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start);
  if (!tokens.length || !times.length) return null;

  const gap = -0.45;
  const rows = tokens.length;
  const cols = times.length;
  const score: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = 1; i <= rows; i++) score[i]![0] = i * gap;
  for (let j = 1; j <= cols; j++) score[0]![j] = j * gap;
  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      const sim = wordSimilarity(tokens[i - 1] ?? "", times[j - 1]?.text ?? "");
      const diagonal = (score[i - 1]![j - 1] ?? 0) + (sim >= MATCH_FLOOR ? sim : sim - 0.6);
      score[i]![j] = Math.max(diagonal, (score[i - 1]![j] ?? 0) + gap, (score[i]![j - 1] ?? 0) + gap);
    }
  }

  const pairs = new Map<number, TimedWord>();
  let i = rows;
  let j = cols;
  while (i > 0 && j > 0) {
    const sim = wordSimilarity(tokens[i - 1] ?? "", times[j - 1]?.text ?? "");
    const diagonal = (score[i - 1]![j - 1] ?? 0) + (sim >= MATCH_FLOOR ? sim : sim - 0.6);
    if (score[i]![j] === diagonal) {
      if (sim >= MATCH_FLOOR) pairs.set(i - 1, times[j - 1]!);
      i--;
      j--;
    } else if (score[i]![j] === (score[i - 1]![j] ?? 0) + gap) i--;
    else j--;
  }

  const minRatio = options.minMatchRatio ?? 0.4;
  if (pairs.size / tokens.length < minRatio) return null;

  const clipStart = times[0]!.start;
  const clipEnd = times[times.length - 1]!.end;
  const words: Word[] = tokens.map((token) => ({ text: token, start: 0, end: 0 }));

  // 1) anchors: real measured times
  const anchors = [...pairs.keys()].sort((a, b) => a - b);
  let previousEnd = clipStart;
  for (const index of anchors) {
    const match = pairs.get(index)!;
    const start = Math.max(previousEnd, match.start);
    const end = Math.max(start + 0.06, match.end);
    words[index] = { text: tokens[index]!, start, end, confidence: 0.9, confidenceLabel: "high" };
    previousEnd = end;
  }

  // 2) gaps: distribute the span between neighbouring anchors by spoken weight
  const fill = (from: number, to: number, spanStart: number, spanEnd: number) => {
    const slice = tokens.slice(from, to);
    if (!slice.length) return;
    const total = slice.reduce((sum, token) => sum + speechWeight(token), 0) || slice.length;
    const available = Math.max(0.06 * slice.length, spanEnd - spanStart);
    let cursor = spanStart;
    slice.forEach((token, offset) => {
      const share = (speechWeight(token) / total) * available;
      const start = cursor;
      const end = start + Math.max(0.06, share);
      cursor = end;
      words[from + offset] = { text: token, start, end, confidence: 0.5, confidenceLabel: "review" };
    });
  };

  let cursor = 0;
  for (const index of anchors) {
    if (index > cursor) fill(cursor, index, cursor === 0 ? clipStart : words[cursor - 1]!.end, words[index]!.start);
    cursor = index + 1;
  }
  if (cursor < tokens.length) {
    fill(cursor, tokens.length, cursor === 0 ? clipStart : words[cursor - 1]!.end, Math.max(clipEnd, (words[cursor - 1]?.end ?? clipStart) + 0.2));
  }

  // 3) keep the sequence strictly monotonic
  let last = 0;
  for (const word of words) {
    if (word.start < last) word.start = last;
    if (word.end < word.start + 0.06) word.end = word.start + 0.06;
    last = word.end;
  }
  return words;
}

/**
 * Recogniser timings are measured on the concatenated chunk audio, while the
 * editor timeline is the original clip. Map one back to the other.
 */
export function mapConcatTimeToTimeline(time: number, segs: Segment[]): number {
  let elapsed = 0;
  for (const seg of segs) {
    const length = seg.end - seg.start;
    if (time <= elapsed + length) return seg.start + Math.max(0, time - elapsed);
    elapsed += length;
  }
  const last = segs[segs.length - 1];
  return last ? last.end : time;
}

/** Same as alignTextToTiming but returned on the original clip timeline. */
export function alignTextToTimingOnTimeline(
  text: string,
  timing: TimedWord[],
  segs: Segment[],
  options: { minMatchRatio?: number } = {},
): Word[] | null {
  const aligned = alignTextToTiming(text, timing, options);
  if (!aligned) return null;
  return aligned.map((word) => {
    const start = mapConcatTimeToTimeline(word.start, segs);
    const end = Math.max(start + 0.06, mapConcatTimeToTimeline(word.end, segs));
    return { ...word, start, end };
  });
}
