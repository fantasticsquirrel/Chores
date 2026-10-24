import { describe, expect, it } from "vitest";
import {
  castleObservation,
  defaultCastleState,
  routeEnd,
  wallHeightScale,
} from "./castleState";

describe("castle route evidence", () => {
  it("keeps the web reference height while supporting native height controls", () => {
    expect(wallHeightScale(defaultCastleState)).toBe(1);
    expect(
      wallHeightScale({ ...defaultCastleState, wallHeightMeters: 7 }),
    ).toBe(0.5);
    expect(
      wallHeightScale({ ...defaultCastleState, wallHeightMeters: 18 }),
    ).toBe(18 / 14);
  });
  it("stops the bridge route at a closed gate, not the moat", () => {
    expect(castleObservation(defaultCastleState)).toBe(
      "blocked by closed gate",
    );
    expect(routeEnd(defaultCastleState)).toBe(15.2);
    expect(castleObservation({ ...defaultCastleState, gate: false })).toBe(
      "reaches outer entrance",
    );
    expect(routeEnd({ ...defaultCastleState, gate: false })).toBe(10);
  });
  it("distinguishes a ditch from a solid wall and never invents a north entrance", () => {
    expect(
      castleObservation({ ...defaultCastleState, approach: "north" }),
    ).toBe("obstructed by ditch");
    expect(
      castleObservation({ ...defaultCastleState, approach: "north", moat: 0 }),
    ).toBe("reaches solid outer wall");
    expect(
      routeEnd({ ...defaultCastleState, approach: "north", moat: 0 }),
    ).toBe(-13.8);
  });
  it("does not use towers or inner wall as a siege outcome calculation", () => {
    expect(
      castleObservation({
        ...defaultCastleState,
        gate: false,
        inner: true,
        towers: false,
      }),
    ).toBe("reaches outer entrance");
  });
});
