import { describe, expect, it } from "vitest";
import {
  adaptationIslandBoundary,
  adaptationIslandTrials,
  advanceIslandGenerations,
  normalizeAdaptationIslandState,
} from "./adaptation-island";
import { defaultAdaptationIslandState } from "./expansion-life-geometry";

describe("Adaptation Island shared investigations", () => {
  it("normalizes bounded shares, generation and complementary totals", () => {
    expect(
      normalizeAdaptationIslandState({
        habitat: "invalid" as "dark",
        predators: false,
        generation: 40,
        darkCount: -5,
        lightCount: 300,
        initialDark: Number.NaN,
      }),
    ).toEqual({
      habitat: "dark",
      predators: false,
      generation: 20,
      darkCount: 0,
      lightCount: 100,
      initialDark: 50,
    });
  });

  it("preserves 100 percent and stops at generation 20", () => {
    const result = advanceIslandGenerations(defaultAdaptationIslandState, 30);
    expect(result.generation).toBe(20);
    expect(result.darkCount + result.lightCount).toBeCloseTo(100, 10);
    expect(result.darkCount).toBeGreaterThan(99.99);
  });

  it("defines exact habitat and predation evidence with correct answers", () => {
    expect(adaptationIslandTrials.map((trial) => trial.correctChoice)).toEqual([
      "Different proportions",
      "Proportions stay fixed",
    ]);
    expect(adaptationIslandTrials[0].before.darkCount).toBeCloseTo(94.98, 1);
    expect(adaptationIslandTrials[0].after.darkCount).toBeCloseTo(5.02, 1);
    expect(adaptationIslandTrials[1].after.darkCount).toBe(50);
    for (const trial of adaptationIslandTrials) {
      expect(trial.choices).toContain(trial.correctChoice);
      expect(trial.held.length).toBeGreaterThan(3);
      expect(trial.evidence).toMatch(/five|5\.0|50\.0/i);
    }
  });

  it("states invented weights and omitted evolutionary forces", () => {
    expect(adaptationIslandBoundary).toMatch(/mutation, migration/);
    expect(adaptationIslandBoundary).toMatch(/Individuals retain/);
  });
});
