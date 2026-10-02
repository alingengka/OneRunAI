import {
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

console.log("caption grouping tests passed");
