import {
  CASTLE_DEFAULT_INPUTS,
  castleActivity,
  castleDitchSpan,
  castleRouteEnd,
  normalizeCastleInputs,
} from "@family-manager/family-api/discovery-models/castle";

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
  moat: CASTLE_DEFAULT_INPUTS.ditchWidthMeters,
  wallHeightMeters: CASTLE_DEFAULT_INPUTS.wallHeightMeters,
  towers: CASTLE_DEFAULT_INPUTS.towers,
  gate: CASTLE_DEFAULT_INPUTS.gate,
  inner: CASTLE_DEFAULT_INPUTS.inner,
  approach: CASTLE_DEFAULT_INPUTS.approach,
  sight: CASTLE_DEFAULT_INPUTS.sight,
};

export const castleInputs = (state: CastleState) =>
  normalizeCastleInputs({
    ditchWidthMeters: state.moat,
    wallHeightMeters: state.wallHeightMeters ?? 14,
    towers: state.towers,
    gate: state.gate,
    inner: state.inner,
    approach: state.approach,
    sight: state.sight,
  });

// Exhibit dimensions are schematic: ditch width is compressed to keep the wall visible.
export const ditchSpan = castleDitchSpan;
export function castleObservation(state: CastleState) {
  return castleActivity(castleInputs(state)).routeOutcome;
}
export function routeEnd(state: CastleState) {
  return castleRouteEnd(castleInputs(state));
}

/** Native wall-height control; web reference curtain height is 14 m. */
export const wallHeightScale = (state: CastleState) =>
  castleActivity(castleInputs(state)).wallHeightScale;
