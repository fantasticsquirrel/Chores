import { installLesson } from "../physical-lesson";
import {
  defaultMagneticState,
  magneticFieldsBoundary,
  magneticFieldsTrials,
  magneticResult,
  normalizeMagnetic,
} from "./model";
import { createMagneticFieldsScene } from "./magnets";

installLesson({
  initial: defaultMagneticState,
  normalize: normalizeMagnetic,
  build: createMagneticFieldsScene,
  title: "How do magnets steer a compass?",
  introduction:
    "Reverse one bar; then move the probe. Compare poles and compass direction.",
  fields: [
    {
      id: "gap",
      label: "Gap between bars (diagram units)",
      min: 0.5,
      max: 4.5,
      step: 0.1,
    },
    {
      id: "flipped",
      label: "N–N facing (reverse right magnet)",
      toggle: true,
    },
    {
      id: "probeX",
      label: "Compass x position (diagram units)",
      min: -6,
      max: 6,
      step: 0.1,
    },
    {
      id: "probeZ",
      label: "Compass z position (diagram units)",
      min: -4,
      max: 4,
      step: 0.1,
    },
  ],
  select: (state, index) => {
    if (index === 1 || index === 2)
      return normalizeMagnetic({ ...state, flipped: index === 1 });
    if (index < 10) return state;
    const compassIndex = index - 10;
    return normalizeMagnetic({
      ...state,
      probeX: Math.round((-5.4 + (compassIndex % 7) * 1.8) * 10) / 10,
      probeZ: -2.9 + Math.floor(compassIndex / 7) * 2.9,
    });
  },
  describe: (state) => {
    const result = magneticResult(state);
    if (result.insideMagnet)
      return `Facing ${result.facingPoles} poles ${result.interaction}. Probe inside a bar: this exterior paired-source surrogate reports no interior direction or field index. Move the probe outside. Pole letters and arrows provide noncolor evidence.`;
    if (result.directionDegrees === null)
      return `Facing ${result.facingPoles} poles ${result.interaction}. At probe (${state.probeX.toFixed(1)}, ${state.probeZ.toFixed(1)}), left and right contribution indices ${result.leftContributionIndex} and ${result.rightContributionIndex} oppose. Combined normalized field index 0; the north-seeking end has no preferred direction. The two magnets still produce fields elsewhere.`;
    return `Facing ${result.facingPoles} poles ${result.interaction}. At probe (${state.probeX.toFixed(1)}, ${state.probeZ.toFixed(1)}), the north-seeking end points ${result.directionLabel}. Combined normalized field index ${result.relativeFieldIndex} out of 100; left and right contribution indices ${result.leftContributionIndex} and ${result.rightContributionIndex}. The index is not tesla or force.`;
  },
  trials: magneticFieldsTrials.map((trial) => ({
    ...trial,
    choices: [...trial.choices],
    held: [...trial.held],
  })),
  note: magneticFieldsBoundary,
});
