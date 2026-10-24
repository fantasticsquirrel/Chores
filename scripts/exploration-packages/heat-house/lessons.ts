import type { Trial } from "../physical-lesson";
import {
  defaultHeatState,
  heatResult,
  heatWallMaterials,
  normalizeHeat,
  type HeatState,
} from "./model";
const baseline = { ...defaultHeatState, insulationCm: 0 };
const bare = heatResult(baseline),
  insulated = heatResult({ ...baseline, insulationCm: 10 });
const small = heatResult({
    ...defaultHeatState,
    insulationCm: 10,
    windowM2: 2,
  }),
  large = heatResult({ ...defaultHeatState, insulationCm: 10, windowM2: 18 });
export const experiments: Trial<HeatState>[] = [
  {
    title: "Add wall insulation",
    question:
      "Will adding wall insulation reduce the heat transfer through unchanged windows?",
    choices: [
      "Window transfer falls",
      "Window transfer stays the same",
      "Window transfer rises",
    ],
    controlled:
      "Keep brick walls, 8 m² of windows, 20°C inside and 0°C outside. Compare no added insulation with 10 cm. Both temperatures are held steady.",
    before: baseline,
    after: { ...baseline, insulationCm: 10 },
    change: "Add 10 cm insulation",
    evidence: `Wall transfer falls from ${bare.wallWatts.toFixed(0)} W to ${insulated.wallWatts.toFixed(0)} W. Window transfer stays ${bare.windowWatts.toFixed(0)} W. Combined transfer falls from ${bare.totalWatts.toFixed(0)} W to ${insulated.totalWatts.toFixed(0)} W.`,
    explain:
      "Why does extra wall insulation reduce only one heat-transfer path in this comparison? What else would need to change to reduce the window transfer?",
  },
  {
    title: "Change window area",
    question:
      "With insulated walls, what happens to heat loss if windows replace more of the wall area?",
    choices: ["Heat loss rises", "Heat loss stays the same", "Heat loss falls"],
    controlled:
      "Keep 10 cm of added insulation, brick, 20°C inside and 0°C outside. Increase windows from 2 to 18 m² within the same 60 m² wall envelope.",
    before: { ...defaultHeatState, insulationCm: 10, windowM2: 2 },
    after: { ...defaultHeatState, insulationCm: 10, windowM2: 18 },
    change: "Use 18 m² windows",
    evidence: `Opaque wall area falls from 58 to 42 m². Combined transfer rises from ${small.totalWatts.toFixed(0)} W to ${large.totalWatts.toFixed(0)} W because these windows transfer more heat per square meter than these insulated walls.`,
    explain:
      "Why must window area replace wall area for a fair comparison? Would every real window and wall have this same result?",
  },
];
