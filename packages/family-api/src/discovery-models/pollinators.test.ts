import { describe, expect, it } from "vitest";
import {
  POLLINATOR_COMPATIBILITY_TRIAL,
  POLLINATOR_COMPATIBILITY_TARGETS,
  POLLINATOR_HABITAT_TRIAL,
  POLLINATOR_TEACHING_ASSUMPTIONS,
  calculatePollinatorVisit,
  comparePollinatorRoutes,
  initialPollinator,
  runPollinatorRoute,
} from "./pollinators";

describe("pollinator teaching model", () => {
  it("keeps the flower-type comparison controlled and reports exact evidence", () => {
    const comparison = comparePollinatorRoutes(
      POLLINATOR_COMPATIBILITY_TRIAL.baseline,
      POLLINATOR_COMPATIBILITY_TRIAL.comparison,
    );

    expect(POLLINATOR_COMPATIBILITY_TRIAL.comparison).toEqual({
      ...POLLINATOR_COMPATIBILITY_TRIAL.baseline,
      trialSpecies: "violet",
    });
    expect(POLLINATOR_COMPATIBILITY_TRIAL.baseline.flowerIds).toEqual([
      "a",
      "trial",
    ]);
    expect(POLLINATOR_COMPATIBILITY_TARGETS.gold).toMatchObject({
      species: "gold",
      x: POLLINATOR_COMPATIBILITY_TARGETS.violet.x,
      y: POLLINATOR_COMPATIBILITY_TARGETS.violet.y,
    });
    expect(POLLINATOR_COMPATIBILITY_TARGETS.violet.species).toBe("violet");
    expect(comparison).toMatchObject({
      baseline: {
        visits: 2,
        transfers: 1,
        receivedCount: 1,
        blockedAttempts: 0,
      },
      comparison: {
        visits: 2,
        transfers: 0,
        receivedCount: 0,
        blockedAttempts: 0,
      },
      change: { visits: 0, transfers: -1, receivedCount: -1 },
    });
  });

  it("shows that the invented habitat stop connects the fixed-reach route", () => {
    const comparison = comparePollinatorRoutes(
      POLLINATOR_HABITAT_TRIAL.baseline,
      POLLINATOR_HABITAT_TRIAL.comparison,
    );

    expect(POLLINATOR_HABITAT_TRIAL.comparison).toEqual({
      ...POLLINATOR_HABITAT_TRIAL.baseline,
      habitat: true,
    });
    expect(POLLINATOR_HABITAT_TRIAL.baseline.flowerIds).toEqual([
      "a",
      "b",
      "bridge-a",
      "d",
    ]);
    expect(comparison).toMatchObject({
      baseline: {
        visits: 2,
        transfers: 1,
        receivedCount: 1,
        blockedAttempts: 2,
        reachedTarget: false,
      },
      comparison: {
        visits: 4,
        transfers: 3,
        receivedCount: 3,
        blockedAttempts: 0,
        reachedTarget: true,
      },
    });
  });

  it("rejects inherited-looking flower ids and invalid numerical inputs", () => {
    const state = initialPollinator();
    for (const flowerId of ["constructor", "toString", "__proto__", "missing"])
      expect(
        calculatePollinatorVisit({
          state,
          flowerId,
          reach: 170,
          habitat: false,
        }),
      ).toBeNull();

    for (const reach of [79, 241, 170.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(
        calculatePollinatorVisit({
          state,
          flowerId: "a",
          reach,
          habitat: false,
        }),
      ).toBeNull();

    expect(
      runPollinatorRoute({
        reach: 170,
        habitat: false,
        flowerIds: ["a", "constructor"],
      }),
    ).toBeNull();
  });

  it("returns null without throwing for malformed or contradictory pollen", () => {
    const state = initialPollinator();
    for (const pollen of [
      undefined,
      7,
      "gold",
      {},
      { species: "gold" },
      { sourceId: "a" },
      { species: "gold", sourceId: "missing" },
      { species: "gold", sourceId: "c" },
    ]) {
      const input = { ...state, pollen } as never;
      expect(() =>
        calculatePollinatorVisit({
          state: input,
          flowerId: "a",
          reach: 170,
          habitat: false,
        }),
      ).not.toThrow();
      expect(
        calculatePollinatorVisit({
          state: input,
          flowerId: "a",
          reach: 170,
          habitat: false,
        }),
      ).toBeNull();
    }
  });

  it("rejects unknown coordinates, mismatched path endpoints and unsafe counters", () => {
    const state = initialPollinator();
    for (const malformed of [
      {
        ...state,
        x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        path: [{ x: Number.MAX_VALUE, y: Number.MAX_VALUE }],
      },
      { ...state, x: 140, y: 250 },
      { ...state, path: [{ x: 141, y: 250 }] },
      { ...state, visits: Number.MAX_SAFE_INTEGER },
      { ...state, visits: Number.MAX_SAFE_INTEGER + 1 },
      { ...state, transfers: Number.MAX_SAFE_INTEGER },
    ])
      expect(
        calculatePollinatorVisit({
          state: malformed as never,
          flowerId: "a",
          reach: 170,
          habitat: false,
        }),
      ).toBeNull();

    const nearLimit = {
      ...state,
      visits: Number.MAX_SAFE_INTEGER - 1,
      transfers: 0,
    };
    expect(
      calculatePollinatorVisit({
        state: nearLimit,
        flowerId: "a",
        reach: 170,
        habitat: false,
      })?.state.visits,
    ).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("accepts exactly 24 planned stops and rejects 25", () => {
    const route = (length: number) => ({
      reach: 170,
      habitat: false,
      flowerIds: Array.from({ length }, () => "a"),
    });
    expect(POLLINATOR_TEACHING_ASSUMPTIONS.maximumRouteStops).toBe(24);
    expect(runPollinatorRoute(route(23))).not.toBeNull();
    expect(runPollinatorRoute(route(24))).not.toBeNull();
    expect(runPollinatorRoute(route(25))).toBeNull();
  });

  it("keeps bounded routes finite and does not mutate their input state", () => {
    const state = initialPollinator();
    const result = calculatePollinatorVisit({
      state,
      flowerId: "a",
      reach: 170,
      habitat: false,
    });
    expect(result?.outcome).toBe("visited");
    expect(state).toEqual(initialPollinator());
    expect(
      result &&
        [result.state.x, result.state.y, result.state.visits].every(
          Number.isFinite,
        ),
    ).toBe(true);
  });
});
