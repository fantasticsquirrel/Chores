import { describe, expect, it } from "vitest";
import {
  SOLAR_DIAMETER_COMPARISON,
  SOLAR_ORBIT_COMPARISON,
  SOLAR_PLANETS,
  compareSolarTrials,
  planetAngle,
  solarSystemActivity,
} from "./solar";

describe("solar system teaching model", () => {
  it("keeps the eight planets in order with NASA-based comparison values", () => {
    expect(SOLAR_PLANETS.map((planet) => planet.name)).toEqual([
      "Mercury",
      "Venus",
      "Earth",
      "Mars",
      "Jupiter",
      "Saturn",
      "Uranus",
      "Neptune",
    ]);
    const [earth, neptune] = SOLAR_ORBIT_COMPARISON.map((inputs) =>
      solarSystemActivity(inputs),
    );
    expect(earth.orbitFraction).toBe(1);
    expect(neptune.orbitFraction).toBeCloseTo(1 / 164.8);
    expect(compareSolarTrials(earth.inputs, neptune.inputs)).toEqual({
      changed: ["planet"],
      held: ["elapsed time"],
    });
  });

  it("compares diameters on one linear scale", () => {
    const [earth, jupiter] = SOLAR_DIAMETER_COMPARISON.map((inputs) =>
      solarSystemActivity(inputs),
    );
    expect(earth.diameterEarths).toBe(1);
    expect(jupiter.diameterEarths).toBeCloseTo(11.2092, 3);
    expect(jupiter.planet.diameterKm).toBe(142_984);
  });

  it("bounds invalid planet indices and elapsed time before rendering", () => {
    expect(
      solarSystemActivity({ selected: Number.NaN, earthYears: Infinity })
        .inputs,
    ).toEqual({ selected: 2, earthYears: 0 });
    expect(
      solarSystemActivity({ selected: 99, earthYears: -4 }).inputs,
    ).toEqual({ selected: 7, earthYears: 0 });
    expect(
      solarSystemActivity({ selected: -8, earthYears: 999 }).inputs,
    ).toEqual({ selected: 0, earthYears: 165 });
  });

  it("uses each stored orbital period without changing the starting phase", () => {
    expect(planetAngle(2, 1) - planetAngle(2, 0)).toBeCloseTo(Math.PI * 2);
    expect((planetAngle(7, 1) - planetAngle(7, 0)) / (Math.PI * 2)).toBeCloseTo(
      1 / 164.8,
    );
  });
});
