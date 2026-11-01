import { describe, expect, it } from "vitest";
import {
  MOON_SIDEREAL_DAYS,
  MOON_SYNODIC_DAYS,
  compareMoonTrials,
  moonPhaseActivity,
} from "./moon";

describe("Moon phase teaching model", () => {
  it("maps the four cardinal orbital positions to Earth-view phases", () => {
    expect(
      [0, 90, 180, 270, 360].map((angle) => {
        const result = moonPhaseActivity({ angle });
        return [result.phase, result.visiblePercent];
      }),
    ).toEqual([
      ["New Moon", 0],
      ["First quarter", 50],
      ["Full Moon", 100],
      ["Last quarter", 50],
      ["New Moon", 0],
    ]);
  });

  it("keeps opposite quarters equal in fraction but different in direction", () => {
    const first = moonPhaseActivity({ angle: 90 });
    const last = moonPhaseActivity({ angle: 270 });
    expect(first.visibleFraction).toBeCloseTo(0.5);
    expect(last.visibleFraction).toBeCloseTo(0.5);
    expect(first.lightSide).toBe("right");
    expect(last.lightSide).toBe("left");
    expect(compareMoonTrials(first.inputs, last.inputs)).toEqual({
      changed: ["orbital position", "lit side in Earth view"],
      held: ["Sun direction", "Earth viewpoint", "sunlit half of Moon"],
    });
  });

  it("bounds nonfinite and out-of-range angles before rendering", () => {
    expect(moonPhaseActivity({ angle: Number.NaN }).inputs.angle).toBe(0);
    expect(moonPhaseActivity({ angle: -20 }).inputs.angle).toBe(0);
    expect(moonPhaseActivity({ angle: 720 }).inputs.angle).toBe(360);
  });

  it("distinguishes the mean phase cycle from the sidereal orbit", () => {
    expect(MOON_SYNODIC_DAYS).toBeCloseTo(29.53059, 5);
    expect(MOON_SIDEREAL_DAYS).toBeCloseTo(27.32166, 5);
    expect(MOON_SYNODIC_DAYS).toBeGreaterThan(MOON_SIDEREAL_DAYS);
    expect(moonPhaseActivity({ angle: 180 }).cycleDay).toBeCloseTo(
      MOON_SYNODIC_DAYS / 2,
    );
  });
});
