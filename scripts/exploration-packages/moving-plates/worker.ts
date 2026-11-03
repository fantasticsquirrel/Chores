import { installLesson } from "../physical-lesson";
import {
  advanceFaultLoading,
  defaultPlateState,
  movingPlatesBoundary,
  movingPlatesTrials,
  normalizePlate,
  plateResult,
} from "./model";
import { createMovingPlatesScene } from "./plates";

const motion = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 1 });

installLesson({
  initial: defaultPlateState,
  normalize: normalizePlate,
  build: createMovingPlatesScene,
  title: "Plate boundaries",
  introduction:
    "Compare equal rates and times using arrows and the lithosphere cutaway.",
  fields: [
    {
      id: "boundary",
      label: "Boundary motion",
      options: ["divergent", "convergent", "transform"],
      labels: ["Apart", "Together", "Sideways"],
    },
    {
      id: "rateCmPerYear",
      label: "Relative plate rate (cm/yr)",
      min: 1,
      max: 10,
      step: 1,
    },
    {
      id: "elapsedMillionYears",
      label: "Elapsed model time (million years)",
      min: 0,
      max: 5,
      step: 0.25,
    },
  ],
  change: (state, key, value) =>
    normalizePlate(
      key === "boundary"
        ? { ...state, boundary: value, loadingStep: 0, slips: 0 }
        : { ...state, [key]: value },
    ),
  select: (state) => advanceFaultLoading(state),
  actions: [
    {
      id: "step",
      label: "Add one locked-fault loading step",
      run: (state) => advanceFaultLoading(state),
    },
    {
      id: "resetBoundary",
      label: "Reset this boundary",
      run: (state) => normalizePlate({ ...state, loadingStep: 0, slips: 0 }),
    },
  ],
  describe: (state) => {
    const result = plateResult(state);
    return `${result.summary} Plates move ${result.motion}. Rate ${state.rateCmPerYear.toFixed(0)} cm/yr over ${state.elapsedMillionYears.toFixed(2).replace(/0$/, "")} million years gives ${motion(result.relativeMotionKm)} km of relative motion. ${result.crustChange}. Invented elastic-loading index ${result.elasticLoadingPercent}%; ${state.slips} illustrated ${state.slips === 1 ? "slip" : "slips"}. Scene distance and relief are schematic.`;
  },
  trials: movingPlatesTrials,
  note: movingPlatesBoundary,
});
