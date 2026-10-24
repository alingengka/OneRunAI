import {
  partAt,
  removePart,
  restorePart,
  splitVideo,
  videoParts,
  emptyVideoEdit,
} from "./video-parts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
const show = (parts: { start: number; end: number; removed: boolean }[]) =>
  parts.map((p) => `${p.start}-${p.end}${p.removed ? "x" : ""}`).join(" ");

// One piece until the first split.
let edit = emptyVideoEdit();
assert(show(videoParts(10, edit)) === "0-10", "uncut video is one piece");

// Splits make pieces; slivers and edges are refused.
edit = splitVideo(edit, 4, 10)!;
edit = splitVideo(edit, 7, 10)!;
assert(show(videoParts(10, edit)) === "0-4 4-7 7-10", `split: ${show(videoParts(10, edit))}`);
assert(splitVideo(edit, 4.05, 10) === null, "too close to a cut");
assert(splitVideo(edit, 0.05, 10) === null, "too close to the start");
assert(splitVideo(edit, 9.95, 10) === null, "too close to the end");

// Deleting marks the piece; neighbors stay.
edit = removePart(edit, { start: 4, end: 7 });
assert(show(videoParts(10, edit)) === "0-4 4-7x 7-10", `remove: ${show(videoParts(10, edit))}`);
// Splitting a deleted piece keeps both halves deleted.
edit = splitVideo(edit, 5.5, 10)!;
assert(
  show(videoParts(10, edit)) === "0-4 4-5.5x 5.5-7x 7-10",
  `split removed: ${show(videoParts(10, edit))}`,
);
// Restoring one half brings back only that half.
edit = restorePart(edit, { start: 4, end: 5.5 });
assert(
  show(videoParts(10, edit)) === "0-4 4-5.5 5.5-7x 7-10",
  `restore half: ${show(videoParts(10, edit))}`,
);
// Neighboring deletes merge into one range.
edit = removePart(edit, { start: 7, end: 10 });
assert(
  edit.removed.length === 1 && edit.removed[0]!.start === 5.5 && edit.removed[0]!.end === 10,
  `merge: ${JSON.stringify(edit.removed)}`,
);

// partAt finds the piece under the playhead, the last one at the very end.
const parts = videoParts(10, edit);
assert(
  partAt(parts, 4) === 1 && partAt(parts, 3.99) === 0 && partAt(parts, 10) === parts.length - 1,
  "partAt",
);

console.log("video-parts tests passed");
