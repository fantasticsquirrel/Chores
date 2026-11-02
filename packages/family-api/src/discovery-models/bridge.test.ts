import { describe, expect, it } from "vitest";
import {
  BRIDGE_DEFAULT_INPUTS,
  BRIDGE_LOAD_COMPARISON,
  BRIDGE_POSITION_COMPARISON,
  BRIDGE_SPAN_METERS,
  BRIDGE_VISUAL_MAX_DEFLECTION_MILLIMETERS,
  bridgeActivity,
  bridgeDeflectionMillimetersAt,
  bridgeDeflectionVisualFraction,
  bridgeProfileDeflectionMillimetersAt,
  bridgeStateAtPhase,
  compareBridgeTrials,
} from "./bridge";

describe("bounded Bridge Builder beam model", () => {
  it("balances reactions and reduces peak moment when the same load moves toward a support", () => {
    const [center, nearLeft] = BRIDGE_POSITION_COMPARISON.map(bridgeActivity);

    expect(center.leftReactionKilonewtons).toBe(6);
    expect(center.rightReactionKilonewtons).toBe(6);
    expect(center.peakBendingMomentKilonewtonMeters).toBe(30);
    expect(center.deflectionAtLoadMillimeters).toBeCloseTo(2.5);
    expect(nearLeft.leftReactionKilonewtons).toBeCloseTo(9.6);
    expect(nearLeft.rightReactionKilonewtons).toBeCloseTo(2.4);
    expect(nearLeft.peakBendingMomentKilonewtonMeters).toBeCloseTo(19.2);
    expect(nearLeft.deflectionAtLoadMillimeters).toBeCloseTo(1.024);
    expect(
      nearLeft.leftReactionKilonewtons + nearLeft.rightReactionKilonewtons,
    ).toBeCloseTo(nearLeft.inputs.pointLoadKilonewtons);
    expect(compareBridgeTrials(...BRIDGE_POSITION_COMPARISON)).toEqual({
      changed: ["load position"],
      held: [
        "12 kN point load",
        "100 MN·m² flexural rigidity",
        "10 m span",
        "no brace-index modifiers",
      ],
    });
  });

  it("doubles reactions, moment and deflection when only the point load doubles", () => {
    const [light, heavy] = BRIDGE_LOAD_COMPARISON.map(bridgeActivity);

    expect(heavy.leftReactionKilonewtons).toBe(
      light.leftReactionKilonewtons * 2,
    );
    expect(heavy.rightReactionKilonewtons).toBe(
      light.rightReactionKilonewtons * 2,
    );
    expect(heavy.peakBendingMomentKilonewtonMeters).toBe(
      light.peakBendingMomentKilonewtonMeters * 2,
    );
    expect(heavy.deflectionAtLoadMillimeters).toBeCloseTo(
      light.deflectionAtLoadMillimeters * 2,
    );
    expect(compareBridgeTrials(...BRIDGE_LOAD_COMPARISON)).toEqual({
      changed: ["point load"],
      held: [
        "50% load position",
        "100 MN·m² flexural rigidity",
        "10 m span",
        "no brace-index modifiers",
      ],
    });

    const renderedDepths = BRIDGE_LOAD_COMPARISON.map((inputs) =>
      Math.max(
        ...Array.from({ length: 41 }, (_, index) =>
          bridgeDeflectionVisualFraction(
            bridgeDeflectionMillimetersAt(
              inputs,
              (index / 40) * BRIDGE_SPAN_METERS,
            ),
          ),
        ),
      ),
    );
    expect(renderedDepths[1]).toBeCloseTo(renderedDepths[0] * 2);
  });

  it("uses the bounded maximum as one fixed display scale and reconstructs the exact profile", () => {
    const bound = bridgeActivity({
      ...BRIDGE_DEFAULT_INPUTS,
      pointLoadKilonewtons: 30,
      flexuralRigidityMeganewtonMetersSquared: 50,
    });
    expect(bound.deflectionAtLoadMillimeters).toBeCloseTo(
      BRIDGE_VISUAL_MAX_DEFLECTION_MILLIMETERS,
    );
    expect(
      bridgeDeflectionVisualFraction(bound.deflectionAtLoadMillimeters),
    ).toBe(1);
    for (const inputs of [
      BRIDGE_DEFAULT_INPUTS,
      BRIDGE_POSITION_COMPARISON[1],
    ]) {
      const result = bridgeActivity(inputs);
      for (let index = 0; index <= 40; index++) {
        const positionMeters = (index / 40) * BRIDGE_SPAN_METERS;
        expect(
          bridgeProfileDeflectionMillimetersAt(
            result.inputs.loadPositionPercent,
            result.deflectionAtLoadMillimeters,
            positionMeters,
          ),
        ).toBeCloseTo(
          bridgeDeflectionMillimetersAt(result.inputs, positionMeters),
        );
      }
    }
  });

  it("keeps the beam calculation independent of the invented brace-reference index", () => {
    const bare = bridgeActivity(BRIDGE_DEFAULT_INPUTS);
    const braced = bridgeActivity({
      ...BRIDGE_DEFAULT_INPUTS,
      braces: [false, true, false, false],
    });

    expect(braced.leftReactionKilonewtons).toBe(bare.leftReactionKilonewtons);
    expect(braced.rightReactionKilonewtons).toBe(bare.rightReactionKilonewtons);
    expect(braced.peakBendingMomentKilonewtonMeters).toBe(
      bare.peakBendingMomentKilonewtonMeters,
    );
    expect(braced.deflectionAtLoadMillimeters).toBe(
      bare.deflectionAtLoadMillimeters,
    );
    expect(braced.braceReferenceUseIndex[1]).toBeCloseTo(
      bare.braceReferenceUseIndex[1] / 2.4,
    );
  });

  it("halves deflection when EI doubles and returns zero under zero load", () => {
    const baseline = bridgeActivity(BRIDGE_DEFAULT_INPUTS);
    const stiffer = bridgeActivity({
      ...BRIDGE_DEFAULT_INPUTS,
      flexuralRigidityMeganewtonMetersSquared: 200,
    });
    const unloaded = bridgeActivity({
      ...BRIDGE_DEFAULT_INPUTS,
      pointLoadKilonewtons: 0,
    });

    expect(stiffer.leftReactionKilonewtons).toBe(
      baseline.leftReactionKilonewtons,
    );
    expect(stiffer.peakBendingMomentKilonewtonMeters).toBe(
      baseline.peakBendingMomentKilonewtonMeters,
    );
    expect(stiffer.deflectionAtLoadMillimeters).toBeCloseTo(
      baseline.deflectionAtLoadMillimeters / 2,
    );
    expect(unloaded.leftReactionKilonewtons).toBe(0);
    expect(unloaded.rightReactionKilonewtons).toBe(0);
    expect(unloaded.peakBendingMomentKilonewtonMeters).toBe(0);
    expect(unloaded.deflectionAtLoadMillimeters).toBe(0);
    expect(unloaded.braceReferenceUseIndex).toEqual([0, 0, 0, 0]);
  });

  it("bounds non-finite inputs and wraps the slowed load-path phase", () => {
    expect(
      bridgeActivity({
        pointLoadKilonewtons: Number.NaN,
        loadPositionPercent: Infinity,
        flexuralRigidityMeganewtonMetersSquared: -20,
        braces: [true],
      }).inputs,
    ).toEqual({
      pointLoadKilonewtons: 12,
      loadPositionPercent: 50,
      flexuralRigidityMeganewtonMetersSquared: 50,
      braces: [true, false, false, false],
    });
    expect(
      bridgeActivity({
        pointLoadKilonewtons: 99,
        loadPositionPercent: -10,
        flexuralRigidityMeganewtonMetersSquared: 999,
        braces: [false, false, false, false, true],
      }).inputs,
    ).toEqual({
      pointLoadKilonewtons: 30,
      loadPositionPercent: 5,
      flexuralRigidityMeganewtonMetersSquared: 250,
      braces: [false, false, false, false],
    });
    expect(bridgeStateAtPhase(BRIDGE_DEFAULT_INPUTS, 1.25).visualPhase).toBe(
      0.25,
    );
    expect(bridgeStateAtPhase(BRIDGE_DEFAULT_INPUTS, -0.25).visualPhase).toBe(
      0.75,
    );
  });
});
