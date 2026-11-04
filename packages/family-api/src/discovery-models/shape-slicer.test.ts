import { describe, expect, it } from "vitest";
import {
  diagonalCubeState,
  normalizeShapeSlicerState,
  shapeSlicerBoundary,
  shapeSlicerTrials,
} from "./shape-slicer";
import {
  crossSection,
  defaultShapeSlicerState,
} from "./expansion-life-geometry";

describe("Shape Slicer shared investigations", () => {
  it("bounds every public control", () => {
    expect(
      normalizeShapeSlicerState({
        solid: "invalid" as "cube",
        tilt: -20,
        turn: 200,
        offset: Number.NaN,
      }),
    ).toEqual({ ...defaultShapeSlicerState, turn: 90 });
  });

  it("computes square and six-sided diagonal central cube sections", () => {
    const square = crossSection(defaultShapeSlicerState);
    const hexagon = crossSection(diagonalCubeState);
    expect([square.name, square.points.length, square.area]).toEqual([
      "square",
      4,
      4,
    ]);
    expect(hexagon.name).toBe("hexagon");
    expect(hexagon.points).toHaveLength(6);
    expect(hexagon.area).toBeCloseTo(3 * Math.sqrt(3), 8);
  });

  it("keeps sphere sections circular while radius follows plane height", () => {
    const [center, moved] = shapeSlicerTrials[1]
      ? [
          crossSection(shapeSlicerTrials[1].before),
          crossSection(shapeSlicerTrials[1].after),
        ]
      : [];
    expect(center?.name).toBe("circle");
    expect(moved?.name).toBe("circle");
    expect(moved?.radius).toBeCloseTo(0.8, 10);
    expect((moved?.area ?? 0) / (center?.area ?? 1)).toBeCloseTo(0.64, 10);
  });

  it("defines answers, one changed variable and numerical evidence", () => {
    expect(shapeSlicerTrials.map((trial) => trial.correctChoice)).toEqual([
      "Can make more",
      "Size only",
    ]);
    for (const trial of shapeSlicerTrials) {
      expect(trial.choices).toContain(trial.correctChoice);
      expect(trial.held.length).toBeGreaterThan(2);
      expect(trial.evidence).toMatch(/area/i);
    }
    expect(shapeSlicerBoundary).toMatch(/Camera motion changes only the view/);
  });
});
