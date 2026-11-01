import { describe, expect, it } from "vitest";
import {
  OPTICS_CRITICAL_COMPARISON,
  OPTICS_DIRECTION_COMPARISON,
  criticalAngle,
  opticsActivity,
} from "./optics";

describe("optics classroom model", () => {
  it("measures reflection and refraction from the normal", () => {
    const airToGlass = opticsActivity({
      angle: 30,
      from: "air",
      to: "glass",
    });
    expect(airToGlass.reflectedAngle).toBe(30);
    expect(airToGlass.refractedAngle).toBeCloseTo(19.47, 2);
    expect(airToGlass.direction).toBe("toward");

    const glassToAir = opticsActivity({
      angle: 30,
      from: "glass",
      to: "air",
    });
    expect(glassToAir.reflectedAngle).toBe(30);
    expect(glassToAir.refractedAngle).toBeCloseTo(48.59, 2);
    expect(glassToAir.direction).toBe("away");
  });

  it("keeps a normal-incidence ray straight and removes a false equal-index reflection", () => {
    expect(
      opticsActivity({ angle: 0, from: "air", to: "glass" }).direction,
    ).toBe("straight");
    const equal = opticsActivity({ angle: 52, from: "water", to: "water" });
    expect(equal.reflectedAngle).toBeNull();
    expect(equal.refractedAngle).toBe(52);
    expect(equal.direction).toBe("straight");
  });

  it("distinguishes the critical boundary from total internal reflection", () => {
    const critical = criticalAngle("glass", "air");
    expect(critical).toBeCloseTo(41.81, 2);
    const atBoundary = opticsActivity({
      angle: critical!,
      from: "glass",
      to: "air",
    });
    expect(atBoundary.tir).toBe(false);
    expect(atBoundary.atCriticalAngle).toBe(true);
    expect(atBoundary.refractedAngle).toBeCloseTo(90, 5);
    expect(opticsActivity({ angle: 43, from: "glass", to: "air" }).tir).toBe(
      true,
    );
    expect(criticalAngle("air", "glass")).toBeNull();
    expect(opticsActivity({ angle: 80, from: "air", to: "glass" }).tir).toBe(
      false,
    );
  });

  it("pins the guided comparisons and finite input boundary", () => {
    expect(OPTICS_CRITICAL_COMPARISON.map((trial) => trial.angle)).toEqual([
      40, 43,
    ]);
    expect(
      OPTICS_DIRECTION_COMPARISON.map(({ from, to }) => `${from}-${to}`),
    ).toEqual(["air-glass", "glass-air"]);
    expect(
      opticsActivity({
        angle: Number.POSITIVE_INFINITY,
        from: "air",
        to: "glass",
      }).inputs.angle,
    ).toBe(40);
    expect(
      opticsActivity({ angle: -12, from: "air", to: "glass" }).inputs.angle,
    ).toBe(0);
  });
});
