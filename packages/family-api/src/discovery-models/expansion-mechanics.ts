/** Deterministic SI-unit teaching models, shared by web, native and scene builders. */
export type MachineState = {
  mode: "pulley" | "lever" | "gears";
  loadKg: number;
  advantage: number;
  liftM: number;
};
export {
  defaultHeatState,
  heatHouseBoundary,
  heatHouseTrials,
  heatResult,
  heatWallMaterials,
  normalizeHeat,
  type HeatHouseTrial,
  type HeatState,
} from "./heat-house";
export {
  ATMOSPHERIC_PRESSURE_PA,
  GRAVITY_M_PER_S2,
  PRESSURE_SENSOR_AREA_CM2,
  PRESSURE_SENSOR_AREA_M2,
  PRESSURE_TANK_MAX_HEIGHT_M,
  WATER_DENSITY_KG_PER_M3,
  defaultPressureState,
  normalizePressure,
  pressureResult,
  pressureTankBoundary,
  pressureTankTrials,
  tankWidthAt,
  type PressureState,
  type PressureTankTrial,
} from "./pressure-tank";
export const defaultMachineState: MachineState = {
  mode: "pulley",
  loadKg: 40,
  advantage: 2,
  liftM: 0.5,
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
  const outputWorkJ = loadForceN * s.liftM,
    inputWorkJ = inputForceN * inputDistanceM;
  return {
    ratio: s.advantage,
    loadMassKg: s.loadKg,
    loadForceN,
    loadWeightN: loadForceN,
    inputForceN,
    idealInputForceN: inputForceN,
    inputDistanceM,
    inputTravelM: inputDistanceM,
    outputWorkJ,
    gravitationalEnergyGainJ: outputWorkJ,
    inputWorkJ,
    idealInputWorkJ: inputWorkJ,
    // This is the defining ideal-model assumption, not a measured ratio at zero lift.
    idealEfficiencyPercent: 100 as const,
    inputTorqueNm: inputForceN * 0.2,
    outputTorqueNm: loadForceN * 0.2,
    crankTurns: inputDistanceM / (2 * Math.PI * 0.2),
  };
}
