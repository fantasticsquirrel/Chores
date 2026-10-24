import { describe, expect, it } from "vitest";
import {
  circuit,
  riverStorm,
  stringWave,
  bridge,
  initialPond,
  pondWeek,
} from "@family-manager/family-api/discovery-models/physical-world";

describe("physical world teaching models", () => {
  it("separates string pitch from amplitude and follows length and tension ratios", () => {
    const base = stringWave(60, 80, 2);
    expect(stringWave(120, 80, 2).frequency).toBeCloseTo(base.frequency / 2);
    expect(stringWave(60, 320, 2).frequency).toBeCloseTo(base.frequency * 2);
    expect(stringWave(60, 80, 4).frequency).toBe(base.frequency);
    expect(stringWave(60, 80, 4).relativeEnergy).toBe(base.relativeEnergy * 4);
    expect(stringWave(60, 80, 0).relativeEnergy).toBe(0);
  });
  it("opens an entire series circuit but only one parallel branch", () => {
    const closed = circuit("series", 12, [true, true, true]);
    expect(closed.totalCurrent).toBeCloseTo(1 / 3);
    expect(closed.houseVoltage).toEqual([4, 4, 4]);
    expect(circuit("series", 12, [true, false, true]).totalCurrent).toBe(0);
    const parallel = circuit("parallel", 12, [true, false, true]);
    expect(parallel.totalCurrent).toBe(2);
    expect(parallel.houseCurrent).toEqual([1, 0, 1]);
    expect(parallel.houseVoltage).toEqual([12, 0, 12]);
    expect(parallel.totalCurrent).toBe(
      parallel.houseCurrent.reduce((a, b) => a + b),
    );
    expect(circuit("parallel", 0, [true, true, true]).totalCurrent).toBe(0);
  });
  it("conserves rainfall and eroded sediment through a storm", () => {
    const bare = riverStorm(12, 80, 0);
    const planted = riverStorm(12, 80, 100);
    expect(bare.runoff + bare.infiltration).toBeCloseTo(bare.rainVolume);
    expect(bare.deposited + bare.exported).toBeCloseTo(bare.eroded);
    expect(planted.eroded).toBeLessThan(bare.eroded);
    expect(planted.floodVolume).toBeLessThan(bare.floodVolume);
    expect(riverStorm(12, 0, 0).eroded).toBe(0);
    expect(riverStorm(20, 80, 0).eroded).toBeGreaterThan(bare.eroded);
    expect(riverStorm(12, 80, 0, 2).eroded).toBeLessThanOrEqual(2);
  });
  it("balances bridge reactions and makes bracing reduce local demand/capacity", () => {
    const bare = bridge("timber", [false, false, false, false], 10, 50);
    expect(bare.leftReaction + bare.rightReaction).toBeCloseTo(10);
    expect(bare.maxMoment).toBeCloseTo(25);
    const braced = bridge("timber", [false, true, true, false], 10, 50);
    expect(braced.maxUtilization).toBeLessThan(bare.maxUtilization);
    expect(braced.cost).toBeGreaterThan(bare.cost);
    const left = bridge("timber", [false, false, false, false], 10, 25);
    expect(left.leftReaction).toBeCloseTo(7.5);
    expect(left.rightReaction).toBeCloseTo(2.5);
    expect(
      bridge("steel", [false, false, false, false], 10, 50).maxUtilization,
    ).toBeLessThan(bare.maxUtilization);
    expect(
      bridge("timber", [true, true, true, true], 0, 50).maxUtilization,
    ).toBe(0);
  });
  it("preserves absent species and keeps long ecosystem trials bounded", () => {
    const conditions = { nutrients: 100, drought: 100 };
    let pond = { ...initialPond, zooplankton: 0, fish: 0 };
    for (let i = 0; i < 200; i++) pond = pondWeek(pond, conditions);
    expect(pond.zooplankton).toBe(0);
    expect(pond.fish).toBe(0);
    for (const n of [pond.algae, pond.zooplankton, pond.fish, pond.oxygen]) {
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  });
  it("makes removing grazers and adding nutrients increase algae", () => {
    const base = pondWeek(initialPond, { nutrients: 50, drought: 0 });
    const noGrazers = pondWeek(
      { ...initialPond, zooplankton: 0 },
      { nutrients: 50, drought: 0 },
    );
    expect(noGrazers.algae).toBeGreaterThan(base.algae);
    expect(
      pondWeek(initialPond, { nutrients: 100, drought: 0 }).algae,
    ).toBeGreaterThan(base.algae);
    expect(
      pondWeek(initialPond, { nutrients: 50, drought: 100 }).oxygen,
    ).toBeLessThan(base.oxygen);
  });
});
