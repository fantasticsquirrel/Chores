import { describe, expect, it } from "vitest";
import {
  isLocalSceneNavigation,
  readSceneMessage,
  sceneStateScript,
  validSceneState,
  type OfflineSceneState,
} from "@family-manager/discovery-scenes/protocol";

const states: OfflineSceneState[] = [
  { kind: "moon", angle: 90 },
  { kind: "orbit", points: [{ x: 1, y: 0 }], progress: 0 },
  {
    kind: "solar",
    selected: 2,
    earthYears: 0,
    mode: "orbits",
    angles: [0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    kind: "gravity",
    height: 20,
    gravity: 9.81,
    elapsed: 1,
    mass: 3,
    referenceGravity: 9.81,
    referenceMass: 1,
    distances: [4.905, 4.905],
  },
  { kind: "leaf", light: 50, water: 75, carbon: 100, rate: 67 },
  {
    kind: "castle",
    moat: 22,
    gate: true,
    towers: true,
    inner: false,
    approach: "bridge",
    sight: true,
    wallHeightMeters: 9,
  },
  {
    kind: "bridge",
    material: "timber",
    braces: [true, true, true, true],
    load: 30,
    position: 50,
    utilization: [0.2, 0.3, 0.3, 0.2],
    leftReaction: 15,
    rightReaction: 15,
  },
  { kind: "sound", length: 60, tension: 80, amplitude: 4, progress: 0 },
  {
    kind: "circuit",
    mode: "parallel",
    switches: [true, true, true],
    power: [24, 24, 24],
    current: [2, 2, 2],
    voltage: 12,
  },
  {
    kind: "pizza",
    plates: [
      { n: 1, d: 2, slices: [0] },
      { n: 2, d: 4, slices: [0, 1] },
    ],
    active: 0,
  },
  {
    kind: "chance",
    chances: [0.25, 0.25, 0.25, 0.25],
    die: false,
    last: null,
    selected: -1,
  },
  {
    kind: "river",
    slope: 8,
    rain: 50,
    vegetation: 50,
    runoff: 20,
    infiltration: 30,
    eroded: 3,
    flood: 0,
    deposited: 1,
    soil: 100,
  },
  {
    kind: "pond",
    algae: 50,
    zooplankton: 45,
    fish: 50,
    oxygen: 80,
    drought: 0,
    nutrients: 30,
  },
  {
    kind: "caravan",
    route: "river",
    season: "dry",
    cargo: "cloth",
    units: 5,
    supplies: 8,
    days: 6,
    load: 40,
  },
  {
    kind: "garden",
    x: 80,
    y: 210,
    reach: 140,
    habitat: true,
    pollen: "none",
    received: [],
    path: [{ x: 80, y: 210 }],
  },
  { kind: "optics", angle: 40, reverse: false },
  {
    kind: "pattern",
    sides: 4,
    copies: 4,
    rotation: 90,
    reflected: true,
    view: "tiles",
  },
];
describe("typed offline scene transport", () => {
  it.each(states)("serializes only validated $kind state", (state) => {
    expect(validSceneState(state)).toBe(true);
    expect(sceneStateScript(state)).toBe(
      `window.discoveryScene?.setState(${JSON.stringify(state)}); true;`,
    );
    expect(validSceneState({ ...state, url: "https://example.com" })).toBe(
      false,
    );
    expect(validSceneState({ ...state, childId: 5 })).toBe(false);
  });
  it("bounds every numeric, enum, point and array input", () => {
    for (const value of [
      null,
      [],
      {},
      { kind: "constructor" },
      { kind: "moon", angle: NaN },
      { kind: "moon", angle: 361 },
      { kind: "moon", angle: "90);alert(1)" },
      { ...states[1], points: [] },
      {
        ...states[1],
        points: Array.from({ length: 513 }, () => ({ x: 0, y: 0 })),
      },
      { ...states[1], points: [{ x: Infinity, y: 0 }] },
      { ...states[2], selected: 8 },
      { ...states[2], mode: "invalid" },
      { ...states[2], angles: [0] },
      { ...states[3], distances: [0, 21] },
      { ...states[4], water: -1 },
      { ...states[5], wallHeightMeters: 100 },
      { ...states[5], gate: "yes" },
    ]) {
      expect(validSceneState(value)).toBe(false);
      expect(sceneStateScript(value as OfflineSceneState)).toBeNull();
    }
  });
  it("rejects nonfinite numbers at every numeric path across all scene kinds", () => {
    function paths(
      value: unknown,
      path: (string | number)[] = [],
    ): (string | number)[][] {
      if (typeof value === "number") return [path];
      if (!value || typeof value !== "object") return [];
      return Object.entries(value).flatMap(([key, child]) =>
        paths(child, [...path, key]),
      );
    }
    for (const state of states)
      for (const path of paths(state)) {
        const broken = JSON.parse(JSON.stringify(state));
        let parent = broken;
        for (const key of path.slice(0, -1)) parent = parent[key];
        parent[path.at(-1)!] = Infinity;
        expect(validSceneState(broken)).toBe(false);
      }
  });
  it("accepts only bounded status/angle messages", () => {
    for (const type of ["ready", "rendered", "unavailable"])
      expect(readSceneMessage(JSON.stringify({ type }))).toEqual({ type });
    expect(readSceneMessage('{"type":"angle","angle":135}')).toEqual({
      type: "angle",
      angle: 135,
    });
    for (const data of [
      "null",
      "[]",
      "{}",
      "broken",
      '{"type":"ready","url":"https://example.com"}',
      '{"type":"angle","angle":"90"}',
      '{"type":"angle","angle":1e999}',
      " ".repeat(200),
    ])
      expect(readSceneMessage(data)).toBeNull();
  });
  it("permits no navigation other than the initial inline document", () => {
    expect(isLocalSceneNavigation("about:blank")).toBe(true);
    for (const value of [
      "https://example.com",
      "file:///data",
      "javascript:alert(1)",
      "about:blank#redirect",
      "data:text/html,hello",
    ])
      expect(isLocalSceneNavigation(value)).toBe(false);
  });
});
