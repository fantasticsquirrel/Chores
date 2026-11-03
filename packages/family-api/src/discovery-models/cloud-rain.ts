/** Pure, bounded Cloud and Rain teaching model shared by web and native. */
export type CloudState = {
  /** Starting parcel temperature, in degrees Celsius. */
  temperatureC: number;
  /** Starting relative humidity, in percent. */
  relativeHumidityPercent: number;
  /** Parcel lift above its starting level, in metres. */
  upliftM: number;
  /** Representative liquid particle diameter inside the parcel, in micrometres. */
  particleDiameterUm: number;
  /** Relative humidity in the simplified layer below cloud base, in percent. */
  subcloudRelativeHumidityPercent: number;
};

export const CLOUD_SURFACE_PRESSURE_HPA = 1_000;
export const CLOUD_DRY_LAPSE_C_PER_KM = 9.8;
export const CLOUD_FIXED_SATURATED_LAPSE_C_PER_KM = 6;
export const CLOUD_MAX_LIFT_M = 2_000;
export const TYPICAL_CLOUD_DROPLET_DIAMETER_UM = 20;
/** Diagram-only representative growth threshold, not a universal fall threshold. */
export const FALLING_PARTICLE_DIAMETER_UM = 200;
export const RAIN_DIAMETER_UM = 500;
/** Invented D²-path coefficient for this diagram, not a forecast parameter. */
export const EVAPORATION_PATH_COEFFICIENT_UM2_PER_M = 1_400;

export const defaultCloudState: CloudState = {
  temperatureC: 24,
  relativeHumidityPercent: 60,
  upliftM: 1_600,
  particleDiameterUm: TYPICAL_CLOUD_DROPLET_DIAMETER_UM,
  subcloudRelativeHumidityPercent: 80,
};

/** Compatibility name retained for existing scene consumers. */
export const initialCloud = defaultCloudState;

const bound = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizeCloud(input: CloudState): CloudState {
  return {
    temperatureC: bound(input.temperatureC, 22, 32, 24),
    relativeHumidityPercent: bound(input.relativeHumidityPercent, 30, 95, 60),
    upliftM: bound(input.upliftM, 0, CLOUD_MAX_LIFT_M, 1_600),
    particleDiameterUm: bound(input.particleDiameterUm, 10, 2_000, 20),
    subcloudRelativeHumidityPercent: bound(
      input.subcloudRelativeHumidityPercent,
      20,
      100,
      80,
    ),
  };
}

/** Magnus approximation over this lesson's bounded near-surface temperatures. */
export function saturationVaporPressureHpa(temperatureC: number) {
  return 6.112 * Math.exp((17.67 * temperatureC) / (temperatureC + 243.5));
}

export function dewPointC(
  temperatureC: number,
  relativeHumidityPercent: number,
) {
  const relativeHumidity = bound(relativeHumidityPercent, 0.1, 100, 60) / 100;
  const gamma =
    Math.log(relativeHumidity) +
    (17.67 * temperatureC) / (temperatureC + 243.5);
  return (243.5 * gamma) / (17.67 - gamma);
}

function mixingRatioGPerKg(vaporPressureHpa: number, pressureHpa: number) {
  return (622 * vaporPressureHpa) / (pressureHpa - vaporPressureHpa);
}

function pressureAtHeightHpa(heightM: number) {
  return CLOUD_SURFACE_PRESSURE_HPA * Math.exp(-heightM / 8_434);
}

function vaporPressureFromMixingRatioHpa(
  mixingRatioGPerKgValue: number,
  pressureHpa: number,
) {
  return (
    (mixingRatioGPerKgValue * pressureHpa) / (622 + mixingRatioGPerKgValue)
  );
}

function dryParcelRelativeHumidityPercent(
  startingTemperatureC: number,
  startingMixingRatioGPerKg: number,
  heightM: number,
) {
  const temperatureC =
    startingTemperatureC - (heightM / 1_000) * CLOUD_DRY_LAPSE_C_PER_KM;
  const pressureHpa = pressureAtHeightHpa(heightM);
  const vaporPressureHpa = vaporPressureFromMixingRatioHpa(
    startingMixingRatioGPerKg,
    pressureHpa,
  );
  return (100 * vaporPressureHpa) / saturationVaporPressureHpa(temperatureC);
}

