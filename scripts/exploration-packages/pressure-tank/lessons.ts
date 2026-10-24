import type { Trial } from "../physical-lesson";
import {
  defaultPressureState,
  pressureResult,
  normalizePressure,
  type PressureState,
} from "./model";
export const experiments: Trial<PressureState>[] = [
  {
    title: "Raise the water",
    question:
      "If the surface rises from 1 to 2 m while the outlet stays at 0.5 m, what happens to the tank pressure at that height?",
    choices: [
      "Pressure triples",
      "Pressure doubles",
      "Pressure stays the same",
    ],
    controlled:
      "Keep the narrow tank and outlet height of 0.5 m. Compare water surfaces at 1 and 2 m. Measure the vertical depth below the surface, not the outlet’s height above the floor.",
    before: { ...defaultPressureState, depthM: 1 },
    after: { ...defaultPressureState, depthM: 2 },
    change: "Raise surface to 2 m",
    evidence:
      "Head rises from 0.5 to 1.5 m. Tank gauge pressure triples from 4.905 to 14.715 kPa; ideal jet speed rises from 3.13 to 5.42 m/s, not threefold.",
    explain:
      "Why does tripling head triple the pressure but not the jet speed? Compare the head and speed readouts.",
  },
  {
    title: "Change tank shape",
    question:
      "Will a wider tank send the jet faster at the same water level and outlet height?",
    choices: ["Same speed", "Faster", "Slower"],
    controlled:
      "Keep the surface at 2 m and the outlet at 0.5 m. Change only the tank from narrow to wide. This is an instantaneous comparison, not a timed draining test.",
    before: { ...defaultPressureState, shape: "narrow" },
    after: { ...defaultPressureState, shape: "wide" },
    change: "Use the wide tank",
    evidence:
      "Volume increases from 2,000 to 6,480 liters, but the head remains 1.5 m. Static gauge pressure stays 14.715 kPa and ideal jet speed stays 5.42 m/s.",
    explain:
      "Why can the wider tank hold more water without increasing pressure at the same depth? What would differ if both tanks were allowed to drain?",
  },
];
