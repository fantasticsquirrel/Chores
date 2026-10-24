import { describe, expect, it } from "vitest";
import {
  dropTime,
  moonPhaseStrip,
  refractedAngle,
  illumination,
  productionRate,
  orbitPath,
} from "./models";
describe("native exploration models", () => {
  it("projects the right side at first quarter and left side at third quarter", () => {
    const first = moonPhaseStrip(90, 0, 20),
      third = moonPhaseStrip(270, 0, 20);
    expect(first.left).toBeCloseTo(0);
    expect(first.right).toBe(20);
    expect(third.left).toBe(-20);
    expect(third.right).toBeCloseTo(0);
  });
  it("projects full and new Moon without negative widths", () => {
    expect(moonPhaseStrip(0, 0, 20)).toEqual({ left: 20, right: 20 });
    expect(moonPhaseStrip(180, 0, 20)).toEqual({ left: -20, right: 20 });
    for (let angle = 0; angle <= 360; angle += 15) {
      for (let y = -20; y <= 20; y++) {
        const strip = moonPhaseStrip(angle, y, 20);
        expect(strip.right - strip.left).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("models gravity independently of mass and increases fall time at low gravity", () => {
    expect(dropTime(20, 1.62)).toBeGreaterThan(dropTime(20, 9.81));
  });
  it("uses normal-based angles and total internal reflection", () => {
    expect(refractedAngle(0, 1, 1.5)).toBe(0);
    expect(refractedAngle(60, 1.5, 1)).toBeNull();
  });
  it("distinguishes new and full Moon", () => {
    expect(illumination(0)).toBe(0);
    expect(illumination(180)).toBe(1);
  });
  it("requires both light and water", () => {
    expect(productionRate(0, 100)).toBe(0);
    expect(productionRate(100, 0)).toBe(0);
    expect(productionRate(100, 100)).toBeGreaterThan(productionRate(50, 100));
  });
  it("changes actual orbit with launch speed and keeps results finite", () => {
    const a = orbitPath(0.8),
      b = orbitPath(1.2);
    expect(a).not.toEqual(b);
    expect(a.every((p) => Number.isFinite(p.x + p.y))).toBe(true);
  });
});
