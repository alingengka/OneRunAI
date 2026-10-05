import {
  detectSpeechSegments,
  smoothSpeechSegments,
  splitSegmentsAtWordGaps,
  defaultSilenceOptions,
  type Segment,
} from "./media/audio";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const SR = 16000;

/** Deterministic noise so the test gives the same numbers every run. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff - 0.5;
  };
}

type Clip = {
  buffer: AudioBuffer;
  words: Segment[];
  pauses: Segment[];
};

/**
 * Speech-like audio: words of 2–3 voiced syllables, short gaps between words,
 * and longer pauses between sentences, on top of steady background noise.
 */
function makeClip(noiseRms: number, seed = 7): Clip {
  const rand = rng(seed);
  const pausesPlan = [0.7, 0.5, 1.1, 0.6, 0.9];
  const words: Segment[] = [];
  const pauses: Segment[] = [];
  const events: { start: number; end: number }[] = [];
  let t = 0.6;
  for (let sentence = 0; sentence < pausesPlan.length + 1; sentence++) {
    for (let w = 0; w < 4; w++) {
      const syllables = 2 + (w % 2);
      const start = t;
      for (let k = 0; k < syllables; k++) {
        events.push({ start: t, end: t + 0.17 });
        t += 0.17 + 0.03;
      }
      words.push({ start, end: t - 0.03 });
      t += 0.09; // gap between words: must stay
    }
    const pause = pausesPlan[sentence];
    if (pause) {
      pauses.push({ start: t, end: t + pause });
      t += pause;
    }
  }
  const duration = t + 0.6;
  const data = new Float32Array(Math.ceil(duration * SR));
  // brown-ish background noise (traffic, engine)
  let walk = 0;
  for (let i = 0; i < data.length; i++) {
    walk = walk * 0.98 + rand();
    data[i] = walk;
  }
  let sum = 0;
  for (const v of data) sum += v * v;
  const scale = noiseRms / Math.sqrt(sum / data.length);
  for (let i = 0; i < data.length; i++) data[i] = data[i]! * scale;
  // voiced syllables: a few harmonics with a smooth envelope
  for (const ev of events) {
    const from = Math.floor(ev.start * SR);
    const to = Math.floor(ev.end * SR);
    const f0 = 150 + 40 * rand();
    for (let i = from; i < to; i++) {
      const x = (i - from) / (to - from);
      const env = Math.sin(Math.PI * x) ** 0.6;
      const tt = i / SR;
      const voice =
        Math.sin(2 * Math.PI * f0 * tt) +
        0.6 * Math.sin(2 * Math.PI * 2 * f0 * tt) +
        0.35 * Math.sin(2 * Math.PI * 3 * f0 * tt) +
        0.2 * rand();
      data[i] = data[i]! + 0.18 * env * voice;
    }
  }
  const buffer = {
    sampleRate: SR,
    length: data.length,
    duration: data.length / SR,
    numberOfChannels: 1,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
  return { buffer, words, pauses };
}

const overlap = (a: Segment, b: Segment) =>
  Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

/** Share of each pause that the kept segments leave out (1 = fully cut). */
function pauseCut(segments: Segment[], pauses: Segment[]): number[] {
  return pauses.map((p) => {
    const kept = segments.reduce((n, s) => n + overlap(s, p), 0);
    return 1 - kept / (p.end - p.start);
  });
}

/** Share of the spoken audio that is kept. */
function speechKept(segments: Segment[], words: Segment[]): number {
  const total = words.reduce((n, w) => n + (w.end - w.start), 0);
  const kept = words.reduce((n, w) => n + segments.reduce((m, s) => m + overlap(s, w), 0), 0);
  return kept / total;
}

const scenarios: [string, number][] = [
  ["quiet room", 0.003],
  ["street", 0.05],
  ["bus", 0.08],
];

for (const [name, noise] of scenarios) {
  const clip = makeClip(noise);
  const energy = smoothSpeechSegments(
    detectSpeechSegments(clip.buffer, defaultSilenceOptions),
    clip.buffer.duration,
  );
  // Recogniser word times are a little off: jitter them by up to ±30 ms.
  const jitter = rng(99);
  const measured = clip.words.map((w) => ({
    start: w.start + jitter() * 0.06,
    end: w.end + jitter() * 0.06,
  }));
  const withWords = splitSegmentsAtWordGaps(energy, measured, { minGap: 0.35 });

  const energyCut = pauseCut(energy, clip.pauses);
  const wordCut = pauseCut(withWords, clip.pauses);
  const fmt = (xs: number[]) => xs.map((x) => `${Math.round(x * 100)}%`).join(" ");
  console.log(
    `${name.padEnd(10)} energy only: pauses cut ${fmt(energyCut)} | speech kept ${(speechKept(energy, clip.words) * 100).toFixed(1)}%`,
  );
  console.log(
    `${"".padEnd(10)} + word gaps: pauses cut ${fmt(wordCut)} | speech kept ${(speechKept(withWords, clip.words) * 100).toFixed(1)}%`,
  );

  // Before captions exist: the loudness gate alone must not clip speech and
  // must still remove most of each pause, even in noise.
  if (!process.env["MEASURE"]) {
    assert(
      speechKept(energy, clip.words) >= 0.97,
      `${name}: loudness gate removed speech (${speechKept(energy, clip.words)})`,
    );
    for (const [i, cut] of energyCut.entries()) {
      assert(cut >= 0.5, `${name}: pause ${i + 1} only ${Math.round(cut * 100)}% cut by the gate`);
    }
  }
  for (const [i, cut] of wordCut.entries()) {
    if (process.env["MEASURE"]) continue;
    assert(cut >= 0.8, `${name}: pause ${i + 1} only ${Math.round(cut * 100)}% cut with word gaps`);
  }
  assert(
    speechKept(withWords, clip.words) >= 0.97,
    `${name}: word-gap cutting removed speech (${speechKept(withWords, clip.words)})`,
  );
}

// Gaps between words inside a sentence are never cut.
{
  const segs = splitSegmentsAtWordGaps(
    [{ start: 0, end: 3 }],
    [
      { start: 0.2, end: 0.6 },
      { start: 0.7, end: 1.1 },
      { start: 1.2, end: 1.6 },
    ],
    { minGap: 0.35, pad: 0.08 },
  );
  assert(segs.length === 1, `short gaps split a sentence: ${JSON.stringify(segs)}`);
  // ...but the silent tail after the last word is trimmed.
  assert(Math.abs(segs[0]!.end - 1.68) < 1e-9, `tail not trimmed: ${segs[0]!.end}`);
  assert(Math.abs(segs[0]!.start - 0.12) < 1e-9, `head not trimmed: ${segs[0]!.start}`);
}

console.log("dead-air tests passed");

// Speech with no words in it is found again (the tail an engine dropped).
{
  const { uncoveredSpeech } = await import("./media/audio");
  const gaps = uncoveredSpeech(
    [{ start: 9, end: 14 }],
    [
      { start: 9.1, end: 9.6 },
      { start: 9.7, end: 10.4 },
      { start: 10.5, end: 12.0 },
    ],
  );
  assert(gaps.length === 1, `missing tail not found: ${JSON.stringify(gaps)}`);
  assert(
    Math.abs(gaps[0]!.start - 12.15) < 1e-9 && gaps[0]!.end === 14,
    `wrong tail: ${JSON.stringify(gaps)}`,
  );
  // Short gaps between words are not reported.
  assert(
    uncoveredSpeech(
      [{ start: 0, end: 2 }],
      [
        { start: 0, end: 0.9 },
        { start: 1.2, end: 2 },
      ],
    ).length === 0,
    "short gap reported as missing speech",
  );
  console.log("uncovered speech tests passed");
}
