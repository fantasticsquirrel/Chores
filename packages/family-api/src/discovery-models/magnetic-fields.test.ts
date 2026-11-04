import { describe, expect, it } from "vitest";
import {
  MAGNETIC_BAR_DEPTH,
  MAGNETIC_BAR_LENGTH,
  defaultMagneticState,
  isInsideMagneticBar,
  magneticFieldContributionsAt,
  magneticFieldsTrials,
  magneticResult,
  normalizeMagnetic,
} from "./magnetic-fields";

describe("bounded Magnetic Fields teaching model", () => {
  it("adds both bar-magnet fields as vectors and points the north-seeking end along the sum", () => {
    const state = { ...defaultMagneticState, flipped: true, probeZ: 2 };
    const result = magneticResult(state);
    const contributions = magneticFieldContributionsAt(
      state,
      state.probeX,
      state.probeZ,
    );

    expect(result.x).toBeCloseTo(
      contributions.left.x + contributions.right.x,
      12,
    );
    expect(result.z).toBeCloseTo(
      contributions.left.z + contributions.right.z,
      12,
    );
    expect(result.directionDegrees).toBeCloseTo(90, 8);
    expect(result.directionLabel).toBe("toward +z across the tabletop");
    expect(result.relativeFieldIndex).toBeGreaterThan(0);
  });

  it("distinguishes unlike attraction, like repulsion and exterior north-to-south direction", () => {
    const unlike = magneticResult(defaultMagneticState);
    const like = magneticResult({ ...defaultMagneticState, flipped: true });

    expect(unlike.interaction).toBe("attract");
    expect(unlike.facingPoles).toBe("N–S");
    expect(unlike.x).toBeGreaterThan(0);
    expect(like.interaction).toBe("repel");
    expect(like.facingPoles).toBe("N–N");
  });

  it("reports exact symmetric cancellation without pretending either source disappeared", () => {
    const result = magneticResult({
      ...defaultMagneticState,
      flipped: true,
      probeX: 0,
      probeZ: 0,
    });

    expect(result.directionDegrees).toBeNull();
    expect(result.directionLabel).toBe("no preferred direction");
    expect(result.relativeFieldIndex).toBe(0);
    expect(result.leftContributionIndex).toBeGreaterThan(0);
    expect(result.leftContributionIndex).toBe(result.rightContributionIndex);
  });

  it("bounds nonfinite inputs and excludes the paired-pole surrogate inside either bar", () => {
    expect(
      normalizeMagnetic({
        ...defaultMagneticState,
        gap: Number.NaN,
        probeX: Number.NEGATIVE_INFINITY,
        probeZ: 99,
      }),
    ).toEqual({ ...defaultMagneticState, probeZ: 4 });
    expect(
      magneticResult({ ...defaultMagneticState, probeX: -2, probeZ: 0 })
        .insideMagnet,
    ).toBe(true);
  });

  it("uses the exact 2.0 by 0.8 rendered bar footprint as the exterior-model boundary", () => {
    expect(MAGNETIC_BAR_LENGTH).toBe(2);
    expect(MAGNETIC_BAR_DEPTH).toBe(0.8);

    expect(isInsideMagneticBar(defaultMagneticState, -2, 0)).toBe(true);
    expect(isInsideMagneticBar(defaultMagneticState, -1, 0.4)).toBe(true);
    expect(isInsideMagneticBar(defaultMagneticState, -0.99, 0)).toBe(false);
    expect(isInsideMagneticBar(defaultMagneticState, -2, 0.41)).toBe(false);
  });

  it("defines two prediction-first, one-change comparisons with measured-claim boundaries", () => {
    expect(magneticFieldsTrials).toHaveLength(2);
    expect(magneticFieldsTrials.map((trial) => trial.correctChoice)).toEqual([
      "Interaction reverses",
      "Cancellation only at the midpoint",
    ]);
    expect(magneticFieldsTrials[0].changed).toBe(
      "right magnet orientation, from N–S facing to N–N facing",
    );
    expect(magneticFieldsTrials[1].held).toContain("right magnet flipped");
    expect(magneticFieldsTrials[1].evidence).toMatch(
      /0 normalized field index.*two nonzero contributions/i,
    );
  });
});