/**
 * Finds the first height at which this model's own dry-parcel RH reaches 100%.
 * Bisection keeps the cloud-base crossing, displayed RH and condensate calculation
 * on one thermodynamic path instead of combining an unrelated LCL approximation.
 */
function saturationCrossingM(
  startingTemperatureC: number,
  startingMixingRatioGPerKg: number,
) {
  let lowM = 0;
  let highM = 6_000;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middleM = (lowM + highM) / 2;
    if (
      dryParcelRelativeHumidityPercent(
        startingTemperatureC,
        startingMixingRatioGPerKg,
        middleM,
      ) >= 100
    )
      highM = middleM;
    else lowM = middleM;
  }
  return (lowM + highM) / 2;
}

/**
 * This parcel calculation keeps a fixed 1,000 hPa start, numerically finds the
 * height where its conserved vapor mixing ratio reaches 100% RH, applies
 * 9.8 °C/km below that crossing and a fixed 6 °C/km above it, then uses one
 * explicitly invented D²-path coefficient to illustrate evaporation below
 * cloud base. It is not a weather forecast or detailed cloud microphysics.
 */
export function cloudResult(input: CloudState) {
  const state = normalizeCloud(input);
  const startingSaturationVaporPressureHpa = saturationVaporPressureHpa(
    state.temperatureC,
  );
  const startingVaporPressureHpa =
    startingSaturationVaporPressureHpa * (state.relativeHumidityPercent / 100);
  const startingVaporMixingRatioGPerKg = mixingRatioGPerKg(
    startingVaporPressureHpa,
    CLOUD_SURFACE_PRESSURE_HPA,
  );
  const startingDewPointC = dewPointC(
    state.temperatureC,
    state.relativeHumidityPercent,
  );
  const condensationHeightM = saturationCrossingM(
    state.temperatureC,
    startingVaporMixingRatioGPerKg,
  );
  const dryRiseM = Math.min(state.upliftM, condensationHeightM);
  const cloudDepthM = Math.max(0, state.upliftM - condensationHeightM);
  const parcelTemperatureC =
    state.temperatureC -
    (dryRiseM / 1_000) * CLOUD_DRY_LAPSE_C_PER_KM -
    (cloudDepthM / 1_000) * CLOUD_FIXED_SATURATED_LAPSE_C_PER_KM;
  const parcelPressureHpa = pressureAtHeightHpa(state.upliftM);
  const unsaturatedRelativeHumidityPercent = dryParcelRelativeHumidityPercent(
    state.temperatureC,
    startingVaporMixingRatioGPerKg,
    state.upliftM,
  );
  const saturated = state.upliftM >= condensationHeightM;
  const parcelRelativeHumidityPercent = saturated
    ? 100
    : Math.min(100, unsaturatedRelativeHumidityPercent);
  const saturationMixingRatioGPerKg = mixingRatioGPerKg(
    saturationVaporPressureHpa(parcelTemperatureC),
    parcelPressureHpa,
  );
  const condensedWaterGPerKg =
    cloudDepthM > 0
      ? Math.max(
          0,
          startingVaporMixingRatioGPerKg - saturationMixingRatioGPerKg,
        )
      : 0;
  const cloud = cloudDepthM > 0 && condensedWaterGPerKg > 0;
  const fallingPrecipitation =
    cloud && state.particleDiameterUm >= FALLING_PARTICLE_DIAMETER_UM;
  const evaporationDiameterSquaredLossUm2 = fallingPrecipitation
    ? EVAPORATION_PATH_COEFFICIENT_UM2_PER_M *
      (1 - state.subcloudRelativeHumidityPercent / 100) *
      condensationHeightM
    : 0;
  const groundParticleDiameterUm = fallingPrecipitation
    ? Math.sqrt(
        Math.max(
          0,
          state.particleDiameterUm ** 2 - evaporationDiameterSquaredLossUm2,
        ),
      )
    : 0;
  const groundPrecipitation =
    fallingPrecipitation && groundParticleDiameterUm > 0;
  const groundRain =
    groundPrecipitation && groundParticleDiameterUm >= RAIN_DIAMETER_UM;
  const virga = fallingPrecipitation && groundParticleDiameterUm === 0;
  const particleVolumeRatioToCloudDroplet =
    (state.particleDiameterUm / TYPICAL_CLOUD_DROPLET_DIAMETER_UM) ** 3;
  const outcome = !cloud
    ? ("invisible-vapor" as const)
    : !fallingPrecipitation
      ? ("cloud-droplets" as const)
      : virga
        ? ("virga" as const)
        : groundRain
          ? ("rain-at-ground" as const)
          : ("drizzle-at-ground" as const);

  return {
    startingDewPointC,
    startingVaporMixingRatioGPerKg,
    condensationHeightM,
    parcelTemperatureC,
    parcelPressureHpa,
    parcelRelativeHumidityPercent,
    cloudDepthM,
    saturated,
    cloud,
    condensedWaterGPerKg,
    fallingPrecipitation,
    evaporationDiameterSquaredLossUm2,
    groundParticleDiameterUm,
    groundPrecipitation,
    groundRain,
    virga,
    particleVolumeRatioToCloudDroplet,
    outcome,
  };
}

