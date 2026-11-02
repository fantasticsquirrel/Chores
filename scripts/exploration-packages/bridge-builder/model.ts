export type BridgeInputs = {
  pointLoadKilonewtons: number;
  loadPositionPercent: number;
  flexuralRigidityMeganewtonMetersSquared: number;
  braces: readonly boolean[];
};

export type BridgeMaterial = "timber" | "steel";
export type CircuitMode = "series" | "parallel";

export const BRIDGE_SPAN_METERS = 10;
export const BRIDGE_BRACE_REFERENCE_MOMENT_KILONEWTON_METERS = 16;
export const BRIDGE_BRACE_REFERENCE_FACTOR = 2.4;

export const BRIDGE_DEFAULT_INPUTS = {
  pointLoadKilonewtons: 12,
  loadPositionPercent: 50,
  flexuralRigidityMeganewtonMetersSquared: 100,
  braces: [false, false, false, false],
} as const satisfies BridgeInputs;

export const BRIDGE_POSITION_COMPARISON = [
  BRIDGE_DEFAULT_INPUTS,
  { ...BRIDGE_DEFAULT_INPUTS, loadPositionPercent: 20 },
] as const satisfies readonly BridgeInputs[];

export const BRIDGE_LOAD_COMPARISON = [
  { ...BRIDGE_DEFAULT_INPUTS, pointLoadKilonewtons: 8 },
  { ...BRIDGE_DEFAULT_INPUTS, pointLoadKilonewtons: 16 },
] as const satisfies readonly BridgeInputs[];

function bounded(
  value: number,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.min(maximum, value))
    : fallback;
}

export function normalizeBridgeInputs(inputs: BridgeInputs): {
  pointLoadKilonewtons: number;
  loadPositionPercent: number;
  flexuralRigidityMeganewtonMetersSquared: number;
  braces: boolean[];
} {
  return {
    pointLoadKilonewtons: bounded(
      inputs.pointLoadKilonewtons,
      0,
      30,
      BRIDGE_DEFAULT_INPUTS.pointLoadKilonewtons,
    ),
    loadPositionPercent: bounded(
      inputs.loadPositionPercent,
      5,
      95,
      BRIDGE_DEFAULT_INPUTS.loadPositionPercent,
    ),
    flexuralRigidityMeganewtonMetersSquared: bounded(
      inputs.flexuralRigidityMeganewtonMetersSquared,
      50,
      250,
      BRIDGE_DEFAULT_INPUTS.flexuralRigidityMeganewtonMetersSquared,
    ),
    braces: Array.from(
      { length: 4 },
      (_, index) => inputs.braces[index] === true,
    ),
  };
}

export function bridgeDeflectionMillimetersAt(
  raw: BridgeInputs,
  positionMeters: number,
) {
  const inputs = normalizeBridgeInputs(raw);
  const spanMeters = BRIDGE_SPAN_METERS;
  const loadPositionMeters = (inputs.loadPositionPercent / 100) * spanMeters;
  const distanceToRightSupportMeters = spanMeters - loadPositionMeters;
  const x = Math.max(0, Math.min(spanMeters, positionMeters));
  const a = loadPositionMeters;
  const b = distanceToRightSupportMeters;
  const pointLoadNewtons = inputs.pointLoadKilonewtons * 1_000;
  const flexuralRigidityNewtonMetersSquared =
    inputs.flexuralRigidityMeganewtonMetersSquared * 1_000_000;
  const numerator =
    x <= a
      ? pointLoadNewtons * b * x * (spanMeters ** 2 - b ** 2 - x ** 2)
      : pointLoadNewtons *
        a *
        (spanMeters - x) *
        (spanMeters ** 2 - a ** 2 - (spanMeters - x) ** 2);
  return (
    (numerator / (6 * spanMeters * flexuralRigidityNewtonMetersSquared)) * 1_000
  );
}

