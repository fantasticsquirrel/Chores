import { describe, expect, it } from "vitest";
import {
  POND_DEFAULT_CONDITIONS,
  POND_INITIAL_STATE,
  POND_NUTRIENT_COMPARISON,
  POND_NUTRIENT_COMPARISON_WEEKS,
  POND_PREDATOR_COMPARISON,
  POND_PREDATOR_COMPARISON_WEEKS,
  advancePondWeek,
  comparePondScenarios,
  normalizePondConditions,
  normalizePondState,
  pondStateAtPhase,
  runPondTrial,
} from "./pond";

describe("bounded pond teaching model", () => {
  it("normalizes malformed states and conditions without inventing infinities", () => {
    expect(
      normalizePondConditions({ nutrients: Number.NaN, drought: Infinity }),
    ).toEqual(POND_DEFAULT_CONDITIONS);
    expect(normalizePondConditions({ nutrients: -20, drought: 180 })).toEqual({
      nutrients: 0,
      drought: 100,
    });

    const normalized = normalizePondState({
      algae: Number.NaN,
      zooplankton: -5,
      fish: 140,
      oxygen: Infinity,
      detritus: -Infinity,
    });
    expect(normalized).toEqual({
      algae: POND_INITIAL_STATE.algae,
      zooplankton: 0,
      fish: 100,
      oxygen: POND_INITIAL_STATE.oxygen,
      detritus: POND_INITIAL_STATE.detritus,
    });
  });

  it("keeps every modeled index finite and bounded across extreme trials", () => {
    let state = {
      algae: 100,
      zooplankton: 100,
      fish: 100,
      oxygen: 0,
      detritus: 100,
    };
    for (let week = 0; week < 300; week += 1)
      state = advancePondWeek(state, { nutrients: 100, drought: 100 }).state;

    for (const value of Object.values(state)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it("preserves an absent population until it is explicitly restored", () => {
    let state = { ...POND_INITIAL_STATE, zooplankton: 0, fish: 0 };
    for (let week = 0; week < 20; week += 1)
      state = advancePondWeek(state, POND_DEFAULT_CONDITIONS).state;
    expect(state.zooplankton).toBe(0);
    expect(state.fish).toBe(0);
  });

  it("balances each illustrative feeding-transfer partition", () => {
    const { feeding } = advancePondWeek(
      POND_INITIAL_STATE,
      POND_DEFAULT_CONDITIONS,
    );
    expect(feeding.algaeConsumedIndex).toBeGreaterThan(0);
    expect(feeding.zooplanktonConsumedIndex).toBeGreaterThan(0);
    expect(
      feeding.grazerGrowthFromFeedingIndex +
        feeding.unretainedAfterGrazingIndex,
    ).toBeCloseTo(feeding.algaeConsumedIndex, 10);
    expect(
      feeding.fishGrowthFromFeedingIndex +
        feeding.unretainedAfterPredationIndex,
    ).toBeCloseTo(feeding.zooplanktonConsumedIndex, 10);
  });

  it("runs equal predator trials from the same non-fish starting state", () => {
    const [withFish, withoutFish] = POND_PREDATOR_COMPARISON.map((scenario) =>
      runPondTrial(scenario, POND_PREDATOR_COMPARISON_WEEKS),
    );
    expect(withFish.week).toBe(POND_PREDATOR_COMPARISON_WEEKS);
    expect(withoutFish.week).toBe(POND_PREDATOR_COMPARISON_WEEKS);
    expect(withoutFish.state.fish).toBe(0);
    expect(withoutFish.state.zooplankton).toBeGreaterThan(
      withFish.state.zooplankton,
    );
    expect(withoutFish.state.algae).toBeLessThan(withFish.state.algae);
    expect(comparePondScenarios(...POND_PREDATOR_COMPARISON)).toEqual({
      changed: ["fish presence"],
      held: [
        "nutrient supply index 50",
        "drought severity 0%",
        "same algae, zooplankton, oxygen and detritus starting indices",
        "6 illustrative weeks",
      ],
    });
  });

  it("shows that extra nutrients can worsen oxygen and fish response under fixed drought", () => {
    const [low, high] = POND_NUTRIENT_COMPARISON.map((scenario) =>
      runPondTrial(scenario, POND_NUTRIENT_COMPARISON_WEEKS),
    );
    expect(high.state.algae).toBeGreaterThan(low.state.algae);
    expect(high.state.oxygen).toBeLessThan(low.state.oxygen);
    expect(high.state.fish).toBeLessThan(low.state.fish);
    expect(comparePondScenarios(...POND_NUTRIENT_COMPARISON)).toEqual({
      changed: ["nutrient supply index"],
      held: [
        "drought severity 60%",
        "all three populations present",
        "same starting indices",
        "8 illustrative weeks",
      ],
    });
  });

  it("wraps the optional energy-flow marker phase without changing biology", () => {
    const base = pondStateAtPhase(
      POND_INITIAL_STATE,
      POND_DEFAULT_CONDITIONS,
      0.25,
    );
    const wrapped = pondStateAtPhase(
      POND_INITIAL_STATE,
      POND_DEFAULT_CONDITIONS,
      2.25,
    );
    expect(wrapped).toEqual(base);
    expect(
      pondStateAtPhase(POND_INITIAL_STATE, POND_DEFAULT_CONDITIONS, Number.NaN)
        .energyFlowPhase,
    ).toBe(0);
  });
});
