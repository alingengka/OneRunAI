import { makeSoundClip, outputTimeOf, retimeSoundClip, splitSoundClip } from "./sounds";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

const clip = { ...makeSoundClip("wrong", 2), duration: 1, offset: 0 };

// moving keeps the length
const moved = retimeSoundClip(clip, 3, 4, 1.2);
assert(near(moved.start, 3) && near(moved.duration, 1) && moved.offset === 0, "move");

// dragging the front edge trims the head of the sound
const head = retimeSoundClip(clip, 2.3, 3, 1.2);
assert(near(head.start, 2.3) && near(head.offset, 0.3) && near(head.duration, 0.7), "trim head");

// the front edge cannot go before the start of the sound
const back = retimeSoundClip(head, 1.5, 3, 1.2);
assert(near(back.start, 2) && back.offset === 0 && near(back.duration, 1), "untrim head");

// the back edge stops at the end of the sound
const tail = retimeSoundClip(clip, 2, 5, 1.2);
assert(near(tail.duration, 1.2), "tail limited by the sound");

// split
const parts = splitSoundClip(clip, 2.4);
assert(!!parts, "split inside");
assert(near(parts![0].duration, 0.4) && near(parts![1].start, 2.4), "split times");
assert(near(parts![1].offset, 0.4) && near(parts![1].duration, 0.6), "second part offset");
assert(splitSoundClip(clip, 1) === null, "split outside");

// output time after cut scenes
const segments = [
  { start: 0, end: 1.5 },
  { start: 2.5, end: 4 },
];
assert(near(outputTimeOf(0.5, segments)!, 0.5), "before the cut");
assert(near(outputTimeOf(2.6, segments)!, 1.6), "after the cut");
assert(outputTimeOf(2, segments) === null, "inside a removed part");
assert(outputTimeOf(5, segments) === null, "after the end");

console.log("sounds tests passed");
