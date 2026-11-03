import type { Trial } from "../physical-lesson";
import { defaultHeatState, heatResult, type HeatState } from "./model";

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

export const experiments: Trial<HeatState>[] = [
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
];
