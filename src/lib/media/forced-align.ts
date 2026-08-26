import { alignWordsToSegments, speechWeight, tokenizeWords } from "@/lib/captions";
import type { Word } from "@/lib/captions";
import type { Segment } from "./audio";

type Frame = { time: number; energy: number };

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

  for (const seg of segs) {
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
      frames.push({ time: i / sr, energy: Math.sqrt(Math.sqrt(sum / n)) });
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
    const seg = useSegs.find((s) => start >= s.start - 0.02 && start <= s.end + 0.02);
    if (seg && end > seg.end) end = seg.end;
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
  let skip = 0;
  const max = Math.min(6, overlap.length, incoming.length);
  for (let count = max; count >= 1; count--) {
    const left = overlap.slice(-count).map((word) => normalized(word.text)).join("");
    const right = incoming.slice(0, count).map((word) => normalized(word.text)).join("");
    if (left && left === right) { skip = count; break; }
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
