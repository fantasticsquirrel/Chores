/** Focused exports retained here for compatibility with existing Earth consumers. */
export * from "./moving-plates";

/** Bounded teaching inputs shared by the remaining Earth models. */
const bound = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
export interface CloudState {
  temperatureC: number;
  vaporGPerKg: number;
  upliftM: number;
  dropletGrowth: number;
}
export const initialCloud: CloudState = {
  temperatureC: 22,
  vaporGPerKg: 10,
  upliftM: 1400,
  dropletGrowth: 30,
};
export function normalizeCloud(s: CloudState): CloudState {
  return {
    temperatureC: bound(s.temperatureC, 20, 35, 22),
    vaporGPerKg: bound(s.vaporGPerKg, 2, 14, 10),
    upliftM: bound(s.upliftM, 0, 2000, 1400),
    dropletGrowth: bound(s.dropletGrowth, 0, 100, 30),
  };
}
/** Fixed 1000 hPa surface pressure, Tetens dew point and approximate LCL.
 * Fixed dry/moist lapse rates omit mixing and changing moist thermodynamics.
 * Droplet-growth threshold and rain index are invented, not a weather forecast. */
export function cloudResult(input: CloudState) {
  const s = normalizeCloud(input),
    vaporPressure = (1000 * s.vaporGPerKg) / (622 + s.vaporGPerKg);
  const log = Math.log(vaporPressure / 6.112),
    dewPointC = (243.5 * log) / (17.67 - log);
  const condensationHeightM = Math.max(0, (s.temperatureC - dewPointC) * 125);
  const dryRise = Math.min(s.upliftM, condensationHeightM),
    cloudDepthM = Math.max(0, s.upliftM - condensationHeightM);
  const parcelTemperatureC =
    s.temperatureC - dryRise * 0.0098 - cloudDepthM * 0.006;
  const cloud = s.upliftM >= condensationHeightM;
  const rain = cloud && s.dropletGrowth >= 65;
  const rainIndex = rain ? Math.min(100, (s.dropletGrowth - 60) * 2.5) : 0;
  return {
    dewPointC,
    condensationHeightM,
    parcelTemperatureC,
    cloudDepthM,
    cloud,
    rain,
    rainIndex,
  };
}
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
