export type GravityWorldId = "earth" | "moon" | "mars";

export type GravityDropInputs = {
  height: number;
  mass: number;
  gravity: number;
};

export type GravityWorld = {
  id: GravityWorldId;
  name: string;
  gravity: number;
};

export const GRAVITY_WORLDS = [
  { id: "earth", name: "Earth", gravity: 9.81 },
  { id: "moon", name: "Moon", gravity: 1.62 },
  { id: "mars", name: "Mars", gravity: 3.71 },
] as const satisfies readonly GravityWorld[];

export const GRAVITY_MASS_COMPARISON = [
  { height: 20, mass: 1, gravity: 9.81 },
  { height: 20, mass: 10, gravity: 9.81 },
] as const satisfies readonly GravityDropInputs[];

export const GRAVITY_WORLD_COMPARISON = [
  { height: 20, mass: 5, gravity: 9.81 },
  { height: 20, mass: 5, gravity: 1.62 },
] as const satisfies readonly GravityDropInputs[];

function bound(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

export function normalizeGravityDropInputs(
  inputs: GravityDropInputs,
): GravityDropInputs {
  return {
    height: bound(inputs.height, 5, 50, 20),
    mass: bound(inputs.mass, 1, 20, 5),
    gravity: bound(inputs.gravity, 1.62, 25, 9.81),
  };
}

/**
 * One-dimensional, constant-g release from rest. The result is an ideal vacuum
 * comparison over a small height, not a trajectory through an atmosphere.
 */
export function gravityDropActivity(raw: GravityDropInputs) {
  const inputs = normalizeGravityDropInputs(raw);
  return {
    inputs,
    acceleration: inputs.gravity,
    weight: inputs.mass * inputs.gravity,
    fallTime: Math.sqrt((2 * inputs.height) / inputs.gravity),
    impactSpeed: Math.sqrt(2 * inputs.height * inputs.gravity),
  };
}

export function gravityDropAtTime(raw: GravityDropInputs, rawElapsed: number) {
  const trial = gravityDropActivity(raw);
  const elapsed = Number.isFinite(rawElapsed) ? Math.max(0, rawElapsed) : 0;
  const landed = elapsed >= trial.fallTime;
  const distance = landed
    ? trial.inputs.height
    : 0.5 * trial.inputs.gravity * elapsed ** 2;
  return {
    elapsed,
    distance,
    remaining: Math.max(0, trial.inputs.height - distance),
    speed: landed ? 0 : trial.inputs.gravity * elapsed,
    landed,
  };
}

export function compareGravityTrials(
  first: GravityDropInputs,
  second: GravityDropInputs,
) {
  const a = normalizeGravityDropInputs(first);
  const b = normalizeGravityDropInputs(second);
  const changed: string[] = [];
  const held: string[] = [];
  for (const [label, equal] of [
    ["release height", a.height === b.height],
    ["mass", a.mass === b.mass],
    ["local gravity", a.gravity === b.gravity],
  ] as const) {
    (equal ? held : changed).push(label);
  }
  return { changed, held };
}
