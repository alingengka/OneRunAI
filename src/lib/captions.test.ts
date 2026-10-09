import {
  assignClipIds,
  balancedSplitIndex,
  captionModeOf,
  groupCaptions,
  groupSentences,
  joinCaptionWords,
  needsSpace,
  type Word,
} from "./captions";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const w = (text: string, start: number, end = start + 0.3): Word => ({ text, start, end });
const texts = (words: Word[]) =>
  groupSentences(words).map((g) => g.words.map((x) => x.text).join(" "));

// a phrase stays together and splits at a pause
const phrase = texts([w("ມື້ນີ້", 0), w("ຂ້ອຍ", 0.3), w("ຈະ", 0.6), w("ໄປ", 2), w("ກິນ", 2.3)]);
assert(
  phrase.length === 2 && phrase[0] === "ມື້ນີ້ ຂ້ອຍ ຈະ" && phrase[1] === "ໄປ ກິນ",
  "split at pause",
);

// punctuation ends a caption
assert(texts([w("Hello.", 0), w("a", 0.3), w("b", 0.6)]).length === 2, "split after punctuation");

// long runs are capped
const many = Array.from({ length: 10 }, (_, i) => w("x", i * 0.3));
const sizes = groupSentences(many, { maxWords: 4 })
  .map((g) => g.words.length)
  .join(",");
assert(sizes === "4,4,2", `word limit, got ${sizes}`);

// styles saved before the option existed get a sensible mode
assert(captionModeOf({ wordsPerGroup: 1 }) === "word", "legacy single word");
assert(captionModeOf({ wordsPerGroup: 3 }) === "sentence", "legacy default is sentence");
assert(captionModeOf({ wordsPerGroup: 3, captionMode: "fixed" }) === "fixed", "explicit mode wins");
assert(
  groupCaptions([w("a", 0), w("b", 0.3), w("c", 0.6)], { wordsPerGroup: 3, captionMode: "word" })
    .length === 3,
  "word mode",
);

// Thai and Lao words join; Latin words keep their spaces
assert(
  joinCaptionWords([w("ใคร", 0), w("ใคร", 0.3), w("ทุก", 0.6), w("วันนี้", 0.9)]) ===
    "ใครใครทุกวันนี้",
  "thai joined",
);
assert(
  joinCaptionWords([w("ສະບາຍດີ", 0), w("OneRun", 0.3), w("AI", 0.6)]) === "ສະບາຍດີ OneRun AI",
  "mixed spacing",
);
assert(joinCaptionWords([w("ใคร", 0), w("ทุก", 0.3)], false) === "ใคร ทุก", "spaced when asked");
assert(!needsSpace("ກິນ", "ກາເຟ") && needsSpace("ກິນ", "coffee"), "needsSpace");

// podcast split: short lead-in first, never longer than the key line
assert(balancedSplitIndex(["ขอ", "แค่", "ทำ", "เงิน"]) === 2, "even split");
assert(balancedSplitIndex(["Microsoft", "Success"]) === 1, "two words");
assert(balancedSplitIndex(["a", "bb", "ccccccccc"]) === 2, "lead-in before a long key word");

// Caption clips: assigned once, then grouping follows the clips.
{
  const ws: Word[] = [
    { text: "a", start: 0, end: 0.3 },
    { text: "b", start: 0.35, end: 0.6 },
    { text: "c", start: 0.65, end: 0.9 },
    { text: "d", start: 0.95, end: 1.2 },
  ];
  const clipped = assignClipIds(ws, { captionMode: "fixed", wordsPerGroup: 2 });
  assert(clipped.every((w) => w.clip), "every word gets a clip");
  assert(clipped[0]!.clip === clipped[1]!.clip && clipped[1]!.clip !== clipped[2]!.clip, "two per clip");
  // changing the mode later does not regroup clipped words
  const groups = groupCaptions(clipped, { captionMode: "word", wordsPerGroup: 1 });
  assert(groups.length === 2 && groups[0]!.id === clipped[0]!.clip, "grouped by clip");
  // a new word without a clip joins the line before it
  const withNew = [...clipped.slice(0, 2), { text: "x", start: 0.62, end: 0.64 }, ...clipped.slice(2)];
  const g2 = groupCaptions(withNew, { captionMode: "word", wordsPerGroup: 1 });
  assert(g2.length === 2 && g2[0]!.words.length === 3, "unclipped word joins previous line");
  assert(assignClipIds(clipped, { captionMode: "word", wordsPerGroup: 1 }) === clipped, "no-op when all clipped");
}

console.log("caption grouping tests passed");
