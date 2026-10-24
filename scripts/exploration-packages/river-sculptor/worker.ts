import { installLesson } from "../physical-lesson";
import { landscapeScene, serializeLandscape } from "../shared/landscape-scene";
import { buildRiver } from "./river";
import { riverStorm } from "./model";
const initial = {
  slope: 8,
  rain: 40,
  vegetation: 40,
  storms: 0,
  soil: 5000,
  deposited: 0,
  exported: 0,
};
const storm = (s: typeof initial) => {
  const r = riverStorm(s.slope, s.rain, s.vegetation, s.soil);
  return {
    ...s,
    storms: s.storms + 1,
    soil: s.soil - r.eroded,
    deposited: s.deposited + r.deposited,
    exported: s.exported + r.exported,
  };
};
installLesson({
  initial,
  serialize: serializeLandscape,
  title: "Where does the soil go?",
  introduction:
    "Change the catchment, run one storm and account for the soil it moves.",
  build: (s) => {
    const r = riverStorm(s.slope, s.rain, s.vegetation, s.soil);
    return landscapeScene(
      buildRiver({
        kind: "river",
        ...s,
        runoff: r.runoff,
        infiltration: r.infiltration,
        eroded: r.eroded,
        flood: r.floodVolume,
      }),
      "river",
    );
  },
  fields: [
    { id: "slope", label: "Channel slope (%)", min: 1, max: 20 },
    { id: "rain", label: "Rainfall (mm)", min: 0, max: 100 },
    { id: "vegetation", label: "Vegetation cover (%)", min: 0, max: 100 },
  ],
  actions: [
    { id: "storm", label: "Run one storm", run: storm },
    {
      id: "restore",
      label: "Restore soil",
      run: (s) => ({ ...s, storms: 0, soil: 5000, deposited: 0, exported: 0 }),
    },
  ],
  describe: (s) => {
    const r = riverStorm(s.slope, s.rain, s.vegetation, s.soil);
    return `${s.storms} storms applied. Soil remaining ${s.soil.toFixed(1)} kg; deposited ${s.deposited.toFixed(1)} kg; exported ${s.exported.toFixed(1)} kg. Total ${(s.soil + s.deposited + s.exported).toFixed(1)} kg. Next storm: ${r.runoff.toFixed(1)} m³ runoff, ${r.infiltration.toFixed(1)} m³ infiltration, ${r.floodVolume.toFixed(1)} m³ beyond channel capacity; ${r.eroded.toFixed(1)} kg eroded. Erosion moves soil; it does not make material disappear.`;
  },
  trials: [
    {
      title: "Compare vegetation",
      question: "Will more vegetation reduce both runoff and soil export?",
      choices: ["Both", "Runoff only", "Neither"],
      controlled:
        "Compare one storm with 5000 kg starting soil, slope 8% and rain 40 mm. Change only vegetation 0% to 100%. Baseline and change each run exactly one storm.",
      before: storm({ ...initial, vegetation: 0 }),
      after: storm({ ...initial, vegetation: 100 }),
      change: "Compare vegetated storm",
      explain:
        "Vegetation increases infiltration and reduces erosion in this model. Which two changes explain the export difference?",
    },
    {
      title: "Compare slopes",
      question: "Does a steeper slope change runoff or soil moved?",
      choices: ["Both", "Soil moved", "Neither"],
      controlled:
        "Compare one storm at slope 2% versus 20%, with 5000 kg starting soil, rain 40 mm and vegetation 40%.",
      before: storm({ ...initial, slope: 2 }),
      after: storm({ ...initial, slope: 20 }),
      change: "Compare steep storm",
      explain:
        "The runoff formula depends on rain and vegetation, not slope. What stayed unchanged while erosion and export increased?",
    },
  ],
  note: "One-hour storm on a 1-hectare catchment; channel capacity 180 m³/hour. Illustrative coefficients, not measurements or forecasts. Terrain, vegetation and sediment sizes schematic. No evaporation or water storage. Pale water previews the next storm; sediment records storms already run.",
});
