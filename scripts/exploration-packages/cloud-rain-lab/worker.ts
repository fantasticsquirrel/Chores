import { installLesson } from "../physical-lesson";
import { initialCloud, normalizeCloud, cloudResult } from "./model";
import { createCloudRainScene } from "./clouds";
installLesson({
  initial: initialCloud,
  normalize: normalizeCloud,
  build: createCloudRainScene,
  title: "Why can rising air make a cloud without rain?",
  introduction:
    "Rising air expands and cools. At saturation invisible vapor condenses into visible droplets; additional growth is needed for rain.",
  fields: [
    {
      id: "temperatureC",
      label: "Starting air temperature (°C)",
      min: 20,
      max: 35,
    },
    {
      id: "vaporGPerKg",
      label: "Starting water vapor (g/kg dry air)",
      min: 2,
      max: 14,
    },
    {
      id: "upliftM",
      label: "Air parcel lift (m)",
      min: 0,
      max: 2000,
      step: 100,
    },
    {
      id: "dropletGrowth",
      label: "Droplet-growth teaching index",
      min: 0,
      max: 100,
      step: 5,
    },
  ],
  select: (s) => ({ ...s, upliftM: Math.min(2000, s.upliftM + 200) }),
  describe: (s) => {
    const r = cloudResult(s);
    return `${r.rain ? "Cloud with falling drops" : r.cloud ? "Cloud without rain" : "No cloud yet"}. Lifted ${s.upliftM} m; parcel ${r.parcelTemperatureC.toFixed(1)}°C; approximate condensation level ${Math.round(r.condensationHeightM)} m. Growth teaching index ${s.dropletGrowth}. ${r.cloud ? (r.rain ? "Condensation and chosen growth condition are present." : "Cooling reached saturation, but growth does not yet produce falling drops.") : "Parcel has not reached condensation level; growth alone cannot make rain without cloud droplets."}`;
  },
  trials: [
    {
      title: "Lift the same air",
      question:
        "Will lifting the same air to 600 m and 1800 m produce the same cloud state?",
      choices: ["Same state", "Different states"],
      controlled:
        "Keep 22°C starting temperature, 10 g/kg vapor and growth 30. Change only lift from 600 to 1800 m.",
      before: { ...initialCloud, upliftM: 600 },
      after: { ...initialCloud, upliftM: 1800 },
      change: "Lift to 1800 m",
      explain:
        "How did expansion and cooling connect lift to condensation? At fixed lift, why can warmer starting air remove the cloud?",
    },
    {
      title: "Cloud is not rain",
      question:
        "If the parcel is already cloudy, does that guarantee falling rain?",
      choices: ["Cloud always means rain", "Droplets need extra growth"],
      controlled:
        "Keep lift 1400 m, 22°C and 10 g/kg. Compare growth 30 with 90 and the unchanged parcel temperature.",
      before: initialCloud,
      after: { ...initialCloud, dropletGrowth: 90 },
      change: "Set growth to 90",
      explain:
        "Which process formed the cloud, and which extra condition changed falling drops? Why is this teaching threshold not a forecast?",
    },
  ],
  note: "Warm-cloud parcel starts at fixed 1000 hPa. Approximate condensation height; cooling uses 9.8°C/km before saturation and 6°C/km afterward. Mixing, ice and evaporation omitted. Gold dots mark air, not visible vapor; parcel is not a balloon. Growth is invented, with drops drawn at 65; not measured size, rainfall rate or forecast. Real droplet growth and air motion are more complex.",
});
