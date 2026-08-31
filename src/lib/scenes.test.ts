import { addSceneElement, updateSceneElementText, updateSceneElementTiming, viralTextAt, viralTextWindow, type Scene } from "./scenes";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const scene: Scene = {
  id: "scene-0",
  index: 0,
  start: 10,
  end: 20,
  segments: [
    { start: 10, end: 16 },
    { start: 17, end: 20 },
  ],
  text: "hello",
};

const win = viralTextWindow(scene);
assert(win.start === 10 && win.end === 12.5, "viral window should cap at 2.5s from scene start");

const shortWin = viralTextWindow({ id: "s", start: 0, end: 1.2, segments: [{ start: 0, end: 1.2 }] });
assert(shortWin.end === 1.2, "short scenes keep their own length");

let elements = addSceneElement([], "scene-0", "viralText");
assert(elements[0]?.text === "" && elements[0]?.position === "top", "new viral text defaults to empty top text");
assert(viralTextAt(10.5, [scene], elements) === null, "empty text should not render");

elements = updateSceneElementText(elements, "scene-0-viralText", "ห้ามพลาด");
const hit = viralTextAt(11.25, [scene], elements);
assert(hit?.text === "ห้ามพลาด", "viral text should be visible inside the window");
assert(Math.abs((hit?.progress ?? 0) - 0.5) < 1e-6, "progress should be halfway through the window");
assert(viralTextAt(13, [scene], elements) === null, "viral text should be gone after the window");

const disabled = elements.map((e) => ({ ...e, enabled: false }));
assert(viralTextAt(10.2, [scene], disabled) === null, "disabled elements should not render");

// --- timing controls (offset / durationSec) ---
const midWin = viralTextWindow(scene, { offset: 4, durationSec: 3 });
assert(midWin.start === 14 && midWin.end === 17, "offset+duration should place window mid-scene");

const clampedWin = viralTextWindow(scene, { offset: 9, durationSec: 5 });
assert(clampedWin.start === 19 && clampedWin.end === 20, "window must not exceed scene end");

const shortDur = viralTextWindow(scene, { offset: 0, durationSec: 0.5 });
assert(shortDur.end === 10.5, "short duration respected");

const legacyWin = viralTextWindow(scene, {});
assert(legacyWin.start === 10 && legacyWin.end === 12.5, "legacy elements keep 2.5s from scene start");

let timed = updateSceneElementTiming(elements, "scene-0-viralText", 4, 3);
assert(viralTextAt(11, [scene], timed) === null, "no viral text before the chosen offset");
const timedHit = viralTextAt(15.5, [scene], timed);
assert(timedHit?.text === "ห้ามพลาด" && Math.abs(timedHit.span - 3) < 1e-6, "viral text shows at chosen offset with chosen span");
assert(viralTextAt(17.5, [scene], timed) === null, "viral text ends after chosen duration");

timed = updateSceneElementTiming(timed, "scene-0-viralText", -5, 0);
assert((timed[0]?.offset ?? -1) === 0 && (timed[0]?.durationSec ?? 0) >= 0.1, "timing updates are clamped to sane values");
