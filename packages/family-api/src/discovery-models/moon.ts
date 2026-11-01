export const MOON_SYNODIC_DAYS = 29.53059;
export const MOON_SIDEREAL_DAYS = 27.32166;

export type MoonPhaseInputs = { angle: number };
export type MoonPhaseName =
  | "New Moon"
  | "Waxing crescent"
  | "First quarter"
  | "Waxing gibbous"
  | "Full Moon"
  | "Waning gibbous"
  | "Last quarter"
  | "Waning crescent";

function boundAngle(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(360, value));
}

export function normalizeMoonPhaseInputs(
  inputs: MoonPhaseInputs,
): MoonPhaseInputs {
  return { angle: boundAngle(inputs.angle) };
}

export function moonPhaseName(angle: number): MoonPhaseName {
  const normalized = ((boundAngle(angle) % 360) + 360) % 360;
  if (normalized < 10 || normalized > 350) return "New Moon";
  if (normalized < 80) return "Waxing crescent";
  if (normalized < 100) return "First quarter";
  if (normalized < 170) return "Waxing gibbous";
  if (normalized < 190) return "Full Moon";
  if (normalized < 260) return "Waning gibbous";
  if (normalized < 280) return "Last quarter";
  return "Waning crescent";
}

/**
 * Circular, coplanar phase geometry. Angle 0° is New Moon, with the Moon on
 * Earth's Sun-facing side; 180° is Full Moon. This is a phase teaching model,
 * not an ephemeris or eclipse predictor.
 */
export function moonPhaseActivity(raw: MoonPhaseInputs) {
  const inputs = normalizeMoonPhaseInputs(raw);
  const radians = (inputs.angle * Math.PI) / 180;
  const visibleFraction = (1 - Math.cos(radians)) / 2;
  return {
    inputs,
    phase: moonPhaseName(inputs.angle),
    visibleFraction,
    visiblePercent: Math.round(visibleFraction * 100),
    lightSide:
      inputs.angle === 0 || inputs.angle === 180 || inputs.angle === 360
        ? ("centered" as const)
        : inputs.angle < 180
          ? ("right" as const)
          : ("left" as const),
    cycleDay: (inputs.angle / 360) * MOON_SYNODIC_DAYS,
  };
}

export function compareMoonTrials(
  first: MoonPhaseInputs,
  second: MoonPhaseInputs,
) {
  const a = moonPhaseActivity(first);
  const b = moonPhaseActivity(second);
  const changed: string[] = [];
  if (a.inputs.angle !== b.inputs.angle) changed.push("orbital position");
  if (a.lightSide !== b.lightSide) changed.push("lit side in Earth view");
  return {
    changed,
    held: ["Sun direction", "Earth viewpoint", "sunlit half of Moon"],
  };
}
