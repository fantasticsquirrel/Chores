import { describe, expect, it } from "vitest";
import {
  CARAVAN_ROUTE_TRIAL,
  CARAVAN_SEASON_TRIAL,
  calculateCaravanJourney,
  caravanJourney,
  compareCaravanPlans,
} from "./caravans";

describe("caravan teaching model", () => {
  it("keeps the season comparison controlled and reports exact evidence", () => {
    const comparison = compareCaravanPlans(
      CARAVAN_SEASON_TRIAL.baseline,
      CARAVAN_SEASON_TRIAL.comparison,
    );

    expect(CARAVAN_SEASON_TRIAL.baseline).toMatchObject({
      route: "river",
      season: "wet",
      cargo: "grain",
      units: 6,
      supplyDays: 14,
    });
    expect(CARAVAN_SEASON_TRIAL.comparison).toEqual({
      ...CARAVAN_SEASON_TRIAL.baseline,
      season: "dry",
    });
    expect(comparison).toEqual({
      baseline: {
        days: 8,
        spoiled: 0,
        broken: 0,
        delivered: 6,
        cargoWeight: 36,
        supplyWeight: 28,
        load: 64,
        capacity: 100,
        capacityRemaining: 36,
        shortfall: 0,
        unusedSupplyDays: 6,
        overCapacity: false,
        toll: 12,
        purchaseCost: 24,
        supplyCost: 14,
        costs: 50,
        revenue: 42,
        margin: -8,
        viable: true,
      },
      comparison: {
        days: 14,
        spoiled: 2,
        broken: 0,
        delivered: 4,
        cargoWeight: 36,
        supplyWeight: 28,
        load: 64,
        capacity: 100,
        capacityRemaining: 36,
        shortfall: 0,
        unusedSupplyDays: 0,
        overCapacity: false,
        toll: 12,
        purchaseCost: 24,
        supplyCost: 14,
        costs: 50,
        revenue: 28,
        margin: -22,
        viable: true,
      },
      change: {
        days: 6,
        delivered: -2,
        load: 0,
        costs: 0,
        margin: -14,
      },
    });
  });

  it("shows why the longer fictional route can outperform the shorter one", () => {
    const comparison = compareCaravanPlans(
      CARAVAN_ROUTE_TRIAL.baseline,
      CARAVAN_ROUTE_TRIAL.comparison,
    );

    expect(CARAVAN_ROUTE_TRIAL.baseline).toMatchObject({
      route: "ridge",
      season: "dry",
      cargo: "pottery",
      units: 6,
      supplyDays: 12,
    });
    expect(CARAVAN_ROUTE_TRIAL.comparison).toEqual({
      ...CARAVAN_ROUTE_TRIAL.baseline,
      route: "oasis",
    });
    expect(comparison).toMatchObject({
      baseline: {
        days: 9,
        broken: 1,
        delivered: 5,
        load: 66,
        toll: 8,
        costs: 50,
        revenue: 50,
        margin: 0,
        viable: true,
      },
      comparison: {
        days: 12,
        broken: 0,
        delivered: 6,
        load: 66,
        toll: 3,
        costs: 45,
        revenue: 60,
        margin: 15,
        viable: true,
      },
      change: {
        days: 3,
        delivered: 1,
        load: 0,
        costs: -5,
        margin: 15,
      },
    });
  });

  it("rejects invalid, fractional, non-finite and out-of-range inputs", () => {
    const valid = {
      route: "river",
      season: "wet",
      cargo: "cloth",
      units: 1,
      supplyDays: 0,
    } as const;
    for (const input of [
      { ...valid, route: "sea" },
      { ...valid, route: "constructor" },
      { ...valid, route: "toString" },
      { ...valid, route: "__proto__" },
      { ...valid, season: "storm" },
      { ...valid, cargo: "glass" },
      { ...valid, cargo: "constructor" },
      { ...valid, cargo: "toString" },
      { ...valid, cargo: "__proto__" },
      { ...valid, units: 0 },
      { ...valid, units: 16 },
      { ...valid, units: 1.5 },
      { ...valid, units: Number.NaN },
      { ...valid, supplyDays: -1 },
      { ...valid, supplyDays: 21 },
      { ...valid, supplyDays: 2.5 },
      { ...valid, supplyDays: Number.POSITIVE_INFINITY },
    ])
      expect(calculateCaravanJourney(input as never)).toBeNull();

    expect(() => caravanJourney("river", "wet", "grain", 0, 10)).toThrow(
      RangeError,
    );
    expect(
      compareCaravanPlans(valid, { ...valid, units: Number.NaN }),
    ).toBeNull();
    expect(() =>
      caravanJourney("constructor" as never, "wet", "grain", 1, 0),
    ).toThrow(RangeError);
  });

  it("accepts both bounded endpoints and keeps every result finite", () => {
    for (const input of [
      {
        route: "ridge",
        season: "dry",
        cargo: "grain",
        units: 1,
        supplyDays: 0,
      },
      {
        route: "oasis",
        season: "wet",
        cargo: "pottery",
        units: 15,
        supplyDays: 20,
      },
    ] as const) {
      const result = calculateCaravanJourney(input);
      expect(result).not.toBeNull();
      expect(
        Object.values(result!)
          .filter((value): value is number => typeof value === "number")
          .every(Number.isFinite),
      ).toBe(true);
    }
    expect(
      calculateCaravanJourney({
        route: "oasis",
        season: "wet",
        cargo: "pottery",
        units: 15,
        supplyDays: 20,
      }),
    ).toMatchObject({ load: 145, capacityRemaining: -45, overCapacity: true });
  });
});
