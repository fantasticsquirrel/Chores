/** Deterministic SI-unit teaching models, shared by web, native and scene builders. */
export type MachineState = {
  mode: "pulley" | "lever" | "gears";
  loadKg: number;
  advantage: number;
  liftM: number;
};
export type HeatState = {
  insulationCm: number;
  windowM2: number;
  material: "brick" | "wood" | "insulation";
  insideC: number;
  outsideC: number;
};
export type PressureState = {
  depthM: number;
  outletM: number;
  shape: "narrow" | "wide" | "tapered";
};
export const defaultMachineState: MachineState = {
  mode: "pulley",
  loadKg: 40,
  advantage: 2,
  liftM: 0.5,
};
export const defaultHeatState: HeatState = {
  insulationCm: 5,
  windowM2: 8,
  material: "brick",
  insideC: 20,
  outsideC: 0,
};
export const defaultPressureState: PressureState = {
  depthM: 2,
  outletM: 0.5,
  shape: "narrow",
};
const bound = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
export function normalizeMachine(s: MachineState): MachineState {
  return {
    mode: s.mode === "lever" || s.mode === "gears" ? s.mode : "pulley",
    loadKg: bound(s.loadKg, 10, 100, 40),
    advantage: Math.round(bound(s.advantage, 1, 4, 2)),
    liftM: bound(s.liftM, 0, 1, 0.5),
  };
}
export function machineResult(input: MachineState) {
  const s = normalizeMachine(input),
    loadForceN = s.loadKg * 9.81;
  const inputForceN = loadForceN / s.advantage,
    inputDistanceM = s.liftM * s.advantage;
  return {
    ratio: s.advantage,
    loadForceN,
    inputForceN,
    inputDistanceM,
    outputWorkJ: loadForceN * s.liftM,
    inputWorkJ: inputForceN * inputDistanceM,
    inputTorqueNm: inputForceN * 0.2,
    outputTorqueNm: loadForceN * 0.2,
    crankTurns: inputDistanceM / (2 * Math.PI * 0.2),
  };
}
/** Representative teaching conductivities, not product specifications. */
export const heatWallMaterials = {
  brick: { label: "Brick", conductivity: 0.6 },
  wood: { label: "Wood", conductivity: 0.12 },
  insulation: { label: "Insulated panel", conductivity: 0.04 },
} as const;
export function normalizeHeat(s: HeatState): HeatState {
  return {
    insulationCm: bound(s.insulationCm, 0, 20, 5),
    windowM2: bound(s.windowM2, 2, 18, 8),
    material:
      s.material === "wood" || s.material === "insulation"
        ? s.material
        : "brick",
    insideC: bound(s.insideC, 16, 24, 20),
    outsideC: bound(s.outsideC, -5, 25, 0),
  };
}
export function heatResult(input: HeatState) {
  const s = normalizeHeat(input),
    deltaC = s.insideC - s.outsideC;
  // 20 cm base wall + optional added insulation + fixed surface resistance.
  const wallU =
    1 /
    (0.17 +
      0.2 / heatWallMaterials[s.material].conductivity +
      s.insulationCm / 100 / 0.04);
  const windowU = 2.8,
    wallAreaM2 = 60 - s.windowM2;
  const wallWatts = wallU * wallAreaM2 * deltaC,
    windowWatts = windowU * s.windowM2 * deltaC;
  return {
    wallWatts,
    windowWatts,
    totalWatts: wallWatts + windowWatts,
    deltaC,
    wallU,
    windowU,
    wallAreaM2,
    windowAreaM2: s.windowM2,
  };
}
export function normalizePressure(s: PressureState): PressureState {
  return {
    depthM: bound(s.depthM, 0.2, 3, 2),
    outletM: bound(s.outletM, 0.1, 2.5, 0.5),
    shape: s.shape === "wide" || s.shape === "tapered" ? s.shape : "narrow",
  };
}
/** Square tanks, tapered width grows linearly from 0.8 m at floor to 1.8 m at 3 m. */
export function tankWidthAt(shape: PressureState["shape"], heightM: number) {
  return shape === "wide" ? 1.8 : shape === "tapered" ? 0.8 + heightM / 3 : 1;
}
export function pressureResult(input: PressureState) {
  const s = normalizePressure(input),
    headM = Math.max(0, s.depthM - s.outletM);
  const pressurePa = 1000 * 9.81 * headM,
    jetSpeedMps = Math.sqrt(2 * 9.81 * headM);
  const volumeM3 =
    s.shape === "tapered"
      ? 0.64 * s.depthM + (0.8 * s.depthM ** 2) / 3 + s.depthM ** 3 / 27
      : tankWidthAt(s.shape, 0) ** 2 * s.depthM;
  return {
    headM,
    pressurePa,
    jetSpeedMps,
    rangeM: jetSpeedMps * Math.sqrt((2 * s.outletM) / 9.81),
    volumeLiters: volumeM3 * 1000,
  };
}
