import { describe, expect, it } from "vitest";
import { addSceneElement, updateSceneElementText, viralTextAt, viralTextWindow, type Scene } from "./scenes";

const scene: Scene = {
  id: "scene-0",
  index: 0,
  start: 10,
  end: 20,
  segments: [{ start: 10, end: 16 }, { start: 17, end: 20 }],
  text: "hello",
};

describe("viral text", () => {
  it("shows only at the start of the scene, max 2.5s", () => {
    expect(viralTextWindow(scene)).toEqual({ start: 10, end: 12.5 });
    expect(viralTextWindow({ id: "s", start: 0, end: 1.2, segments: [{ start: 0, end: 1.2 }] })).toEqual({
      start: 0,
      end: 1.2,
    });
  });

  it("defaults new viral text elements to empty top text", () => {
    const [element] = addSceneElement([], "scene-0", "viralText");
    expect(element?.text).toBe("");
    expect(element?.position).toBe("top");
  });

  it("returns a hit inside the window only when text is set", () => {
    let elements = addSceneElement([], "scene-0", "viralText");
    expect(viralTextAt(10.5, [scene], elements)).toBeNull();
    elements = updateSceneElementText(elements, "scene-0-viralText", "ห้ามพลาด");
    const hit = viralTextAt(11.25, [scene], elements);
    expect(hit?.text).toBe("ห้ามพลาด");
    expect(hit?.progress).toBeCloseTo(0.5, 5);
    expect(viralTextAt(13, [scene], elements)).toBeNull();
  });

  it("ignores disabled elements", () => {
    const elements = updateSceneElementText(addSceneElement([], "scene-0", "viralText"), "scene-0-viralText", "hi").map(
      (e) => ({ ...e, enabled: false }),
    );
    expect(viralTextAt(10.2, [scene], elements)).toBeNull();
  });
});
