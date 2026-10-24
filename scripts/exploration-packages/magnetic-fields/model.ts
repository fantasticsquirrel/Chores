/** Bounded teaching inputs shared by web, native controls and scene builders. */
const bound = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
export type PlateBoundary = "divergent" | "convergent" | "transform";
export interface PlateState {
  boundary: PlateBoundary;
  movement: number;
  stress: number;
  slips: number;
}
export const initialPlate: PlateState = {
  boundary: "divergent",
  movement: 20,
  stress: 0,
  slips: 0,
};
export function normalizePlate(s: PlateState): PlateState {
  return {
    boundary: ["divergent", "convergent", "transform"].includes(s.boundary)
      ? s.boundary
      : "divergent",
    movement: bound(s.movement, 0, 100, 20),
    stress: bound(s.stress, 0, 100, 0),
    slips: Math.floor(bound(s.slips, 0, 20, 0)),
  };
}
/** A step is a diagram increment, not years. Slip threshold and residual are invented. */
export function advancePlate(input: PlateState, steps = 1): PlateState {
  const s = normalizePlate(input);
  for (let i = 0; i < Math.floor(bound(steps, 0, 20, 0)); i++) {
    s.movement = Math.min(100, s.movement + 4);
    if (s.boundary === "transform") {
      s.stress += 12;
      if (s.stress >= 60) {
        s.stress = 12;
        s.slips = Math.min(20, s.slips + 1);
      }
    } else s.stress = 0;
  }
  return s;
}
export function plateResult(input: PlateState) {
  const s = normalizePlate(input);
  const terrain =
    s.boundary === "divergent"
      ? "Rift opens; magma forms new crust"
      : s.boundary === "convergent"
        ? "Oceanic plate bends into a subduction zone"
        : "Crust slides sideways along a fault";
  return {
    terrain,
    stress: s.stress,
    slips: s.slips,
    motion:
      s.boundary === "divergent"
        ? "apart"
        : s.boundary === "convergent"
          ? "together"
          : "past each other",
  };
}
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
