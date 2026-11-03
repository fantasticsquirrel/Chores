/** Deterministic isolated-package mirror of the shared Machine Workshop model. */
export type MachineState = {
  mode: "pulley" | "lever" | "gears";
  loadKg: number;
  advantage: number;
  liftM: number;
};
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
  return {
    ratio: s.advantage,
    loadMassKg: s.loadKg,
    loadForceN,
    loadWeightN: loadForceN,
    inputForceN,
    idealInputForceN: inputForceN,
    inputDistanceM,
    inputTravelM: inputDistanceM,
    outputWorkJ: loadForceN * s.liftM,
    gravitationalEnergyGainJ: loadForceN * s.liftM,
    inputWorkJ: inputForceN * inputDistanceM,
    idealInputWorkJ: inputForceN * inputDistanceM,
    // This is the defining ideal-model assumption, not a measured zero-lift ratio.
    idealEfficiencyPercent: 100 as const,
    inputTorqueNm: inputForceN * 0.2,
    outputTorqueNm: loadForceN * 0.2,
    crankTurns: inputDistanceM / (2 * Math.PI * 0.2),
  };
}