export type CloudRainTrial = {
  id: "lift-to-saturation" | "grow-cloud-particles";
  title: string;
  question: string;
  choices: readonly string[];
  correctChoice: string;
  controlled: string;
  before: CloudState;
  after: CloudState;
  change: string;
  changed: string;
  held: readonly string[];
  evidence: string;
  explain: string;
};

const lowLift: CloudState = { ...defaultCloudState, upliftM: 400 };
const highLift: CloudState = { ...defaultCloudState, upliftM: 1_600 };
const cloudDroplet: CloudState = {
  ...defaultCloudState,
  upliftM: 1_600,
  particleDiameterUm: TYPICAL_CLOUD_DROPLET_DIAMETER_UM,
};
const grownDrop: CloudState = {
  ...cloudDroplet,
  particleDiameterUm: 1_000,
};
const lowLiftResult = cloudResult(lowLift);
const highLiftResult = cloudResult(highLift);
const cloudDropletResult = cloudResult(cloudDroplet);
const grownDropResult = cloudResult(grownDrop);

const fixedParcel = [
  "starting temperature 24 °C",
  "starting relative humidity 60%",
  "representative particle diameter 20 µm",
  "below-cloud relative humidity 80%",
] as const;

export const cloudRainTrials: readonly CloudRainTrial[] = [
  {
    id: "lift-to-saturation",
    title: "Lift to saturation",
    question:
      "If the same parcel rises from 400 m to 1,600 m, when does invisible water vapor become visible cloud droplets?",
    choices: ["Cloud at both heights", "Cloud only after more lift"],
    correctChoice: "Cloud only after more lift",
    controlled:
      "Start at 400 m, then change only lift to 1,600 m. Keep starting temperature, starting relative humidity, particle diameter and below-cloud humidity fixed.",
    before: lowLift,
    after: highLift,
    change: "Lift parcel to 1,600 m",
    changed: "parcel lift, 400 to 1,600 m",
    held: fixedParcel,
    evidence: `At 400 m the parcel is ${lowLiftResult.parcelTemperatureC.toFixed(1)} °C and ${lowLiftResult.parcelRelativeHumidityPercent.toFixed(0)}% RH, below the estimated ${highLiftResult.condensationHeightM.toFixed(0)} m cloud base. At 1,600 m it is ${highLiftResult.parcelTemperatureC.toFixed(1)} °C and saturated at 100% RH, with ${highLiftResult.condensedWaterGPerKg.toFixed(2)} g/kg condensed in this model and a visible cloud.`,
    explain:
      "Lower pressure lets the rising parcel expand and cool. Cooling raises relative humidity until saturation; then some invisible vapor condenses on particles into visible liquid droplets. The water did not appear from nowhere and the vapor itself did not become visible.",
  },
  {
    id: "grow-cloud-particles",
    title: "Grow precipitation",
    question:
      "In the same saturated cloud, will representative 20 µm droplets and a 1,000 µm drop both reach the ground as rain?",
    choices: ["Both reach the ground", "Only the larger drop reaches"],
    correctChoice: "Only the larger drop reaches",
    controlled:
      "Start with 20 µm cloud droplets, then change only representative particle diameter to 1,000 µm. Keep lift, temperature and both relative-humidity settings fixed.",
    before: cloudDroplet,
    after: grownDrop,
    change: "Grow particle to 1,000 µm",
    changed: "representative particle diameter, 20 to 1,000 µm",
    held: [
      "parcel lift 1,600 m",
      "starting temperature 24 °C",
      "starting relative humidity 60%",
      "below-cloud relative humidity 80%",
    ],
    evidence: `Both states keep the same ${cloudDropletResult.parcelTemperatureC.toFixed(1)} °C saturated cloud and ${cloudDropletResult.condensedWaterGPerKg.toFixed(2)} g/kg modeled condensate. Diameter grows 50 times, equal to ${grownDropResult.particleVolumeRatioToCloudDroplet.toLocaleString("en-US", { maximumFractionDigits: 0 })} times the volume of a 20 µm sphere. The 20 µm droplets remain cloud droplets; the 1,000 µm drop is estimated to reach the ground at ${grownDropResult.groundParticleDiameterUm.toFixed(0)} µm after partial evaporation.`,
    explain:
      "Cloud droplets must grow—often through collision and coalescence in warm clouds—before they fall as precipitation. This model uses one representative diameter, not a real size distribution. Drier air below the cloud can evaporate a falling drop into virga, so even precipitation aloft need not reach the ground.",
  },
] as const;

