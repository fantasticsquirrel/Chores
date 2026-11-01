import { describe, expect, it } from "vitest";
import {
  compareOrbitInputs,
  orbitActivity,
  orbitGravity,
  ORBIT_MASS_COMPARISON,
  ORBIT_SPEED_COMPARISON,
} from "./orbit";

describe("dimensionless orbit teaching model", () => {
  it("separates collision, circular orbit and escape at fixed mass and start", () => {
    expect(
      ORBIT_SPEED_COMPARISON.map((inputs) => orbitActivity(inputs).outcome),
    ).toEqual(["collision", "orbit", "escape"]);
    expect(ORBIT_SPEED_COMPARISON.map((inputs) => inputs.mass)).toEqual([
      1, 1, 1,
    ]);
    expect(orbitActivity(ORBIT_SPEED_COMPARISON[1]).closestRadius).toBeCloseTo(
      1,
      2,
    );
  });

  it("holds launch speed fixed when central mass changes", () => {
    const [baseline, stronger] = ORBIT_MASS_COMPARISON.map(orbitActivity);
    expect(ORBIT_MASS_COMPARISON.map((inputs) => inputs.speed)).toEqual([1, 1]);
    expect(baseline.closestRadius).toBeCloseTo(1, 2);
    expect(stronger.outcome).toBe("orbit");
    expect(stronger.closestRadius).toBeCloseTo(1 / 3, 2);
    expect(stronger.circularSpeed).toBeCloseTo(Math.sqrt(2));
  });

  it("keeps the exact escape boundary and inverse-square gravity explicit", () => {
    expect(orbitActivity({ speed: Math.sqrt(2), mass: 1 }).outcome).toBe(
      "escape",
    );
    expect(orbitActivity({ speed: Math.sqrt(2) - 0.01, mass: 1 }).outcome).toBe(
      "orbit",
    );
    expect(orbitGravity(1, 2)).toBeCloseTo(0.25);
    expect(orbitGravity(2, 1)).toBeCloseTo(2);
  });

  it("bounds invalid inputs and reports fair-comparison metadata", () => {
    expect(orbitActivity({ speed: Number.NaN, mass: Infinity }).inputs).toEqual(
      { speed: 1, mass: 1 },
    );
    expect(orbitActivity({ speed: -2, mass: 9 }).inputs).toEqual({
      speed: 0,
      mass: 2,
    });
    expect(
      compareOrbitInputs({ speed: 0.6, mass: 1 }, { speed: 1, mass: 1 }),
    ).toEqual({ changed: ["launch speed"], held: ["central mass"] });
    expect(
      compareOrbitInputs({ speed: 1, mass: 1 }, { speed: 1, mass: 2 }),
    ).toEqual({ changed: ["central mass"], held: ["launch speed"] });
  });
});
