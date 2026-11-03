/** Pure, bounded Moving Plates teaching model shared by web and native. */
export type PlateBoundary = "divergent" | "convergent" | "transform";

export type PlateState = {
  boundary: PlateBoundary;
  /** Relative plate-motion rate in centimetres per year. */
  rateCmPerYear: number;
  /** Elapsed model time in millions of years. */
  elapsedMillionYears: number;
  /** Timeless position in the invented five-step locked-fault cycle. */
  loadingStep: number;
  /** Count of illustrated slips, not an earthquake count or forecast. */
  slips: number;
};

export const PLATE_RATE_MIN_CM_PER_YEAR = 1;
export const PLATE_RATE_MAX_CM_PER_YEAR = 10;
export const PLATE_TIME_MAX_MILLION_YEARS = 5;
export const FAULT_LOADING_STEPS_TO_SLIP = 5;
export const FAULT_SLIP_LIMIT = 20;

export const defaultPlateState: PlateState = {
  boundary: "divergent",
  rateCmPerYear: 4,
  elapsedMillionYears: 2,
  loadingStep: 0,
  slips: 0,
};

/** Compatibility name retained while existing scene consumers move to the focused model. */
export const initialPlate = defaultPlateState;

const bound = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizePlate(input: PlateState): PlateState {
  return {
    boundary: ["divergent", "convergent", "transform"].includes(input.boundary)
      ? input.boundary
      : "divergent",
    rateCmPerYear: bound(
      input.rateCmPerYear,
      PLATE_RATE_MIN_CM_PER_YEAR,
      PLATE_RATE_MAX_CM_PER_YEAR,
      defaultPlateState.rateCmPerYear,
    ),
    elapsedMillionYears: bound(
      input.elapsedMillionYears,
      0,
      PLATE_TIME_MAX_MILLION_YEARS,
      defaultPlateState.elapsedMillionYears,
    ),
    loadingStep: Math.floor(
      bound(
        input.loadingStep,
        0,
        FAULT_LOADING_STEPS_TO_SLIP - 1,
        defaultPlateState.loadingStep,
      ),
    ),
    slips: Math.floor(
      bound(input.slips, 0, FAULT_SLIP_LIMIT, defaultPlateState.slips),
    ),
  };
}

/**
 * One centimetre per year sustained for one million years is ten kilometres.
 * This conversion is exact for the displayed units; the chosen rate and time
 * are bounded teaching inputs, not a reconstruction of a named plate.
 */
export function relativePlateMotionKm(input: PlateState) {
  const state = normalizePlate(input);
  return state.rateCmPerYear * state.elapsedMillionYears * 10;
}

/**
 * Advance the separate, timeless transform-fault illustration. Four steps
 * store an invented 80% loading index; the fifth illustrates one sudden slip
 * and returns the index to zero. This is deliberately not a recurrence model.
 */
export function advanceFaultLoading(input: PlateState, steps = 1): PlateState {
  const state = normalizePlate(input);
  if (state.boundary !== "transform") return state;
  if (state.slips >= FAULT_SLIP_LIMIT) return state;
  const count = Math.floor(bound(steps, 0, 100, 0));
  for (let index = 0; index < count; index += 1) {
    if (state.slips >= FAULT_SLIP_LIMIT) break;
    if (state.loadingStep === FAULT_LOADING_STEPS_TO_SLIP - 1) {
      state.loadingStep = 0;
      state.slips += 1;
    } else state.loadingStep += 1;
  }
  return state;
}

/** Compatibility alias retained for existing callers. */
export const advancePlate = advanceFaultLoading;

export function plateResult(input: PlateState) {
  const state = normalizePlate(input);
  const relativeMotionKm = relativePlateMotionKm(state);
  const elasticLoadingPercent = state.loadingStep * 20;
  const common = {
    relativeMotionKm,
    elasticLoadingPercent,
    markerOffsetSteps: state.slips,
    slips: state.slips,
  };
  if (state.boundary === "divergent")
    return {
      ...common,
      motion: "apart" as const,
      feature: "Mid-ocean ridge and central rift",
      crustChange: "Localized melt cools to form new oceanic crust",
      summary:
        "Oceanic lithosphere separates at a mid-ocean ridge while localized melt can rise and cool into new oceanic crust.",
    };
  if (state.boundary === "convergent")
    return {
      ...common,
      motion: "toward each other" as const,
      feature: "Ocean trench and subduction zone",
      crustChange:
        "Oceanic lithosphere descends beneath continental lithosphere",
      summary:
        "Denser oceanic lithosphere bends beneath continental lithosphere at a trench in this oceanic–continental example.",
    };
  return {
    ...common,
    motion: "horizontally past each other" as const,
    feature: "Transform fault with an offset surface marker",
    crustChange:
      "Sideways motion neither creates nor destroys crust in this boundary model",
    summary:
      state.slips === FAULT_SLIP_LIMIT
        ? `This bounded illustration has reached its ${FAULT_SLIP_LIMIT}-slip limit; reset the boundary before adding another loading step.`
        : state.slips > 0 && state.loadingStep === 0
          ? "The latest illustrated loading step produced a sudden slip and offset the marker across the transform fault."
          : "The locked-fault illustration stores elastic deformation before a sudden slip offsets the marker.",
  };
}

