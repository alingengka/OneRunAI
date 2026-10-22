import { clipsInBox, groupMoveLimits } from "./clip-selection";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

const lines = [
  { id: "a", start: 0, end: 1 },
  { id: "b", start: 2, end: 3 },
  { id: "c", start: 3.5, end: 4 },
  { id: "d", start: 6, end: 7 },
];

// b and c move together: from a's end (1) to d's start (6).
{
  const r = groupMoveLimits(lines, [], new Set(["b", "c"]), new Set(), 10);
  assert(near(r.min, -1) && near(r.max, 2), `b+c limits ${JSON.stringify(r)}`);
}
// Selecting a and d skips nothing in between: each stops at its unselected neighbor.
{
  const r = groupMoveLimits(lines, [], new Set(["a", "d"]), new Set(), 10);
  assert(near(r.min, 0) && near(r.max, 1), `a+d limits ${JSON.stringify(r)}`);
}
// The last line may run to the end of the video.
{
  const r = groupMoveLimits(lines, [], new Set(["d"]), new Set(), 10);
  assert(near(r.min, -2) && near(r.max, 3), `d limits ${JSON.stringify(r)}`);
}
// Free texts ignore caption lines and only stay inside the video.
{
  const texts = [{ id: "t", start: 2, end: 5 }];
  const r = groupMoveLimits(lines, texts, new Set(), new Set(["t"]), 10);
  assert(near(r.min, -2) && near(r.max, 5), `text limits ${JSON.stringify(r)}`);
  const both = groupMoveLimits(lines, texts, new Set(["d"]), new Set(["t"]), 10);
  assert(near(both.min, -2) && near(both.max, 3), `mixed limits ${JSON.stringify(both)}`);
}
// A box picks clips by time and row.
{
  const clips = [
    { id: "a", start: 0, end: 1, row: 0 },
    { id: "b", start: 2, end: 3, row: 0 },
    { id: "t", start: 0.5, end: 2.5, row: 1 },
  ];
  const ids = (list: { id: string }[]) => list.map((c) => c.id).join(",");
  assert(ids(clipsInBox(clips, 0.8, 2.2, 0, 0)) === "a,b", "box over row 0");
  assert(ids(clipsInBox(clips, 2.2, 0.8, 1, 0)) === "a,b,t", "box over both rows, drawn backwards");
  assert(ids(clipsInBox(clips, 1.2, 1.8, 0, 0)) === "", "box in a gap");
}
console.log("clip-selection tests passed");
