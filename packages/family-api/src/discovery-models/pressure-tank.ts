/** Pure, deterministic Pressure Tank teaching model. No renderer or platform dependencies. */
export type PressureState = {
  /** Water-surface height above the tank floor, in metres. */
  depthM: number;
  /** Horizontal outlet height above the tank floor, in metres. */
  outletM: number;
  shape: "narrow" | "wide" | "tapered";
};

export const WATER_DENSITY_KG_PER_M3 = 1_000;
export const GRAVITY_M_PER_S2 = 9.81;
export const ATMOSPHERIC_PRESSURE_PA = 101_325;
export const PRESSURE_SENSOR_AREA_M2 = 0.01;
export const PRESSURE_SENSOR_AREA_CM2 = PRESSURE_SENSOR_AREA_M2 * 10_000;
export const PRESSURE_TANK_MAX_HEIGHT_M = 3;

export const defaultPressureState: PressureState = {
  depthM: 2,
  outletM: 0.5,
  shape: "narrow",
};

const bound = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;

export function normalizePressure(s: PressureState): PressureState {
  return {
    depthM: bound(s.depthM, 0.2, PRESSURE_TANK_MAX_HEIGHT_M, 2),
    outletM: bound(s.outletM, 0.1, 2.5, 0.5),
    shape: s.shape === "wide" || s.shape === "tapered" ? s.shape : "narrow",
  };
}

/**
 * Internal width of the square tank at a height above its floor. The tapered
 * tank widens linearly from 0.8 m at the floor to 1.8 m at 3 m.
 */
export function tankWidthAt(shape: PressureState["shape"], heightM: number) {
  const height = bound(heightM, 0, PRESSURE_TANK_MAX_HEIGHT_M, 0);
  return shape === "wide" ? 1.8 : shape === "tapered" ? 0.8 + height / 3 : 1;
}

export function pressureResult(input: PressureState) {
  const state = normalizePressure(input);
  const headM = Math.max(0, state.depthM - state.outletM);
  const outletSubmerged = headM > 0;
  const gaugePressurePa = WATER_DENSITY_KG_PER_M3 * GRAVITY_M_PER_S2 * headM;
  const absolutePressurePa = ATMOSPHERIC_PRESSURE_PA + gaugePressurePa;
  // Gauge pressure times area is the net force because the closed sensor's
  // opposite face is exposed to the same atmospheric pressure as the tank.
  const sensorNetForceN = gaugePressurePa * PRESSURE_SENSOR_AREA_M2;
  const jetSpeedMps = Math.sqrt(2 * GRAVITY_M_PER_S2 * headM);
  const fallTimeS = outletSubmerged
    ? Math.sqrt((2 * state.outletM) / GRAVITY_M_PER_S2)
    : 0;
  const rangeM = jetSpeedMps * fallTimeS;
  const volumeM3 =
    state.shape === "tapered"
      ? 0.64 * state.depthM +
        (0.8 * state.depthM ** 2) / 3 +
        state.depthM ** 3 / 27
      : tankWidthAt(state.shape, 0) ** 2 * state.depthM;

  return {
    surfaceHeightM: state.depthM,
    outletHeightM: state.outletM,
    headM,
    outletSubmerged,
    gaugePressurePa,
    /** Compatibility alias retained for existing consumers; this is gauge pressure. */
    pressurePa: gaugePressurePa,
    absolutePressurePa,
    atmosphericPressurePa: ATMOSPHERIC_PRESSURE_PA,
    sensorAreaM2: PRESSURE_SENSOR_AREA_M2,
    sensorAreaCm2: PRESSURE_SENSOR_AREA_CM2,
    sensorNetForceN,
    jetSpeedMps,
    fallTimeS,
    rangeM,
    volumeM3,
    volumeLiters: volumeM3 * 1_000,
  };
}

export type PressureTankTrial = {
  id: "raise-surface" | "change-shape";
  title: string;
  question: string;
  choices: readonly string[];
  correctChoice: string;
  controlled: string;
  before: PressureState;
  after: PressureState;
  change: string;
  changed: string;
  held: readonly string[];
  evidence: string;
  explain: string;
};

const lowSurface = { ...defaultPressureState, depthM: 1 } as const;
const highSurface = { ...defaultPressureState, depthM: 2 } as const;
const narrowTank = { ...defaultPressureState, shape: "narrow" } as const;
const wideTank = { ...defaultPressureState, shape: "wide" } as const;
const lowResult = pressureResult(lowSurface);
const highResult = pressureResult(highSurface);
const narrowResult = pressureResult(narrowTank);
const wideResult = pressureResult(wideTank);

