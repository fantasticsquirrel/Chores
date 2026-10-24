// Independent package authoring source, copied from the bundled Castle reference.
export type CastleState = {
  moat: number;
  wallHeightMeters?: number;
  towers: boolean;
  gate: boolean;
  inner: boolean;
  approach: "bridge" | "north";
  sight: boolean;
};
export const defaultCastleState: CastleState = {
  moat: 22,
  towers: true,
  gate: true,
  inner: false,
  approach: "bridge",
  sight: false,
};
// Exhibit dimensions are schematic: ditch width is compressed to keep the wall visible.
export const ditchSpan = (width: number) => width * 0.22;
export function castleObservation(state: CastleState) {
  return state.approach === "bridge"
    ? state.gate
      ? "blocked by closed gate"
      : "reaches outer entrance"
    : state.moat > 0
      ? "obstructed by ditch"
      : "reaches solid outer wall";
}
export function routeEnd(state: CastleState) {
  if (state.approach === "bridge") return state.gate ? 15.2 : 10;
  return state.moat > 0 ? -16.5 - ditchSpan(state.moat) : -13.8;
}

/** Native wall-height control; web reference curtain height is 14 m. */
export const wallHeightScale = (state: CastleState) =>
  Math.max(3, Math.min(18, state.wallHeightMeters ?? 14)) / 14;
