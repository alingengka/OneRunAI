import { buildSrt } from "./export";
import type { CaptionGroup } from "./captions";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const word = (text: string, start: number) => ({ text, start, end: start + 0.4 });
const groups: CaptionGroup[] = [
  {
    id: "a",
    start: 1,
    end: 2,
    words: [word("ສະບາຍ", 1), word("ດີ", 1.5)],
    sub: "Hello\n  everyone ",
  },
  { id: "b", start: 3, end: 4, words: [word("ຂອບໃຈ", 3)] },
];
const srt = buildSrt(groups);

// A translated cue carries the translation as its second line, on one line.
assert(
  srt.startsWith("1\n00:00:01,000 --> 00:00:02,000\nສະບາຍດີ\nHello everyone\n"),
  `translation line missing: ${JSON.stringify(srt)}`,
);
// A cue without a translation stays a single line.
assert(
  srt.includes("2\n00:00:03,000 --> 00:00:04,000\nຂອບໃຈ\n"),
  `plain cue changed: ${JSON.stringify(srt)}`,
);

console.log("export tests passed");
