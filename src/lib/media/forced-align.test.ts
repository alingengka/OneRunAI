import { alignTextToTiming, mergeAlignedChunks } from "./forced-align";

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
// --- alignTextToTiming: ใช้เวลาที่ผู้ถอดเสียงวัดจริง ---
const timing = [
  { text: "ພາສາ", start: 0, end: 0.5 },
  { text: "ລາວ", start: 0.5, end: 1 },
  { text: "ເວົ້າ", start: 1.2, end: 1.6 },
  { text: "ພາສາ", start: 2, end: 2.5 },
  { text: "ລາວ", start: 2.5, end: 3 },
];

const duplicates = alignTextToTiming("ພາສາ ລາວ ເວົ້າ ພາສາ ລາວ", timing);
assert(duplicates?.length === 5, "Duplicate words were not aligned");
assert(
  (duplicates?.[3]?.start ?? 0) === 2 && (duplicates?.[4]?.end ?? 0) === 3,
  "Repeated words were matched to the wrong occurrence",
);

const inserted = alignTextToTiming("ພາສາ ລາວ ດີ ເວົ້າ ພາສາ ລາວ", timing);
assert(inserted?.length === 6, "Extra word was dropped");
assert(
  (inserted?.[2]?.start ?? 0) >= 1 && (inserted?.[2]?.end ?? 0) <= 1.2001,
  "Unmatched word was not interpolated between its anchors",
);

const variant = alignTextToTiming("ຫຼວງພະບາງ ຮ້ອຍ", [
  { text: "ຫລວງພະບາງ", start: 1, end: 2 },
  { text: "ຮ້ອຍ", start: 2.2, end: 2.8 },
]);
assert((variant?.[0]?.start ?? -1) === 1, "Spelling variant was not matched to its measured time");

assert(alignTextToTiming("ສະບາຍດີ ຂອບໃຈ ຫຼາຍ", timing) === null, "Unrelated text should fall back to forced alignment");
console.log("forced-align tests passed");
