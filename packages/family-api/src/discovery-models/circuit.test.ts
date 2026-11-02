import { describe, expect, it } from "vitest";
import {
  CIRCUIT_DEFAULT_INPUTS,
  CIRCUIT_OBSERVATION_SECONDS,
  CIRCUIT_SWITCH_COMPARISON,
  CIRCUIT_VOLTAGE_COMPARISON,
  circuitActivity,
  circuitStateAtPhase,
  compareCircuitTrials,
  normalizeCircuitInputs,
} from "./circuit";

describe("bounded Circuit City ideal-resistor model", () => {
  it("uses exact Ohm's-law series values and conserves energy and charge", () => {
    const result = circuitActivity(CIRCUIT_DEFAULT_INPUTS);

    expect(result.equivalentResistanceOhms).toBe(36);
    expect(result.totalCurrentAmperes).toBeCloseTo(1 / 3);
    expect(result.houseVoltageVolts).toEqual([4, 4, 4]);
    expect(result.housePowerWatts).toEqual([4 / 3, 4 / 3, 4 / 3]);
    expect(result.sourcePowerWatts).toBe(4);
    expect(result.sourceEnergyJoules).toBe(40);
    expect(
      result.houseEnergyJoules.reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(result.sourceEnergyJoules);
    expect(result.sourceChargeCoulombs).toBeCloseTo(10 / 3);
    expect(result.returnedChargeCoulombs).toBeCloseTo(
      result.sourceChargeCoulombs,
    );
    expect(
      result.houseChargeCoulombs.every(
        (value) =>
          Math.abs(value - result.sourceChargeCoulombs) < Number.EPSILON * 8,
      ),
    ).toBe(true);
    expect(CIRCUIT_OBSERVATION_SECONDS).toBe(10);
  });

  it("isolates wiring with house 2 open and preserves independent parallel paths", () => {
    const [series, parallel] = CIRCUIT_SWITCH_COMPARISON.map((inputs) =>
      circuitActivity(inputs),
    );

    expect(series.totalCurrentAmperes).toBe(0);
    expect(series.housePowerWatts).toEqual([0, 0, 0]);
    expect(parallel.houseCurrentAmperes).toEqual([1, 0, 1]);
    expect(parallel.totalCurrentAmperes).toBe(2);
    expect(parallel.sourcePowerWatts).toBe(24);
    expect(parallel.sourceChargeCoulombs).toBe(20);
    expect(
      parallel.houseChargeCoulombs.reduce((sum, value) => sum + value, 0),
    ).toBe(parallel.sourceChargeCoulombs);
    expect(parallel.sourceEnergyJoules).toBe(240);
    expect(compareCircuitTrials(...CIRCUIT_SWITCH_COMPARISON)).toEqual({
      changed: ["wiring arrangement"],
      held: [
        "12 V ideal source",
        "three fixed 12 Ω resistors",
        "house 2 switch open",
        "houses 1 and 3 switches closed",
        "10 s observation interval",
      ],
    });
  });

  it("isolates source voltage: doubling voltage doubles current and quadruples power", () => {
    const [low, high] = CIRCUIT_VOLTAGE_COMPARISON.map((inputs) =>
      circuitActivity(inputs),
    );

    expect(low.houseCurrentAmperes).toEqual([0.5, 0.5, 0.5]);
    expect(high.houseCurrentAmperes).toEqual([1, 1, 1]);
    expect(low.housePowerWatts).toEqual([3, 3, 3]);
    expect(high.housePowerWatts).toEqual([12, 12, 12]);
    expect(high.totalCurrentAmperes).toBe(low.totalCurrentAmperes * 2);
    expect(high.sourcePowerWatts).toBe(low.sourcePowerWatts * 4);
    expect(high.sourceEnergyJoules).toBe(low.sourceEnergyJoules * 4);
    expect(compareCircuitTrials(...CIRCUIT_VOLTAGE_COMPARISON)).toEqual({
      changed: ["source voltage"],
      held: [
        "parallel wiring",
        "three fixed 12 Ω resistors",
        "all switches closed",
        "10 s observation interval",
      ],
    });
  });

  it("bounds invalid inputs and wraps the conventional-current marker phase", () => {
    expect(
      normalizeCircuitInputs({
        mode: "invalid" as "series",
        sourceVoltageVolts: Number.NaN,
        switches: [true, false] as unknown as readonly [
          boolean,
          boolean,
          boolean,
        ],
      }),
    ).toEqual(CIRCUIT_DEFAULT_INPUTS);
    expect(
      normalizeCircuitInputs({
        mode: "parallel",
        sourceVoltageVolts: 900,
        switches: [true, false, true],
      }),
    ).toEqual({
      mode: "parallel",
      sourceVoltageVolts: 18,
      switches: [true, false, true],
    });
    expect(circuitStateAtPhase(CIRCUIT_DEFAULT_INPUTS, 2.25).visualPhase).toBe(
      0.25,
    );
    expect(
      circuitStateAtPhase(CIRCUIT_DEFAULT_INPUTS, Number.NaN).visualPhase,
    ).toBe(0);
    expect(
      Object.values(
        circuitActivity({
          ...CIRCUIT_DEFAULT_INPUTS,
          sourceVoltageVolts: Number.POSITIVE_INFINITY,
        }),
      )
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter((value): value is number => typeof value === "number")
        .every(Number.isFinite),
    ).toBe(true);
  });
});
