export const OPTICAL_MATERIALS = {
  air: { id: "air", name: "Air", refractiveIndex: 1 },
  water: { id: "water", name: "Water", refractiveIndex: 1.333 },
  glass: { id: "glass", name: "Glass", refractiveIndex: 1.5 },
} as const;

export type OpticalMaterialId = keyof typeof OPTICAL_MATERIALS;
export type OpticsInputs = {
  angle: number;
  from: OpticalMaterialId;
  to: OpticalMaterialId;
};
export type RefractionDirection = "straight" | "toward" | "away" | "tir";

export const OPTICS_CRITICAL_COMPARISON = [
  { angle: 40, from: "glass", to: "air" },
  { angle: 43, from: "glass", to: "air" },
] as const satisfies readonly OpticsInputs[];

export const OPTICS_DIRECTION_COMPARISON = [
  { angle: 30, from: "air", to: "glass" },
  { angle: 30, from: "glass", to: "air" },
] as const satisfies readonly OpticsInputs[];

function boundedAngle(value: number) {
  if (!Number.isFinite(value)) return 40;
  return Math.max(0, Math.min(80, value));
}

export function criticalAngle(from: OpticalMaterialId, to: OpticalMaterialId) {
  const fromIndex = OPTICAL_MATERIALS[from].refractiveIndex;
  const toIndex = OPTICAL_MATERIALS[to].refractiveIndex;
  if (fromIndex <= toIndex) return null;
  return (Math.asin(toIndex / fromIndex) * 180) / Math.PI;
}

/**
 * Single-wavelength geometric-ray model. Angles are measured from the normal.
 * It calculates direction only; drawn ray brightness is not a Fresnel energy
 * split and absorption, scattering, dispersion and polarization are omitted.
 */
export function opticsActivity(raw: OpticsInputs) {
  const inputs = { ...raw, angle: boundedAngle(raw.angle) };
  const from = OPTICAL_MATERIALS[inputs.from];
  const to = OPTICAL_MATERIALS[inputs.to];
  const incidenceRadians = (inputs.angle * Math.PI) / 180;
  const transmittedSine =
    (from.refractiveIndex / to.refractiveIndex) * Math.sin(incidenceRadians);
  const boundaryTolerance = 1e-10;
  const tir = transmittedSine > 1 + boundaryTolerance;
  const atCriticalAngle =
    !tir && Math.abs(transmittedSine - 1) <= boundaryTolerance;
  const equalIndices =
    Math.abs(from.refractiveIndex - to.refractiveIndex) <= boundaryTolerance;
  const refractedAngle = tir
    ? null
    : equalIndices
      ? inputs.angle
      : (Math.asin(Math.max(-1, Math.min(1, transmittedSine))) * 180) / Math.PI;
  let direction: RefractionDirection;
  if (tir) direction = "tir";
  else if (equalIndices || inputs.angle === 0) direction = "straight";
  else if (to.refractiveIndex > from.refractiveIndex) direction = "toward";
  else direction = "away";

  return {
    inputs,
    from,
    to,
    reflectedAngle: equalIndices ? null : inputs.angle,
    refractedAngle,
    criticalAngle: criticalAngle(inputs.from, inputs.to),
    atCriticalAngle,
    tir,
    direction,
  };
}