export function bridgeActivity(raw: BridgeInputs) {
  const inputs = normalizeBridgeInputs(raw);
  const spanMeters = BRIDGE_SPAN_METERS;
  const loadPositionMeters = (inputs.loadPositionPercent / 100) * spanMeters;
  const distanceToRightSupportMeters = spanMeters - loadPositionMeters;
  const leftReactionKilonewtons =
    (inputs.pointLoadKilonewtons * distanceToRightSupportMeters) / spanMeters;
  const rightReactionKilonewtons =
    (inputs.pointLoadKilonewtons * loadPositionMeters) / spanMeters;
  const momentAt = (positionMeters: number) =>
    leftReactionKilonewtons * positionMeters -
    inputs.pointLoadKilonewtons *
      Math.max(0, positionMeters - loadPositionMeters);
  const peakBendingMomentKilonewtonMeters = momentAt(loadPositionMeters);
  const deflectionAtLoadMillimeters = bridgeDeflectionMillimetersAt(
    inputs,
    loadPositionMeters,
  );
  const zonePeakBendingMomentsKilonewtonMeters = Array.from(
    { length: 4 },
    (_, index) => {
      const start = index * 2.5;
      const end = start + 2.5;
      return Math.max(
        momentAt(start),
        momentAt(end),
        loadPositionMeters >= start && loadPositionMeters <= end
          ? peakBendingMomentKilonewtonMeters
          : 0,
      );
    },
  );
  const braceReferenceUseIndex = zonePeakBendingMomentsKilonewtonMeters.map(
    (moment, index) =>
      moment /
      (BRIDGE_BRACE_REFERENCE_MOMENT_KILONEWTON_METERS *
        (inputs.braces[index] ? BRIDGE_BRACE_REFERENCE_FACTOR : 1)),
  );
  return {
    inputs,
    spanMeters,
    loadPositionMeters,
    leftReactionKilonewtons,
    rightReactionKilonewtons,
    peakBendingMomentKilonewtonMeters,
    deflectionAtLoadMillimeters,
    zonePeakBendingMomentsKilonewtonMeters,
    braceReferenceUseIndex,
    maximumBraceReferenceUseIndex: Math.max(...braceReferenceUseIndex),
  };
}

export function bridgeStateAtPhase(raw: BridgeInputs, rawPhase: number) {
  const activity = bridgeActivity(raw);
  const finitePhase = Number.isFinite(rawPhase) ? rawPhase : 0;
  return {
    ...activity,
    visualPhase: ((finitePhase % 1) + 1) % 1,
  };
}

export function compareBridgeTrials(first: BridgeInputs, second: BridgeInputs) {
  const a = normalizeBridgeInputs(first);
  const b = normalizeBridgeInputs(second);
  const changed: string[] = [];
  if (a.loadPositionPercent !== b.loadPositionPercent)
    changed.push("load position");
  if (a.pointLoadKilonewtons !== b.pointLoadKilonewtons)
    changed.push("point load");
  if (
    a.flexuralRigidityMeganewtonMetersSquared !==
    b.flexuralRigidityMeganewtonMetersSquared
  )
    changed.push("flexural rigidity");
  if (a.braces.some((brace, index) => brace !== b.braces[index]))
    changed.push("brace-index modifiers");
  const held: string[] = [];
  if (a.pointLoadKilonewtons === b.pointLoadKilonewtons)
    held.push(`${a.pointLoadKilonewtons} kN point load`);
  if (a.loadPositionPercent === b.loadPositionPercent)
    held.push(`${a.loadPositionPercent}% load position`);
  if (
    a.flexuralRigidityMeganewtonMetersSquared ===
    b.flexuralRigidityMeganewtonMetersSquared
  )
    held.push(
      `${a.flexuralRigidityMeganewtonMetersSquared} MN·m² flexural rigidity`,
    );
  held.push(`${BRIDGE_SPAN_METERS} m span`);
  if (a.braces.every((brace) => !brace) && b.braces.every((brace) => !brace))
    held.push("no brace-index modifiers");
  return { changed, held };
}

/** Compatibility for the dimensional scene while package code migrates. */
export function bridge(
  _material: BridgeMaterial,
  braces: readonly boolean[],
  loadKN: number,
  positionPercent: number,
) {
  const activity = bridgeActivity({
    pointLoadKilonewtons: loadKN,
    loadPositionPercent: positionPercent,
    flexuralRigidityMeganewtonMetersSquared: 100,
    braces,
  });
  return {
    leftReaction: activity.leftReactionKilonewtons,
    rightReaction: activity.rightReactionKilonewtons,
    maxMoment: activity.peakBendingMomentKilonewtonMeters,
    utilization: activity.braceReferenceUseIndex,
    maxUtilization: activity.maximumBraceReferenceUseIndex,
    cost: 0,
  };
}
