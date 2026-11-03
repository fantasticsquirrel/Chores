/** Pure, deterministic Heat House teaching model. No renderer or platform dependencies. */
export type HeatState = {
  insulationCm: number;
  windowM2: number;
  material: "brick" | "wood" | "insulation";
  insideC: number;
  outsideC: number;
  elapsedHours: number;
};

export const HEAT_HOUSE_ENVELOPE_AREA_M2 = 60;
export const HEAT_HOUSE_BASE_WALL_THICKNESS_M = 0.2;
export const HEAT_HOUSE_SURFACE_RESISTANCE_M2K_PER_W = 0.17;
export const HEAT_HOUSE_WINDOW_U_W_PER_M2K = 2.8;
export const HEAT_HOUSE_INSULATION_CONDUCTIVITY_W_PER_MK = 0.04;

/** Representative teaching inputs, not product specifications or measurements. */
export const heatWallMaterials = {
  brick: { label: "Brick", conductivity: 0.6 },
  wood: { label: "Wood", conductivity: 0.12 },
  insulation: { label: "Insulated panel", conductivity: 0.04 },
} as const;

export const defaultHeatState: HeatState = {
  insulationCm: 5,
  windowM2: 8,
  material: "brick",
  insideC: 20,
  outsideC: 0,
  elapsedHours: 6,
};

const bound = (n: number, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;

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
    elapsedHours: bound(s.elapsedHours, 0, 24, 6),
  };
}

export function heatResult(input: HeatState) {
  const s = normalizeHeat(input);
  const deltaC = s.insideC - s.outsideC;
  const baseWallResistanceM2KPerW =
    HEAT_HOUSE_BASE_WALL_THICKNESS_M /
    heatWallMaterials[s.material].conductivity;
  const addedInsulationResistanceM2KPerW =
    s.insulationCm / 100 / HEAT_HOUSE_INSULATION_CONDUCTIVITY_W_PER_MK;
  const wallResistanceM2KPerW =
    HEAT_HOUSE_SURFACE_RESISTANCE_M2K_PER_W +
    baseWallResistanceM2KPerW +
    addedInsulationResistanceM2KPerW;
  const wallU = 1 / wallResistanceM2KPerW;
  const windowU = HEAT_HOUSE_WINDOW_U_W_PER_M2K;
  const wallAreaM2 = HEAT_HOUSE_ENVELOPE_AREA_M2 - s.windowM2;
  const wallWatts = wallU * wallAreaM2 * deltaC;
  const windowWatts = windowU * s.windowM2 * deltaC;
  const totalWatts = wallWatts + windowWatts;
  const elapsedSeconds = s.elapsedHours * 60 * 60;
  const wallEnergyJ = wallWatts * elapsedSeconds;
  const windowEnergyJ = windowWatts * elapsedSeconds;
  const totalEnergyJ = totalWatts * elapsedSeconds;
  return {
    wallWatts,
    windowWatts,
    totalWatts,
    wallEnergyJ,
    windowEnergyJ,
    totalEnergyJ,
    wallEnergyKWh: wallEnergyJ / 3_600_000,
    windowEnergyKWh: windowEnergyJ / 3_600_000,
    totalEnergyKWh: totalEnergyJ / 3_600_000,
    elapsedSeconds,
    deltaC,
    deltaK: deltaC,
    direction:
      totalWatts > 0
        ? ("outward" as const)
        : totalWatts < 0
          ? ("inward" as const)
          : ("balanced" as const),
    wallU,
    windowU,
    wallResistanceM2KPerW,
    baseWallResistanceM2KPerW,
    addedInsulationResistanceM2KPerW,
    wallAreaM2,
    windowAreaM2: s.windowM2,
  };
}

export type HeatHouseTrial = {
  id: "wall-insulation" | "window-area";
  title: string;
  question: string;
  choices: readonly string[];
  correctChoice: string;
  controlled: string;
  before: HeatState;
  after: HeatState;
  change: string;
  changed: string;
  held: readonly string[];
  evidence: string;
  explain: string;
};

