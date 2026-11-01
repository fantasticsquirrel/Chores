import { describe, expect, it } from "vitest";
import {
  CASTLE_GATE_COMPARISON,
  CASTLE_TOWER_COMPARISON,
  castleActivity,
  compareCastleTrials,
} from "./castle";

describe("Castle defense teaching model", () => {
  it("compares two open-gate routes while holding the ditch and features fixed", () => {
    const [bridge, north] = CASTLE_GATE_COMPARISON.map(castleActivity);

    expect(bridge.routeOutcome).toBe("reaches outer entrance");
    expect(north.routeOutcome).toBe("stops at ditch");
    expect(bridge.routeTravelModelUnits).toBeCloseTo(22);
    expect(north.routeTravelModelUnits).toBeCloseTo(9.66);
    expect(compareCastleTrials(bridge.inputs, north.inputs)).toEqual({
      changed: ["approach route"],
      held: ["open gate", "22 m ditch", "projecting towers", "inner wall off"],
    });
  });

  it("compares illustrative wall-side views with every other input held", () => {
    const [flatWall, projectingTower] =
      CASTLE_TOWER_COMPARISON.map(castleActivity);

    expect(flatWall.sightLineCount).toBe(1);
    expect(projectingTower.sightLineCount).toBe(2);
    expect(
      compareCastleTrials(flatWall.inputs, projectingTower.inputs),
    ).toEqual({
      changed: ["projecting towers"],
      held: [
        "bridge approach",
        "closed gate",
        "22 m ditch",
        "inner wall off",
        "sight-line overlay on",
      ],
    });
  });

  it("bounds invalid dimensions without inventing siege outcomes", () => {
    const low = castleActivity({
      ...CASTLE_GATE_COMPARISON[0],
      ditchWidthMeters: Number.NaN,
      wallHeightMeters: -20,
    });
    const high = castleActivity({
      ...CASTLE_GATE_COMPARISON[0],
      ditchWidthMeters: 100,
      wallHeightMeters: Infinity,
    });

    expect(low.inputs.ditchWidthMeters).toBe(22);
    expect(low.inputs.wallHeightMeters).toBe(3);
    expect(high.inputs.ditchWidthMeters).toBe(36);
    expect(high.inputs.wallHeightMeters).toBe(14);
    expect(high).not.toHaveProperty("siegeOutcome");
  });
});
