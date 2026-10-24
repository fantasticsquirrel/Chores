import { describe, expect, it } from "vitest";
import {
  PLANETS,
  fallAtTime,
  planetAngle,
  trajectoryView,
} from "./spaceModels";
import { traceOrbit } from "../physics";

describe("space exhibit scientific invariants", () => {
  it("keeps exactly eight planets in solar order and real relative periods", () => {
    expect(PLANETS.map((p) => p.name)).toEqual([
      "Mercury",
      "Venus",
      "Earth",
      "Mars",
      "Jupiter",
      "Saturn",
      "Uranus",
      "Neptune",
    ]);
    expect(planetAngle(2, 1) - planetAngle(2, 0)).toBeCloseTo(2 * Math.PI);
    expect((planetAngle(7, 1) - planetAngle(7, 0)) / (2 * Math.PI)).toBeCloseTo(
      1 / 165,
    );
    expect(PLANETS[4].diameter / PLANETS[2].diameter).toBeGreaterThan(11);
  });
  it("stops both drop objects at the floor and never calculates negative speed", () => {
    expect(fallAtTime(20, 9.81, 0)).toMatchObject({
      distance: 0,
      speed: 0,
      landed: false,
    });
    expect(fallAtTime(20, 9.81, 100)).toMatchObject({
      distance: 20,
      speed: 0,
      landed: true,
    });
    expect(fallAtTime(20, 1.62, 1).distance).toBeCloseTo(0.81);
    expect(fallAtTime(20, 9.81, 1).distance).toBeCloseTo(4.905);
  });
  it("fits every trajectory including collisions and escape without changing model radii", () => {
    for (const speed of [0, 0.2, 1, 1.42, 1.8]) {
      const orbit = traceOrbit(speed, 1);
      const view = trajectoryView(orbit.points);
      expect(Number.isFinite(view.extent)).toBe(true);
      expect(view.extent).toBeGreaterThan(1);
      for (const point of orbit.points) {
        expect(Math.abs(point.x - view.centerX)).toBeLessThan(view.extent);
        expect(Math.abs(point.y - view.centerY)).toBeLessThan(view.extent);
      }
    }
  });
});