const heldModelInputs = [
  "water density 1,000 kg/m³",
  "gravitational acceleration 9.81 m/s²",
  "100 cm² pressure sensor area",
] as const;

export const pressureTankTrials: readonly PressureTankTrial[] = [
  {
    id: "raise-surface",
    title: "Raise the water",
    question:
      "If only the water surface rises from 1 to 2 m while the outlet stays at 0.5 m, what happens to static gauge pressure on the separate wall sensor at that height?",
    choices: [
      "Pressure triples",
      "Pressure doubles",
      "Pressure stays the same",
    ],
    correctChoice: "Pressure triples",
    controlled:
      "Start with the surface at 1 m, then change only to 2 m. Keep the narrow tank and the outlet at 0.5 m.",
    before: lowSurface,
    after: highSurface,
    change: "Raise surface to 2 m",
    changed: "water-surface height, 1 to 2 m",
    held: ["narrow tank", "outlet height 0.5 m", ...heldModelInputs],
    evidence: `Head rises from ${lowResult.headM.toFixed(1)} to ${highResult.headM.toFixed(1)} m. Calculated gauge pressure triples from ${(lowResult.gaugePressurePa / 1_000).toFixed(3)} to ${(highResult.gaugePressurePa / 1_000).toFixed(3)} kPa, and net force on the separate closed 100 cm² wall sensor triples from ${lowResult.sensorNetForceN.toFixed(2)} to ${highResult.sensorNetForceN.toFixed(2)} N. Ideal outlet speed rises from ${lowResult.jetSpeedMps.toFixed(2)} to ${highResult.jetSpeedMps.toFixed(2)} m/s, a factor of √3 rather than 3.`,
    explain:
      "Hydrostatic gauge pressure is ρgh, so it changes directly with head h. Ideal speed is √(2gh), so it changes with the square root of head. Which readout shows each relationship?",
  },
  {
    id: "change-shape",
    title: "Change tank shape",
    question:
      "Will a wider tank send the ideal jet faster when the water-surface and outlet heights stay fixed?",
    choices: ["Same speed", "Faster", "Slower"],
    correctChoice: "Same speed",
    controlled:
      "Start with the narrow tank, then change only to wide. Keep the surface at 2 m and the outlet at 0.5 m; compare an instant before either tank drains.",
    before: narrowTank,
    after: wideTank,
    change: "Use the wide tank",
    changed: "tank shape, narrow to wide",
    held: [
      "water-surface height 2 m",
      "outlet height 0.5 m",
      ...heldModelInputs,
    ],
    evidence: `Volume rises from ${narrowResult.volumeLiters.toLocaleString("en-US", { maximumFractionDigits: 0 })} to ${wideResult.volumeLiters.toLocaleString("en-US", { maximumFractionDigits: 0 })} L, while head stays ${narrowResult.headM.toFixed(1)} m. Calculated gauge pressure stays ${(narrowResult.gaugePressurePa / 1_000).toFixed(3)} kPa, sensor net force stays ${narrowResult.sensorNetForceN.toFixed(2)} N, and ideal speed stays ${narrowResult.jetSpeedMps.toFixed(2)} m/s.`,
    explain:
      "At equal depth in the same liquid, tank width does not enter ρgh. The wide tank stores more water and would lose height more slowly while draining, but draining time is outside this snapshot model.",
  },
] as const;

export const pressureTankBoundary =
  "Bounded ideal model: an open tank of still fresh water with density 1,000 kg/m³, g = 9.81 m/s² and atmosphere 101.325 kPa. Static gauge pressure on the separate closed wall sensor is ρgh; absolute pressure adds atmosphere. Gauge pressure × the fixed 100 cm² area gives net force because the sensor's back face is exposed to atmosphere. The separate nozzle's free jet is approximately atmospheric. Ideal speed √(2gh) assumes incompressible, frictionless flow, negligible surface speed, a small horizontal outlet and equal atmospheric pressure at surface and jet. Range assumes ideal free fall to the floor. Each view freezes the level; it does not simulate draining. It omits viscosity, turbulence, contraction, air drag, splashing, wall stress, temperature-dependent density, pumps and sealed gas. Temperature is not an input, so no kelvin/Celsius conversion is used. Values use displayed teaching constants; dimensions are teaching inputs, not equipment specifications or real-tank guidance.";
