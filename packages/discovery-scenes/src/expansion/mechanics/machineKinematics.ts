import {
  machineResult,
  normalizeMachine,
  type MachineState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";

export type MachinePoint = [number, number, number];

export const MACHINE_LOAD_START_Y = 0.5;
export const MACHINE_LIFT_SCALE = 1;
export const MACHINE_DRUM_RADIUS_M = 0.2;

function arc(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
): MachinePoint[] {
  return Array.from({ length: 17 }, (_, index) => {
    const angle = start + ((end - start) * index) / 16;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 0.24];
  });
}

export function pulleyKinematics(input: MachineState) {
  const state = normalizeMachine({ ...input, mode: "pulley" });
  const topY = 4.45;
  const movingPulleyY = 1.38 + state.liftM * MACHINE_LIFT_SCALE;
  const loadCenterY = MACHINE_LOAD_START_Y + state.liftM * MACHINE_LIFT_SCALE;
  const freeEndY = 4.2 - state.liftM * state.advantage;
  let ropePoints: MachinePoint[];
  let fixedAnchor: MachinePoint | null = null;

  if (state.advantage === 1) {
    ropePoints = [
      [-0.3, movingPulleyY, 0.24],
      ...arc(0, topY, 0.3, Math.PI, 0),
      [0.3, freeEndY, 0.24],
    ];
  } else if (state.advantage === 2) {
    fixedAnchor = [-0.25, topY, 0.24];
    ropePoints = [
      fixedAnchor,
      ...arc(0, movingPulleyY, 0.25, Math.PI, Math.PI * 2),
      ...arc(0.5, topY, 0.25, Math.PI, 0),
      [0.75, freeEndY, 0.24],
    ];
  } else if (state.advantage === 3) {
    ropePoints = [
      [-0.6, movingPulleyY, 0.24],
      ...arc(-0.4, topY, 0.2, Math.PI, 0),
      ...arc(0, movingPulleyY, 0.2, Math.PI, Math.PI * 2),
      ...arc(0.4, topY, 0.2, Math.PI, 0),
      [0.6, freeEndY, 0.24],
    ];
  } else {
    fixedAnchor = [-0.6, topY, 0.24];
    ropePoints = [
      fixedAnchor,
      ...arc(-0.4, movingPulleyY, 0.2, Math.PI, Math.PI * 2),
      ...arc(0, topY, 0.2, Math.PI, 0),
      ...arc(0.4, movingPulleyY, 0.2, Math.PI, Math.PI * 2),
      ...arc(0.8, topY, 0.2, Math.PI, 0),
      [1, freeEndY, 0.24],
    ];
  }

  return {
    state,
    topY,
    movingPulleyY,
    loadCenterY,
    freeEndY,
    ropePoints,
    fixedAnchor,
    supportingSectionCount: state.advantage,
  };
}

export function leverKinematics(input: MachineState) {
  const state = normalizeMachine({ ...input, mode: "lever" });
  const pivotX = -1.15;
  const pivotY = 4.05;
  const outputArmM = 1.15;
  const angle = -Math.asin((state.liftM * MACHINE_LIFT_SCALE) / outputArmM);
  const loadX = pivotX - outputArmM * Math.cos(angle);
  const loadArmY = pivotY - outputArmM * Math.sin(angle);
  const loadCenterY = loadArmY - 0.66;
  const effortX = pivotX + outputArmM * state.advantage * Math.cos(angle);
  const effortY = pivotY + outputArmM * state.advantage * Math.sin(angle);
  return {
    state,
    pivotX,
    pivotY,
    outputArmM,
    angle,
    loadX,
    loadArmY,
    loadCenterY,
    effortX,
    effortY,
  };
}

export function gearKinematics(input: MachineState) {
  const state = normalizeMachine({ ...input, mode: "gears" });
  const driverRadius = 0.22;
  const drivenRadius = driverRadius * state.advantage;
  const drivenX = 0.55;
  const gearY = 3;
  const driverX = drivenX - driverRadius - drivenRadius - 0.04;
  const inputTurns = machineResult(state).crankTurns;
  const drumTurns = inputTurns / state.advantage;
  return {
    state,
    driverRadius,
    drivenRadius,
    driverTeeth: 12,
    drivenTeeth: 12 * state.advantage,
    driverX,
    drivenX,
    gearY,
    crankRadiusM: MACHINE_DRUM_RADIUS_M,
    drumRadiusM: MACHINE_DRUM_RADIUS_M,
    inputTurns,
    drumTurns,
    inputAngle: -inputTurns * Math.PI * 2,
    outputAngle: drumTurns * Math.PI * 2 + Math.PI / (12 * state.advantage),
    loadCenterY: MACHINE_LOAD_START_Y + state.liftM * MACHINE_LIFT_SCALE,
  };
}