export const cloudRainCoreBoundary =
  "This bounded warm-cloud parcel model keeps one vapor mixing ratio until saturation, then estimates condensed liquid water. Its particle-size and evaporation paths are comparisons, not rainfall predictions.";

export const cloudRainBoundary = `Starting temperature is 22–32 °C, starting relative humidity 30–95%, lift 0–${CLOUD_MAX_LIFT_M.toLocaleString("en-US")} m, representative liquid-particle diameter 10–2,000 µm and below-cloud relative humidity 20–100%. Relative humidity is actual vapor pressure divided by saturation vapor pressure at the same temperature; it does not mean air literally holds water. Starting pressure is fixed at 1,000 hPa. The model numerically finds the height where its conserved vapor mixing ratio reaches 100% RH, so saturation, cloud depth and condensate use one crossing. Unsaturated cooling is 9.8 °C/km; the fixed 6 °C/km saturated rate is a teaching approximation because the real rate varies. Positive cloud depth must produce positive modeled condensate before cloud or precipitation is drawn. A representative particle at least ${FALLING_PARTICLE_DIAMETER_UM} µm receives a precipitation path only to make growth comparisons visible; cloud droplets also fall relative to air, so this is not a universal onset threshold. Any positive modeled diameter surviving to ground is liquid precipitation here; virga requires complete evaporation before ground. ${RAIN_DIAMETER_UM} µm is the lesson's rain-size naming threshold. The D² evaporation-path coefficient (${EVAPORATION_PATH_COEFFICIENT_UM2_PER_M.toLocaleString("en-US")} µm² per metre at 0% RH) is invented to compare wetter and drier layers, not calculate rainfall. Modeled condensate is an equilibrium parcel difference, not measured cloud liquid-water content or a particle-supply calculation. Real clouds contain distributions of liquid droplets and/or ice crystals; this above-freezing model omits ice growth, mixing, detailed pressure-dependent microphysics, vertical wind, fall speed, temperature-dependent evaporation, collision efficiency, breakup and changing weather. It cannot forecast cloud base or precipitation for a place or time.`;
