import { describe, expect, it } from "vitest";
import {
  crossSection,
  defaultCellExplorerState,
  defaultShapeSlicerState,
  defaultAdaptationIslandState,
  stepCellTransport,
  nextIslandGeneration,
  resetIsland,
  rotateSolidPoint,
} from "./expansion-life-geometry";
describe("cell membrane transport", () => {
  it("conserves material and moves oxygen down a concentration difference", () => {
    const next = stepCellTransport(defaultCellExplorerState);
    expect(next.inside).toBe(5);
    expect(next.outside).toBe(11);
    expect(next.inside + next.outside).toBe(16);
  });
  it("blocks glucose without a carrier and never overshoots equilibrium", () => {
    const blocked = {
      ...defaultCellExplorerState,
      molecule: "glucose" as const,
      carrier: false,
    };
    expect(stepCellTransport(blocked)).toEqual(blocked);
    expect(stepCellTransport({ ...blocked, carrier: true }).inside).toBe(5);
    const equal = stepCellTransport({
      ...defaultCellExplorerState,
      outside: 5,
      inside: 4,
    });
    expect(equal.inside).toBe(4.5);
    expect(equal.outside).toBe(4.5);
    expect(stepCellTransport(equal)).toEqual(equal);
    expect(stepCellTransport({ ...equal, inside: 12, outside: 4 }).inside).toBe(
      11,
    );
  });
});
describe("exact cross-sections", () => {
  it("computes the cube square, area and empty slice", () => {
    const section = crossSection(defaultShapeSlicerState);
    expect(section.name).toBe("square");
    expect(section.area).toBeCloseTo(4);
    expect(section.points).toHaveLength(4);
    expect(crossSection({ ...defaultShapeSlicerState, offset: 1.2 }).name).toBe(
      "no intersection",
    );
    expect(
      crossSection({ ...defaultShapeSlicerState, offset: 1 }).area,
    ).toBeCloseTo(4);
  });
  it("finds six sides at a diagonal central cube cut and triangles near corners", () => {
    const diagonal = {
      ...defaultShapeSlicerState,
      tilt: 45,
      turn: 35.26438968,
    };
    expect(crossSection(diagonal).points).toHaveLength(6);
    expect(crossSection({ ...diagonal, offset: 1.4 }).points).toHaveLength(3);
    for (const point of crossSection(diagonal).points)
      expect(point[1]).toBeCloseTo(0);
  });
  it("does not invent polygon corners on a sphere", () => {
    expect(
      crossSection({ ...defaultShapeSlicerState, solid: "sphere", offset: 0.6 })
        .radius,
    ).toBeCloseTo(0.8);
    expect(
      crossSection({ ...defaultShapeSlicerState, solid: "sphere", offset: 1 })
        .name,
    ).toBe("point");
    expect(
      crossSection({ ...defaultShapeSlicerState, solid: "sphere", offset: 1.1 })
        .area,
    ).toBe(0);
  });
  it("preserves lengths under rotation and cuts a tetrahedron into triangles or quadrilaterals", () => {
    const point = rotateSolidPoint([1, 2, 3], 45, 32);
    expect(point.reduce((sum, value) => sum + value * value, 0)).toBeCloseTo(
      14,
    );
    expect(
      crossSection({ ...defaultShapeSlicerState, solid: "tetrahedron" }).points,
    ).toHaveLength(4);
    expect(
      crossSection({
        ...defaultShapeSlicerState,
        solid: "tetrahedron",
        tilt: 45,
        turn: 35.26438968,
      }).points,
    ).toHaveLength(3);
  });
});
describe("population selection", () => {
  it("changes inherited proportions across generations and preserves a total of 100", () => {
    const next = nextIslandGeneration(defaultAdaptationIslandState);
    expect(next.darkCount).toBeGreaterThan(50);
    expect(next.generation).toBe(1);
    expect(next.darkCount + next.lightCount).toBeCloseTo(100);
    expect(
      nextIslandGeneration({
        ...defaultAdaptationIslandState,
        habitat: "light",
      }).darkCount,
    ).toBeLessThan(50);
  });
  it("keeps proportions fixed with no predators, no variation or at the generation boundary", () => {
    expect(
      nextIslandGeneration({
        ...defaultAdaptationIslandState,
        predators: false,
      }).darkCount,
    ).toBe(50);
    expect(
      nextIslandGeneration({
        ...defaultAdaptationIslandState,
        darkCount: 0,
        lightCount: 100,
      }).darkCount,
    ).toBe(0);
    const end = { ...defaultAdaptationIslandState, generation: 20 };
    expect(nextIslandGeneration(end)).toEqual(end);
  });
  it("reset retains the habitat and predation controls for fair comparison", () => {
    expect(
      resetIsland({
        ...defaultAdaptationIslandState,
        habitat: "light",
        generation: 8,
        darkCount: 3,
        lightCount: 97,
      }),
    ).toEqual({ ...defaultAdaptationIslandState, habitat: "light" });
  });
});
