import { describe, expect, test } from "bun:test";
import { mergeAlignedChunks } from "./forced-align";

describe("mergeAlignedChunks", () => {
  test("deduplicates matching Lao words at an overlap", () => {
    const result = mergeAlignedChunks(
      [
        { text: "ສະບາຍດີ", start: 0, end: 0.8, confidence: 0.9 },
        { text: "ທຸກຄົນ", start: 0.8, end: 1.5, confidence: 0.8 },
      ],
      [
        { text: "ທຸກຄົນ", start: 1.2, end: 1.6, confidence: 0.9 },
        { text: "ມື້ນີ້", start: 1.6, end: 2.2, confidence: 0.85 },
      ],
    );
    expect(result.map((word) => word.text)).toEqual(["ສະບາຍດີ", "ທຸກຄົນ", "ມື້ນີ້"]);
  });

  test("keeps timestamps ordered", () => {
    const result = mergeAlignedChunks(
      [{ text: "A", start: 0, end: 0.5 }],
      [{ text: "B", start: 0.45, end: 0.9 }],
    );
    expect(result.every((word, index) => index === 0 || word.start >= (result[index - 1]?.start ?? 0))).toBe(true);
  });
});