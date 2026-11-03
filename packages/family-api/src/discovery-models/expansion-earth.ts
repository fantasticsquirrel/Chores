/** Focused exports retained here for compatibility with existing Earth consumers. */
export * from "./moving-plates";
export * from "./cloud-rain";

/** Bounded teaching inputs shared by the remaining Earth models. */
const bound = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
export interface MagneticState {
  gap: number;
  flipped: boolean;
  probeX: number;
  probeZ: number;
}
export const initialMagnetic: MagneticState = {
  gap: 2,
  flipped: false,
  probeX: 0,
  probeZ: 2,
};
export function normalizeMagnetic(s: MagneticState): MagneticState {
  return {
    gap: bound(s.gap, 0.5, 4.5, 2),
    flipped: s.flipped === true,
    probeX: bound(s.probeX, -6, 6, 0),
    probeZ: bound(s.probeZ, -4, 4, 2),
  };
}
export function magneticPoles(input: MagneticState) {
  const s = normalizeMagnetic(input),
    c = 1 + s.gap / 2,
    right = s.flipped ? -1 : 1;
  return [
    { x: -c - 1, sign: -1 },
    { x: -c + 1, sign: 1 },
    { x: c - 1, sign: -right },
    { x: c + 1, sign: right },
  ];
}
/** Exterior field direction from paired softened poles. A schematic, not monopoles in nature. */
export function magneticFieldAt(input: MagneticState, x: number, z: number) {
  let bx = 0,
    bz = 0;
  for (const pole of magneticPoles(input)) {
    const dx = x - pole.x,
      distance = (dx * dx + z * z + 0.08) ** 1.5;
    bx += (pole.sign * dx) / distance;
    bz += (pole.sign * z) / distance;
  }
  return { x: bx, z: bz, strength: Math.hypot(bx, bz) };
}
export function magneticResult(input: MagneticState) {
  const s = normalizeMagnetic(input),
    field = magneticFieldAt(s, s.probeX, s.probeZ),
    c = 1 + s.gap / 2;
  const insideMagnet =
    Math.abs(s.probeZ) < 0.48 && Math.abs(Math.abs(s.probeX) - c) < 1.05;
  return {
    ...field,
    insideMagnet,
    direction:
      insideMagnet || field.strength < 0.00001
        ? null
        : (Math.atan2(field.z, field.x) * 180) / Math.PI,
    interaction: s.flipped ? ("repel" as const) : ("attract" as const),
    interactionIndex: 100 / (s.gap + 1) ** 2,
  };
}
