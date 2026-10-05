import { moveWordTo } from "./word-actions";
import type { Word } from "./captions";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const words: Word[] = [
  { text: "a", start: 0, end: 0.5 },
  { text: "b", start: 0.6, end: 1.0 },
  { text: "c", start: 1.1, end: 1.5 },
  { text: "d", start: 2.0, end: 2.4 },
];

// Moving within its own gap keeps the order and the new times.
{
  const out = moveWordTo(words, 1, 0.55, 0.95, 10);
  assert(out.map((w) => w.text).join("") === "abcd", `order changed: ${out.map((w) => w.text)}`);
  assert(
    out[1]!.start === 0.55 && out[1]!.end === 0.95,
    `times not kept: ${JSON.stringify(out[1])}`,
  );
}

// Moving past a neighbour reorders the words.
{
  const out = moveWordTo(words, 0, 1.6, 1.9, 10);
  assert(out.map((w) => w.text).join("") === "bcad", `not reordered: ${out.map((w) => w.text)}`);
  assert(
    out[2]!.start === 1.6 && out[2]!.end === 1.9,
    `moved word times: ${JSON.stringify(out[2])}`,
  );
}

// Dropping onto a word trims the neighbours instead of overlapping them.
{
  const out = moveWordTo(words, 3, 0.8, 1.2, 10);
  assert(out.map((w) => w.text).join("") === "abdc", `order: ${out.map((w) => w.text)}`);
  for (let i = 1; i < out.length; i++) {
    assert(out[i]!.start >= out[i - 1]!.end - 1e-9, `overlap at ${i}: ${JSON.stringify(out)}`);
  }
  const d = out.find((w) => w.text === "d")!;
  assert(d.start === 0.8 && d.end === 1.2, `dropped word lost its place: ${JSON.stringify(d)}`);
}

console.log("word-actions tests passed");
