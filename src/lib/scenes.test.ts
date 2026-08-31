import { addSceneElement, updateSceneElementText, viralTextAt, viralTextWindow, type Scene } from "./scenes";

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
