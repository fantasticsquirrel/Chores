import { describe, expect, it } from "vitest";
import { nativeSceneState } from "./nativeSceneState";
import { validSceneState } from "@family-manager/discovery-scenes/protocol";

describe("native model to render-state mapping", () => {
  it("keeps both drop masses under the same selected gravity", () => {
    expect(nativeSceneState("gravity", 1.62, 10, 2, 7)).toEqual({
      kind: "gravity",
      height: 20,
      gravity: 1.62,
      elapsed: 1,
      mass: 7,
      referenceGravity: 1.62,
      referenceMass: 2,
      distances: [0.81, 0.81],
    });
    expect(nativeSceneState("gravity", 9.81, 50, 2, 7)).toMatchObject({
      distances: [20, 20],
    });
  });
  it("keeps fixed carbon suitable and sends the existing native rate", () => {
    expect(nativeSceneState("photosynthesis", 0, 100, 1, 3)).toEqual({
      kind: "leaf",
      light: 0,
      water: 100,
      carbon: 100,
      rate: 0,
    });
    expect(nativeSceneState("photosynthesis", 100, 100, 1, 3)).toMatchObject({
      rate: 80,
    });
  });
  it("sends wall height, gate, moat and sight-line changes", () => {
    expect(nativeSceneState("castle-defenses", 6, 1, 0, 0)).toMatchObject({
      kind: "castle",
      wallHeightMeters: 18,
      moat: 22,
      gate: false,
      sight: false,
    });
  });
  it("calculates native planetary angles before crossing the bridge", () => {
    const state = nativeSceneState("solar-system", 3, 12, 2, 3);
    expect(state).toMatchObject({
      kind: "solar",
      selected: 3,
      earthYears: 1,
      mode: "sizes",
    });
    if (state?.kind === "solar")
      expect(state.angles[2]).toBeCloseTo(Math.PI * 2);
  });
  it("has no renderer substitution for unsupported topics", () => {
    expect(nativeSceneState("reflection-refraction", 40, 0, 1, 3)).toEqual({
      kind: "optics",
      angle: 40,
      reverse: false,
    });
    expect(nativeSceneState("future-topic", 1, 0, 1, 3)).toBeNull();
  });
  it("creates valid bounded payloads for all supported default native states", () => {
    for (const [id, value, second] of [
      ["moon-phases", 90, 0],
      ["orbital-mechanics", 1, 0],
      ["solar-system", 2, 0],
      ["gravity", 9.81, 0],
      ["photosynthesis", 50, 75],
      ["castle-defenses", 3, 0],
    ] as const)
      expect(validSceneState(nativeSceneState(id, value, second, 1, 3))).toBe(
        true,
      );
  });
});