const noAddedInsulation = {
  ...defaultHeatState,
  insulationCm: 0,
} as const;
const tenCentimeters = {
  ...defaultHeatState,
  insulationCm: 10,
} as const;
const smallWindow = {
  ...tenCentimeters,
  windowM2: 2,
} as const;
const largeWindow = {
  ...tenCentimeters,
  windowM2: 18,
} as const;
const bareResult = heatResult(noAddedInsulation);
const insulatedResult = heatResult(tenCentimeters);
const smallWindowResult = heatResult(smallWindow);
const largeWindowResult = heatResult(largeWindow);

const heldTemperaturesAndTime = [
  "brick base wall",
  "20°C inside",
  "0°C outside",
  "6 h elapsed time",
] as const;

export const heatHouseTrials: readonly HeatHouseTrial[] = [
  {
    id: "wall-insulation",
    title: "Wall insulation",
    question:
      "When only added wall insulation changes from 0 to 10 cm, what happens to the heat-transfer power through the unchanged windows?",
    choices: [
      "Window power falls",
      "Window power stays the same",
      "Window power rises",
    ],
    correctChoice: "Window power stays the same",
    controlled:
      "Start with no added insulation, then change only to 10 cm. Keep brick, 8 m² of windows, both temperatures and elapsed time fixed.",
    before: noAddedInsulation,
    after: tenCentimeters,
    change: "Add 10 cm insulation",
    changed: "added wall insulation, 0 to 10 cm",
    held: [...heldTemperaturesAndTime, "8 m² window area"],
    evidence: `Wall power falls from ${bareResult.wallWatts.toFixed(0)} W to ${insulatedResult.wallWatts.toFixed(0)} W; window power stays ${bareResult.windowWatts.toFixed(0)} W. Combined outward power falls from ${bareResult.totalWatts.toFixed(0)} W to ${insulatedResult.totalWatts.toFixed(0)} W. Over 6 h, transferred energy falls from ${bareResult.totalEnergyKWh.toFixed(2)} kWh to ${insulatedResult.totalEnergyKWh.toFixed(2)} kWh.`,
    explain:
      "Added insulation raises resistance only along the opaque-wall path. The window assembly did not change, so its power did not change. What would you need to change to reduce the window path?",
  },
  {
    id: "window-area",
    title: "Window area",
    question:
      "When only window area grows from 2 to 18 m², what happens to combined outward heat-transfer power?",
    choices: [
      "Combined power rises",
      "Combined power stays the same",
      "Combined power falls",
    ],
    correctChoice: "Combined power rises",
    controlled:
      "Start with 2 m² of windows, then change only to 18 m². The windows replace opaque wall inside the same 60 m² envelope; keep insulation, material, temperatures and elapsed time fixed.",
    before: smallWindow,
    after: largeWindow,
    change: "Use 18 m² windows",
    changed: "window area, 2 to 18 m²",
    held: [
      ...heldTemperaturesAndTime,
      "10 cm added insulation",
      "60 m² wall-and-window envelope",
    ],
    evidence: `Opaque wall area falls from ${smallWindowResult.wallAreaM2.toFixed(0)} to ${largeWindowResult.wallAreaM2.toFixed(0)} m². Combined outward power rises from ${smallWindowResult.totalWatts.toFixed(0)} W to ${largeWindowResult.totalWatts.toFixed(0)} W. Over 6 h, transferred energy rises from ${smallWindowResult.totalEnergyKWh.toFixed(2)} kWh to ${largeWindowResult.totalEnergyKWh.toFixed(2)} kWh because this teaching window has a higher U-factor than the insulated wall.`,
    explain:
      "Area and U-factor both matter. This result belongs to the stated teaching inputs; a different real window or wall can have different U-factors.",
  },
] as const;

export const heatHouseBoundary =
  "This steady-state teaching model holds the indoor and outdoor temperatures fixed. It uses power = U × area × temperature difference for separate opaque-wall and whole-window paths, then multiplies that constant power by elapsed time to calculate transferred energy. The wall U-factor combines a 20 cm base layer, added insulation and a fixed surface resistance; the window U-factor is fixed at 2.8 W/(m²·K). These are ideal teaching inputs, not measurements, product ratings, a weather forecast or an energy-bill estimate. Real building transfer includes conduction through materials, convection in moving fluids and radiation across space; their combined effects are represented only by the simplified U-factors here, not calculated separately. Roof, floor, air leaks, sunlight, moisture, thermal bridges, stored heat and heating or cooling equipment are omitted. Insulation adds thermal resistance and slows transfer through its path; it does not generate thermal energy.";
