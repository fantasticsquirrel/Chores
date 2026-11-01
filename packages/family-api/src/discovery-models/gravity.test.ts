import { describe, expect, it } from "vitest";
import {
  GRAVITY_MASS_COMPARISON,
  GRAVITY_WORLD_COMPARISON,
  compareGravityTrials,
  gravityDropActivity,
  gravityDropAtTime,
} from "./gravity";

describe("vacuum gravity drop teaching model", () => {
  it("changes weight but not acceleration or fall time when only mass changes", () => {
    const [light, heavy] = GRAVITY_MASS_COMPARISON.map(gravityDropActivity);
    expect(compareGravityTrials(light.inputs, heavy.inputs)).toEqual({
      changed: ["mass"],
      held: ["release height", "local gravity"],
    });
    expect(light.fallTime).toBeCloseTo(heavy.fallTime);
    expect(light.acceleration).toBe(9.81);
    expect(heavy.acceleration).toBe(9.81);
    expect(heavy.weight).toBeCloseTo(light.weight * 10);
    expect(gravityDropAtTime(light.inputs, 1).distance).toBeCloseTo(
      gravityDropAtTime(heavy.inputs, 1).distance,
    );
  });

  it("changes local acceleration and weight while keeping mass and height fixed", () => {
    const [earth, moon] = GRAVITY_WORLD_COMPARISON.map(gravityDropActivity);
    expect(compareGravityTrials(earth.inputs, moon.inputs)).toEqual({
      changed: ["local gravity"],
      held: ["release height", "mass"],
    });
    expect(earth.fallTime).toBeCloseTo(2.019, 3);
    expect(moon.fallTime).toBeCloseTo(4.969, 3);
    expect(earth.weight).toBeCloseTo(49.05);
    expect(moon.weight).toBeCloseTo(8.1);
    expect(
      gravityDropAtTime(moon.inputs, earth.fallTime).remaining,
    ).toBeCloseTo(16.7, 1);
  });

  it("clamps time at release and at the ideal floor", () => {
    const trial = gravityDropActivity({ height: 20, mass: 5, gravity: 9.81 });
    expect(gravityDropAtTime(trial.inputs, -2)).toEqual({
      elapsed: 0,
      distance: 0,
      remaining: 20,
      speed: 0,
      landed: false,
    });
    expect(gravityDropAtTime(trial.inputs, 99)).toMatchObject({
      distance: 20,
      remaining: 0,
      speed: 0,
      landed: true,
    });
  });

  it("bounds non-finite and out-of-range scene inputs", () => {
    expect(
      gravityDropActivity({ height: Number.NaN, mass: Infinity, gravity: -4 })
        .inputs,
    ).toEqual({ height: 20, mass: 5, gravity: 1.62 });
    expect(
      gravityDropActivity({ height: 100, mass: -2, gravity: 40 }).inputs,
    ).toEqual({ height: 50, mass: 1, gravity: 25 });
  });
});
