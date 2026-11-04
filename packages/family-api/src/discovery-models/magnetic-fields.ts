/** Pure, bounded Magnetic Fields teaching model shared by web and native. */
export type MagneticState = {
  /** Edge-to-edge gap between the bars in diagram units. */
  gap: number;
  /** Whether the right bar has been reversed so that like north poles face. */
  flipped: boolean;
  /** Probe position along the tabletop x axis, in diagram units. */
  probeX: number;
  /** Probe position along the tabletop z axis, in diagram units. */
  probeZ: number;
};

export type MagneticVector = {
  x: number;
  z: number;
  strength: number;
};

export type MagneticPoleSurrogate = {
  magnet: "left" | "right";
  x: number;
  sign: -1 | 1;
};

export const MAGNETIC_GAP_MIN = 0.5;
export const MAGNETIC_GAP_MAX = 4.5;
/** Exact world-space footprint used by the model and every rendered bar. */
export const MAGNETIC_BAR_LENGTH = 2;
export const MAGNETIC_BAR_DEPTH = 0.8;
export const MAGNETIC_BAR_HALF_LENGTH = MAGNETIC_BAR_LENGTH / 2;
export const MAGNETIC_BAR_HALF_DEPTH = MAGNETIC_BAR_DEPTH / 2;
export const MAGNETIC_PROBE_X_MIN = -6;
export const MAGNETIC_PROBE_X_MAX = 6;
export const MAGNETIC_PROBE_Z_MIN = -4;
export const MAGNETIC_PROBE_Z_MAX = 4;
export const MAGNETIC_NULL_EPSILON = 0.00001;
/**
 * A raw surrogate magnitude of 1 maps to the display ceiling of 100. This
 * produces a normalized comparison index, not tesla or a measured field.
 */
export const MAGNETIC_FIELD_INDEX_REFERENCE = 1;

export const defaultMagneticState: MagneticState = {
  gap: 2,
  flipped: false,
  probeX: 0,
  probeZ: 2,
};

/** Compatibility name retained for existing scene and protocol consumers. */
export const initialMagnetic = defaultMagneticState;

const bound = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizeMagnetic(input: MagneticState): MagneticState {
  return {
    gap: bound(
      input.gap,
      MAGNETIC_GAP_MIN,
      MAGNETIC_GAP_MAX,
      defaultMagneticState.gap,
    ),
    flipped: input.flipped === true,
    probeX: bound(
      input.probeX,
      MAGNETIC_PROBE_X_MIN,
      MAGNETIC_PROBE_X_MAX,
      defaultMagneticState.probeX,
    ),
    probeZ: bound(
      input.probeZ,
      MAGNETIC_PROBE_Z_MIN,
      MAGNETIC_PROBE_Z_MAX,
      defaultMagneticState.probeZ,
    ),
  };
}

export function magneticBarCenter(input: MagneticState) {
  const state = normalizeMagnetic(input);
  return MAGNETIC_BAR_HALF_LENGTH + state.gap / 2;
}

/** The exterior surrogate deliberately reports no result on or inside a bar. */
export function isInsideMagneticBar(
  input: MagneticState,
  x: number,
  z: number,
) {
  const center = magneticBarCenter(input);
  return (
    Math.abs(z) <= MAGNETIC_BAR_HALF_DEPTH &&
    Math.abs(Math.abs(x) - center) <= MAGNETIC_BAR_HALF_LENGTH
  );
}

/**
 * Each bar is represented by a paired positive/negative softened source.
 * These signed sources are a numerical exterior-field surrogate, not isolated
 * magnetic charges and not a description of the field inside either bar.
 */
export function magneticPoles(input: MagneticState): MagneticPoleSurrogate[] {
  const state = normalizeMagnetic(input);
  const center = magneticBarCenter(state);
  const rightDirection = state.flipped ? -1 : 1;
  return [
    {
      magnet: "left",
      x: -center - MAGNETIC_BAR_HALF_LENGTH,
      sign: -1,
    },
    {
      magnet: "left",
      x: -center + MAGNETIC_BAR_HALF_LENGTH,
      sign: 1,
    },
    {
      magnet: "right",
      x: center - MAGNETIC_BAR_HALF_LENGTH,
      sign: -rightDirection as -1 | 1,
    },
    {
      magnet: "right",
      x: center + MAGNETIC_BAR_HALF_LENGTH,
      sign: rightDirection as -1 | 1,
    },
  ];
}

