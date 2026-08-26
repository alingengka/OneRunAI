import { mergeAlignedChunks } from "./forced-align";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const laoResult = mergeAlignedChunks(
  [
    { text: "ສະບາຍດີ", start: 0, end: 0.8, confidence: 0.9 },
    { text: "ທຸກຄົນ", start: 0.8, end: 1.5, confidence: 0.8 },
  ],
  [
    { text: "ທຸກຄົນ", start: 1.2, end: 1.6, confidence: 0.9 },
    { text: "ມື້ນີ້", start: 1.6, end: 2.2, confidence: 0.85 },
  ],
);
assert(laoResult.map((word) => word.text).join("|") === "ສະບາຍດີ|ທຸກຄົນ|ມື້ນີ້", "Lao overlap was not deduplicated");

const ordered = mergeAlignedChunks(
  [{ text: "A", start: 0, end: 0.5 }],
  [{ text: "B", start: 0.45, end: 0.9 }],
);
assert(
  ordered.every((word, index) => index === 0 || word.start >= (ordered[index - 1]?.start ?? 0)),
  "Merged timestamps are not ordered",
);

const fuzzyLao = mergeAlignedChunks(
  [{ text: "ສະບາຍດີ", start: 0, end: 1, confidence: 0.7 }],
  [{ text: "ສະບາຍດີ້", start: 0.78, end: 1.2, confidence: 0.9 }, { text: "ເດີ", start: 1.2, end: 1.6 }],
);
assert(fuzzyLao.length === 2, "Fuzzy Lao overlap was not merged");