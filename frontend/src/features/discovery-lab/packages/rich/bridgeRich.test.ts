import { it, expect } from "vitest";
import { parseScene, sandboxDocument } from "../bridge";
import { richFixture } from "./testFixture";
it("makes richer resources, animation and budgets explicit without upgrading old packages", async () => {
  const scene = {
    description: "Observe the changing model",
    scene3d: richFixture(),
    shapes: [],
    controls: [],
    animate: true,
  };
  expect(parseScene(scene, "rich")?.rich3d).toBeTruthy();
  expect(parseScene(scene, "3d")).toBeNull();
  expect(parseScene(scene, "vector")).toBeNull();
  const rich = await sandboxDocument("cap", "rich"),
    legacy = await sandboxDocument("cap", "3d");
  expect(rich).toContain("m.code.length<=1048576");
  expect(rich).toContain("json.length>4194304");
  expect(legacy).toContain("m.code.length<=262144");
  expect(legacy).toContain("json.length>524288");
  expect(rich).toContain("connect-src 'none'");
  expect(rich).toContain("pingDeadline=setTimeout(fail,1500)");
});
it("permits tones only on declared user buttons and never auto audio or arbitrary waveforms", () => {
  const base = {
    description: "Hear frequency",
    shapes: [],
    controls: [],
    buttons: [{ id: "play", label: "Play tone" }],
    audio: [
      {
        buttonId: "play",
        frequency: 440,
        duration: 0.85,
        gain: 0.1,
        waveform: "sine",
      },
    ],
  };
  expect(parseScene(base, "rich")?.audio?.[0].frequency).toBe(440);
  expect(parseScene(base, "vector")).toBeNull();
  for (const tone of [
    { ...base.audio[0], gain: 1 },
    { ...base.audio[0], buttonId: "missing" },
    { ...base.audio[0], waveform: "custom" },
    { ...base.audio[0], url: "https://invalid" },
  ])
    expect(parseScene({ ...base, audio: [tone] }, "rich")).toBeNull();
});
it("reuses only previously validated resources and rejects stale references or partial initial scenes", () => {
  const original = {
    description: "Model",
    scene3d: richFixture(),
    shapes: [],
    controls: [],
  };
  const previous = parseScene(original, "rich")!;
  const rest = { ...original.scene3d } as Partial<typeof original.scene3d>;
  delete rest.geometries;
  delete rest.materials;
  delete rest.textures;
  const patch = { ...original, scene3d: { ...rest, reuseResources: true } };
  expect(parseScene(patch, "rich")).toBeNull();
  expect(
    parseScene(patch, "rich", new Set(), previous)?.rich3d?.geometries,
  ).toEqual(previous.rich3d?.geometries);
  expect(
    parseScene(
      {
        ...patch,
        scene3d: {
          ...patch.scene3d,
          nodes: [{ kind: "mesh", geometry: "stale", material: "m0" }],
        },
      },
      "rich",
      new Set(),
      previous,
    ),
  ).toBeNull();
  expect(
    parseScene(
      { ...patch, scene3d: { ...patch.scene3d, geometries: null } },
      "rich",
      new Set(),
      previous,
    ),
  ).toBeNull();
  expect(
    parseScene(
      { ...patch, scene3d: { ...patch.scene3d, reuseResources: false } },
      "rich",
      new Set(),
      previous,
    ),
  ).toBeNull();
});
it("validates optional offline fallback art without allowing executable SVG or upgrading vector mode", () => {
  const vector = {
    viewBox: [0, 0, 100, 100],
    description: "Fallback",
    nodes: [
      {
        tag: "circle",
        attrs: { cx: 50, cy: 50, r: 10, fill: "#fff" },
        children: [],
      },
    ],
  };
  const base = {
    description: "Model",
    shapes: [],
    controls: [],
    fallbackVector: vector,
  };
  expect(parseScene(base, "rich")?.fallbackVector).toBeTruthy();
  expect(parseScene(base, "vector")).toBeNull();
  expect(
    parseScene(
      {
        ...base,
        fallbackVector: {
          ...vector,
          nodes: [{ tag: "script", attrs: {}, children: [] }],
        },
      },
      "rich",
    ),
  ).toBeNull();
});
it("preserves bounded package-authored comparison readouts", () => {
  const scene = {
    description: "Compare both bodies",
    shapes: [],
    controls: [],
    readouts: [
      {
        label: "Earth",
        value: "1 kg",
        detail: "Same acceleration, different weight.",
      },
    ],
  };
  expect(parseScene(scene, "rich")?.readouts).toEqual(scene.readouts);
  expect(
    parseScene(
      { ...scene, readouts: [{ label: "Earth", value: "x".repeat(121) }] },
      "rich",
    ),
  ).toBeNull();
});