function sumContribution(
  poles: readonly MagneticPoleSurrogate[],
  x: number,
  z: number,
): MagneticVector {
  let fieldX = 0;
  let fieldZ = 0;
  for (const pole of poles) {
    const deltaX = x - pole.x;
    const softenedDistanceCubed = (deltaX * deltaX + z * z + 0.08) ** 1.5;
    fieldX += (pole.sign * deltaX) / softenedDistanceCubed;
    fieldZ += (pole.sign * z) / softenedDistanceCubed;
  }
  return { x: fieldX, z: fieldZ, strength: Math.hypot(fieldX, fieldZ) };
}

/** Vector contributions from each complete paired-source bar. */
export function magneticFieldContributionsAt(
  input: MagneticState,
  x: number,
  z: number,
) {
  const poles = magneticPoles(input);
  return {
    left: sumContribution(
      poles.filter((pole) => pole.magnet === "left"),
      x,
      z,
    ),
    right: sumContribution(
      poles.filter((pole) => pole.magnet === "right"),
      x,
      z,
    ),
  };
}

/** Exterior field vector from superposition of both paired-source bars. */
export function magneticFieldAt(
  input: MagneticState,
  x: number,
  z: number,
): MagneticVector {
  const contributions = magneticFieldContributionsAt(input, x, z);
  const fieldX = contributions.left.x + contributions.right.x;
  const fieldZ = contributions.left.z + contributions.right.z;
  return { x: fieldX, z: fieldZ, strength: Math.hypot(fieldX, fieldZ) };
}

function normalizedFieldIndex(strength: number) {
  return Math.round(
    Math.min(100, Math.max(0, strength / MAGNETIC_FIELD_INDEX_REFERENCE) * 100),
  );
}

function fieldDirectionLabel(directionDegrees: number | null) {
  if (directionDegrees === null) return "no preferred direction";
  if (Math.abs(directionDegrees) < 0.5) return "toward +x across the tabletop";
  if (Math.abs(directionDegrees - 90) < 0.5)
    return "toward +z across the tabletop";
  if (Math.abs(directionDegrees + 90) < 0.5)
    return "toward −z across the tabletop";
  if (Math.abs(Math.abs(directionDegrees) - 180) < 0.5)
    return "toward −x across the tabletop";
  return `${Math.round(directionDegrees)}° from tabletop +x`;
}

export function magneticResult(input: MagneticState) {
  const state = normalizeMagnetic(input);
  const field = magneticFieldAt(state, state.probeX, state.probeZ);
  const contributions = magneticFieldContributionsAt(
    state,
    state.probeX,
    state.probeZ,
  );
  const insideMagnet = isInsideMagneticBar(state, state.probeX, state.probeZ);
  const directionDegrees =
    insideMagnet || field.strength < MAGNETIC_NULL_EPSILON
      ? null
      : (Math.atan2(field.z, field.x) * 180) / Math.PI;
  return {
    ...field,
    insideMagnet,
    direction: directionDegrees,
    directionDegrees,
    directionLabel: insideMagnet
      ? "outside model domain"
      : fieldDirectionLabel(directionDegrees),
    interaction: state.flipped ? ("repel" as const) : ("attract" as const),
    facingPoles: state.flipped ? ("N–N" as const) : ("N–S" as const),
    relativeFieldIndex: insideMagnet
      ? null
      : normalizedFieldIndex(field.strength),
    leftContributionIndex: normalizedFieldIndex(contributions.left.strength),
    rightContributionIndex: normalizedFieldIndex(contributions.right.strength),
  };
}

export type MagneticFieldsTrial = {
  id: "reverse-right-magnet" | "leave-midpoint";
  title: string;
  question: string;
  choices: readonly string[];
  correctChoice: string;
  controlled: string;
  before: MagneticState;
  after: MagneticState;
  change: string;
  changed: string;
  held: readonly string[];
  evidence: string;
  explain: string;
};

const unlikeBaseline = { ...defaultMagneticState };
const likeComparison = { ...defaultMagneticState, flipped: true };
const cancellationBaseline = {
  ...defaultMagneticState,
  flipped: true,
  probeZ: 0,
};
const awayFromCancellation = {
  ...cancellationBaseline,
  probeZ: 2,
};
const unlikeResult = magneticResult(unlikeBaseline);
const likeResult = magneticResult(likeComparison);
const cancellationResult = magneticResult(cancellationBaseline);
const awayResult = magneticResult(awayFromCancellation);

