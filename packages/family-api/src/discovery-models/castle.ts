export type CastleApproach = "bridge" | "north";

export type CastleInputs = {
  ditchWidthMeters: number;
  wallHeightMeters: number;
  towers: boolean;
  gate: boolean;
  inner: boolean;
  approach: CastleApproach;
  sight: boolean;
};

export const CASTLE_DEFAULT_INPUTS: CastleInputs = {
  ditchWidthMeters: 22,
  wallHeightMeters: 14,
  towers: true,
  gate: true,
  inner: false,
  approach: "bridge",
  sight: false,
};

export const CASTLE_GATE_COMPARISON = [
  { ...CASTLE_DEFAULT_INPUTS, gate: false, approach: "bridge" },
  { ...CASTLE_DEFAULT_INPUTS, gate: false, approach: "north" },
] as const satisfies readonly CastleInputs[];

export const CASTLE_TOWER_COMPARISON = [
  { ...CASTLE_DEFAULT_INPUTS, towers: false, sight: true },
  { ...CASTLE_DEFAULT_INPUTS, towers: true, sight: true },
] as const satisfies readonly CastleInputs[];

function bounded(
  value: number,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

export function normalizeCastleInputs(inputs: CastleInputs): CastleInputs {
  return {
    ...inputs,
    ditchWidthMeters: bounded(inputs.ditchWidthMeters, 0, 36, 22),
    wallHeightMeters: bounded(inputs.wallHeightMeters, 3, 18, 14),
    approach: inputs.approach === "north" ? "north" : "bridge",
  };
}

// The drawn width is compressed so the whole curtain wall remains visible.
export const castleDitchSpan = (widthMeters: number) =>
  bounded(widthMeters, 0, 36, 22) * 0.22;

export function castleRouteEnd(raw: CastleInputs) {
  const inputs = normalizeCastleInputs(raw);
  if (inputs.approach === "bridge") return inputs.gate ? 15.2 : 10;
  return inputs.ditchWidthMeters > 0
    ? -16.5 - castleDitchSpan(inputs.ditchWidthMeters)
    : -13.8;
}

export function castleActivity(raw: CastleInputs) {
  const inputs = normalizeCastleInputs(raw);
  const routeEnd = castleRouteEnd(inputs);
  const routeStart = inputs.approach === "bridge" ? 32 : -31;
  const routeOutcome =
    inputs.approach === "bridge"
      ? inputs.gate
        ? ("blocked by closed gate" as const)
        : ("reaches outer entrance" as const)
      : inputs.ditchWidthMeters > 0
        ? ("stops at ditch" as const)
        : ("reaches solid outer wall" as const);

  return {
    inputs,
    routeEnd,
    routeOutcome,
    routeTravelModelUnits: Math.abs(routeEnd - routeStart),
    sightLineCount: inputs.sight ? (inputs.towers ? 2 : 1) : 0,
    wallHeightScale: inputs.wallHeightMeters / 14,
  };
}

export function compareCastleTrials(first: CastleInputs, second: CastleInputs) {
  const a = normalizeCastleInputs(first);
  const b = normalizeCastleInputs(second);
  const changed: string[] = [];
  if (a.approach !== b.approach) changed.push("approach route");
  if (a.gate !== b.gate) changed.push("gate");
  if (a.ditchWidthMeters !== b.ditchWidthMeters) changed.push("ditch width");
  if (a.towers !== b.towers) changed.push("projecting towers");
  if (a.inner !== b.inner) changed.push("inner wall");
  if (a.sight !== b.sight) changed.push("sight-line overlay");

  const held: string[] = [];
  if (a.approach === b.approach) held.push(`${a.approach} approach`);
  if (a.gate === b.gate) held.push(`${a.gate ? "closed" : "open"} gate`);
  if (a.ditchWidthMeters === b.ditchWidthMeters)
    held.push(`${a.ditchWidthMeters} m ditch`);
  if (a.towers === b.towers)
    held.push(a.towers ? "projecting towers" : "flat curtain walls");
  if (a.inner === b.inner) held.push(`inner wall ${a.inner ? "on" : "off"}`);
  if (a.sight === b.sight && a.sight) held.push("sight-line overlay on");
  return { changed, held };
}
