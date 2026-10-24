import { describe, expect, it } from "vitest";
import {
  traceOrbit,
  refract,
  gravityDrop,
  illuminatedFraction,
  photosynthesis,
} from "./physics";
describe("Exploration models", () => {
  it("keeps a circular orbit near its initial radius", () => {
    const orbit = traceOrbit(1);
    expect(orbit.outcome).toBe("orbit");
    expect(
      Math.max(...orbit.points.map((p) => Math.hypot(p.x, p.y))),
    ).toBeCloseTo(1, 2);
  });
  it("detects collision and escape", () => {
    expect(traceOrbit(0).outcome).toBe("collision");
    expect(traceOrbit(1.6).outcome).toBe("escape");
  });
  it("uses Snell law and detects total internal reflection", () => {
    expect(refract(30, 1, 1.5).angle).toBeCloseTo(19.47, 2);
    expect(refract(50, 1.5, 1).tir).toBe(true);
    expect(refract(0, 1, 1.5).angle).toBe(0);
  });
  it("drops all masses equally in vacuum", () => {
    expect(gravityDrop(10, 9.81).time).toBeCloseTo(Math.sqrt(20 / 9.81));
  });
  it("shows new, quarter, and full Moon", () => {
    expect(illuminatedFraction(0)).toBe(0);
    expect(illuminatedFraction(90)).toBeCloseTo(0.5);
    expect(illuminatedFraction(180)).toBe(1);
  });
  it("limits photosynthesis by the scarcest resource and saturates", () => {
    expect(photosynthesis(100, 0, 100).rate).toBe(0);
    expect(photosynthesis(100, 10, 100).limiting).toBe("water");
    expect(photosynthesis(100, 100, 100).rate).toBeLessThan(100);
  });
  it("keeps the critical-angle ray grazing rather than internally reflected", () => {
    const critical = (Math.asin(1 / 1.5) * 180) / Math.PI;
    expect(refract(critical, 1.5, 1).tir).toBe(false);
    expect(refract(critical, 1.5, 1).angle).toBeCloseTo(90);
  });
  it("increased central mass changes the same launch from escaping to bound", () => {
    expect(traceOrbit(1.6, 1).outcome).toBe("escape");
    expect(traceOrbit(1.6, 2).outcome).toBe("orbit");
  });
});