export const magneticFieldsTrials: readonly MagneticFieldsTrial[] = [
  {
    id: "reverse-right-magnet",
    title: "Reverse one magnet",
    question:
      "When only the right magnet is reversed, will the facing-pole interaction stay the same or reverse?",
    choices: ["Interaction stays the same", "Interaction reverses"],
    correctChoice: "Interaction reverses",
    controlled:
      "Start with N–S facing, then reverse only the right magnet to make N–N face. Keep the 2-unit gap and probe at (0, 2) fixed.",
    before: unlikeBaseline,
    after: likeComparison,
    change: "Reverse right magnet",
    changed: "right magnet orientation, from N–S facing to N–N facing",
    held: ["gap 2 diagram units", "probe position (0, 2)", "identical bars"],
    evidence: `Facing N–S poles ${unlikeResult.interaction}; the north-seeking probe points ${unlikeResult.directionLabel} with a ${unlikeResult.relativeFieldIndex} normalized field index. Facing N–N poles ${likeResult.interaction}; the probe points ${likeResult.directionLabel} with a ${likeResult.relativeFieldIndex} normalized field index.`,
    explain:
      "Unlike poles attract and like poles repel. Reversing one complete bar changes both its pole labels and its field contribution, so the compass responds to a new vector sum. The field index does not measure the force between the bars.",
  },
  {
    id: "leave-midpoint",
    title: "Test cancellation",
    question:
      "With like north poles facing, does cancellation remain when the probe moves away from their exact midpoint?",
    choices: [
      "Cancellation at every point",
      "Cancellation only at the midpoint",
    ],
    correctChoice: "Cancellation only at the midpoint",
    controlled:
      "Start at probe (0, 0), then change only probe z to 2. Keep the right magnet flipped, the N–N facing poles and the 2-unit gap fixed.",
    before: cancellationBaseline,
    after: awayFromCancellation,
    change: "Move compass to z = 2",
    changed: "probe z position, from 0 to 2 diagram units",
    held: [
      "right magnet flipped",
      "N–N facing poles",
      "gap 2 diagram units",
      "probe x position 0",
    ],
    evidence: `At the exact midpoint, the ${cancellationResult.leftContributionIndex} and ${cancellationResult.rightContributionIndex} normalized source-contribution indices oppose, giving a 0 normalized field index and no preferred direction even though there are two nonzero contributions. At (0, 2), the combined index is ${awayResult.relativeFieldIndex} and the north-seeking end points ${awayResult.directionLabel}.`,
    explain:
      "At the symmetric midpoint the two equal vectors point in opposite directions, so their sum is zero in this model. Moving the probe breaks that local cancellation. A null at one point does not mean either magnet stopped producing a field elsewhere.",
  },
] as const;

export const magneticFieldsCoreBoundary =
  "This is a normalized exterior-field comparison. Its 0–100 field index and diagram-unit positions are not tesla, metres, force measurements or a magnet-motion prediction.";

export const magneticFieldsBoundary = `Two identical bars use paired softened signed sources to approximate the exterior tabletop field. They are a numerical surrogate, not isolated magnetic charges: real bars are dipoles, and real field lines form closed loops through and outside a magnet. The model vector-adds both bars at the probe. An ideal, frictionless compass's north-seeking end aligns with that sum; conventional exterior direction runs from a magnet's north pole toward its south pole. At an exactly symmetric null, no direction is preferred. Probe x is bounded to ${MAGNETIC_PROBE_X_MIN}–${MAGNETIC_PROBE_X_MAX}, probe z to ${MAGNETIC_PROBE_Z_MIN}–${MAGNETIC_PROBE_Z_MAX} and gap to ${MAGNETIC_GAP_MIN}–${MAGNETIC_GAP_MAX}, all in diagram units. The capped 0–100 field index is a normalized surrogate comparison, not a measurement. Line placement and density are illustrative: lines are a mapping tool, not physical threads, flowing material or particle paths. The model excludes force magnitude, bar motion, material response, Earth's field, nearby metal, compass friction, off-table three-dimensional fields and the field inside a bar.`;
