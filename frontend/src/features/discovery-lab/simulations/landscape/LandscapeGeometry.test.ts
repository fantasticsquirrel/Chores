import { describe, expect, it } from "vitest";
import { buildRiver } from "@family-manager/discovery-scenes/landscape/river";
import { buildPond } from "@family-manager/discovery-scenes/landscape/pond";
import { buildCaravan } from "@family-manager/discovery-scenes/landscape/caravan";
import { buildGarden } from "@family-manager/discovery-scenes/landscape/garden";
import { disposeGroup } from "@family-manager/discovery-scenes/landscape/geometry";

describe("landscape scene geometry", () => {
  it("shows floodwater only above channel capacity and keeps deposited soil distinct", () => {
    const dry = buildRiver({
      kind: "river",
      slope: 8,
      rain: 0,
      vegetation: 40,
      runoff: 0,
      infiltration: 0,
      eroded: 0,
      flood: 0,
      deposited: 0,
      soil: 5000,
    });
    expect(dry.group.getObjectByName("floodwater")).toBeUndefined();
    const wet = buildRiver({
      kind: "river",
      slope: 20,
      rain: 100,
      vegetation: 0,
      runoff: 800,
      infiltration: 200,
      eroded: 800,
      flood: 620,
      deposited: 120,
      soil: 4200,
    });
    expect(wet.group.getObjectByName("floodwater")).toBeTruthy();
    expect(wet.group.getObjectByName("deposited-sediment")).toBeTruthy();
    disposeGroup(dry.group);
    disposeGroup(wet.group);
  });
  it("removes fish geometry when their index is zero", () => {
    const scene = buildPond({
      kind: "pond",
      algae: 45,
      zooplankton: 35,
      fish: 0,
      oxygen: 80,
      drought: 0,
      nutrients: 50,
    });
    expect(scene.group.getObjectByName("fish-0")).toBeUndefined();
    expect(scene.labels.some((label) => label.text === "Fish absent")).toBe(
      true,
    );
    expect(scene.group.getObjectByName("water")).toBeTruthy();
    disposeGroup(scene.group);
  });
  it("distinguishes selected trade routes", () => {
    const scene = buildCaravan({
      kind: "caravan",
      route: "ridge",
      season: "dry",
      cargo: "pottery",
      units: 6,
      supplies: 10,
      days: 9,
      load: 62,
    });
    expect(scene.group.getObjectByName("selected-ridge")).toBeTruthy();
    expect(scene.group.getObjectByName("selected-river")).toBeUndefined();
    disposeGroup(scene.group);
  });
  it("adds only the two model bridge flowers when habitat is enabled", () => {
    const state = {
      kind: "garden" as const,
      x: 70,
      y: 320,
      reach: 170,
      habitat: false,
      pollen: "none" as const,
      received: [],
      path: [{ x: 70, y: 320 }],
    };
    const before = buildGarden(state),
      after = buildGarden({ ...state, habitat: true });
    expect(before.group.getObjectByName("flower-3")).toBeUndefined();
    expect(after.group.getObjectByName("flower-3")).toBeTruthy();
    expect(after.group.getObjectByName("flower-4")).toBeTruthy();
    expect(
      after.labels.filter((label) => label.text.includes("bridge")),
    ).toHaveLength(2);
    disposeGroup(before.group);
    disposeGroup(after.group);
  });
});