export type MovingPlatesTrial = {
  id: "boundary-direction" | "locked-slip";
  title: string;
  question: string;
  choices: readonly string[];
  correctChoice: string;
  controlled: string;
  before: PlateState;
  after: PlateState;
  change: string;
  changed: string;
  held: readonly string[];
  evidence: string;
  explain: string;
};

const divergentBaseline: PlateState = { ...defaultPlateState };
const convergentComparison: PlateState = {
  ...defaultPlateState,
  boundary: "convergent",
};
const lockedBaseline = advanceFaultLoading(
  { ...defaultPlateState, boundary: "transform" },
  4,
);
const slippedComparison = advanceFaultLoading(lockedBaseline);

export const movingPlatesTrials: readonly MovingPlatesTrial[] = [
  {
    id: "boundary-direction",
    title: "Boundary direction",
    question:
      "At the same calculated relative motion, do the Apart spreading example and Together subduction example make the same boundary structure?",
    choices: ["Same structure", "Different structures"],
    correctChoice: "Different structures",
    controlled:
      "Compare Apart and Together at 4 cm/yr for 2.0 million years. Change only the boundary example; keep rate, elapsed time and the schematic view fixed.",
    before: divergentBaseline,
    after: convergentComparison,
    change: "Compare convergent boundary",
    changed:
      "boundary interaction, from oceanic spreading to oceanic–continental convergence",
    held: [
      "relative rate 4 cm/yr",
      "elapsed time 2.0 million years",
      "calculated relative motion 80 km",
      "schematic view scale",
    ],
    evidence:
      "Both examples show 80 km of relative plate motion. Apart forms a ridge and new oceanic crust; Together forms a trench and carries oceanic lithosphere beneath continental lithosphere.",
    explain:
      "The same amount of relative motion can build different structures because the motion direction and interacting lithosphere differ. This switches between two boundary examples; it is not one real location reversing direction.",
  },
  {
    id: "locked-slip",
    title: "Locked fault slip",
    question:
      "After four equal loading steps, will one more step keep raising the invented loading index or illustrate a sudden slip?",
    choices: ["Index keeps rising", "A sudden slip"],
    correctChoice: "A sudden slip",
    controlled:
      "Start Sideways after four identical loading steps, then add only the fifth step. Keep the boundary, long-term rate and elapsed model time fixed.",
    before: lockedBaseline,
    after: slippedComparison,
    change: "Add the fifth loading step",
    changed: "one timeless loading step",
    held: [
      "transform boundary",
      "relative rate 4 cm/yr",
      "elapsed model time 2.0 million years",
    ],
    evidence:
      "The invented elastic-loading index drops from 80% to 0%, the illustrated slip count changes from 0 to 1, and the surface marker gains one schematic offset.",
    explain:
      "A locked fault can deform while plates keep moving, then slip suddenly when resistance is overcome. Real faults do not repeat at this model's five-step threshold, so it gives no earthquake date, magnitude or hazard forecast.",
  },
] as const;

export const movingPlatesBoundary = `Bounded schematic model: plate rate is a teaching input from 1 to 10 centimetres per year and elapsed time is 0 to 5 million years; their product is converted to kilometres of relative motion. Scene widths, relief, slab angle and vertical scale are not geographic measurements and the three views are separate boundary examples. A tectonic plate is lithosphere: crust plus rigid uppermost mantle. The asthenosphere below is hot, slowly deforming, mostly solid rock, not a global ocean of magma; melt is localized near the illustrated ridge and in the mantle wedge above the subducting slab. Together shows oceanic–continental subduction, not continent–continent collision. Earthquakes can occur at all boundary types and within plates. The transform loading index, five-step slip threshold, regular repetition, marker offset and ${FAULT_SLIP_LIMIT}-slip display limit are invented and have no time or magnitude units; this model cannot predict an earthquake date, location, magnitude or hazard.`;
