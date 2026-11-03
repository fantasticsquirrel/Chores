import { installLesson } from "../physical-lesson";
import {
  CLOUD_MAX_LIFT_M,
  cloudRainTrials,
  cloudResult,
  defaultCloudState,
  normalizeCloud,
} from "./model";
import { createCloudRainScene } from "./clouds";

const packageBoundary =
  "Bounded warm-cloud parcel model: 22–32 °C start, 30–95% starting RH, 0–2,000 m lift, 10–2,000 µm representative liquid particle and 20–100% below-cloud RH. Water vapor is invisible. Relative humidity is actual vapor pressure divided by saturation vapor pressure; it does not mean air literally holds water. At fixed 1,000 hPa start, one numerical crossing sets 100% RH, cloud depth and condensate. Cooling rates (9.8 then fixed 6 °C/km) are simplified. A 200 µm representative particle gets a visible precipitation path, not a universal fall threshold; virga requires complete modeled evaporation before ground. The 500 µm rain-size name and invented 1,400 µm²/m D² evaporation coefficient are teaching choices. Condensate is not measured cloud water or particle supply. Real clouds include size distributions and liquid and/or ice; omitted mixing, detailed microphysics, wind, fall speed, breakup and changing weather matter. It cannot forecast cloud base or precipitation.";

function outcome(result: ReturnType<typeof cloudResult>) {
  if (result.outcome === "invisible-vapor")
    return "No cloud yet; water vapor remains invisible.";
  if (result.outcome === "cloud-droplets")
    return "Visible liquid cloud droplets; no precipitation-sized particles.";
  if (result.outcome === "virga")
    return "Precipitation evaporates before reaching the ground (virga).";
  if (result.outcome === "rain-at-ground") return "Rain reaches the ground.";
  return "Drizzle reaches the ground.";
}

installLesson({
  initial: defaultCloudState,
  normalize: normalizeCloud,
  build: createCloudRainScene,
  title: "Cloud and Rain Lab",
  introduction:
    "Lift one parcel to test cooling and saturation, then change one liquid-particle diameter to test why a visible cloud need not produce rain at the ground.",
  fields: [
    {
      id: "temperatureC",
      label: "Starting parcel temperature (°C)",
      min: 22,
      max: 32,
    },
    {
      id: "relativeHumidityPercent",
      label: "Starting relative humidity (%)",
      min: 30,
      max: 95,
    },
    {
      id: "upliftM",
      label: "Parcel lift (m)",
      min: 0,
      max: CLOUD_MAX_LIFT_M,
      step: 100,
    },
    {
      id: "particleDiameterUm",
      label: "Representative particle diameter (µm)",
      min: 10,
      max: 2_000,
      step: 10,
    },
    {
      id: "subcloudRelativeHumidityPercent",
      label: "Below-cloud relative humidity (%)",
      min: 20,
      max: 100,
      step: 5,
    },
  ],
  select: (state) => ({
    ...state,
    upliftM: Math.min(CLOUD_MAX_LIFT_M, state.upliftM + 200),
  }),
  describe: (state) => {
    const result = cloudResult(state);
    const ground = result.groundPrecipitation
      ? `${result.groundParticleDiameterUm.toFixed(0)} µm at ground level`
      : result.virga
        ? "evaporated before ground level"
        : "no ground precipitation";
    return `${outcome(result)} Lift ${state.upliftM.toFixed(0)} m; parcel ${result.parcelTemperatureC.toFixed(1)} °C and ${result.parcelRelativeHumidityPercent.toFixed(0)}% RH. Estimated cloud base ${result.condensationHeightM.toFixed(0)} m; modeled condensed liquid water ${result.condensedWaterGPerKg.toFixed(2)} g/kg dry air. Representative particle ${state.particleDiameterUm.toFixed(0)} µm; ${ground}; below-cloud relative humidity ${state.subcloudRelativeHumidityPercent.toFixed(0)}%.`;
  },
  trials: cloudRainTrials.map((trial) => ({
    ...trial,
    choices: [...trial.choices],
    held: [...trial.held],
  })),
  note: packageBoundary,
});
