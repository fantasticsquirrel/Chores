/** Deterministic pollen-transfer model; all coordinates are teaching units. */
import {
  POLLINATOR_COMPATIBILITY_TARGETS,
  POLLINATOR_FLOWER_BY_ID,
  POLLINATOR_TEACHING_ASSUMPTIONS,
  isKnownPollinatorPoint,
  isPollinatorFlowerId,
  isPollinatorSpecies,
  type FlowerSpecies,
  type PollinatorFlowerId,
} from "./pollinator-catalog";
export {
  POLLINATOR_COMPATIBILITY_TARGETS,
  POLLINATOR_FLOWERS,
  POLLINATOR_TEACHING_ASSUMPTIONS,
  isPollinatorFlowerId,
} from "./pollinator-catalog";
export type {
  FlowerSpecies,
  PollinatorFlower,
  PollinatorFlowerId,
} from "./pollinator-catalog";

export type PollinatorState = {
  x: number;
  y: number;
  pollen: { species: FlowerSpecies; sourceId: PollinatorFlowerId } | null;
  visits: number;
  transfers: number;
  pollinated: PollinatorFlowerId[];
  path: { x: number; y: number }[];
  message: string;
};

export type PollinatorVisitOutcome =
  | "visited"
  | "out-of-reach"
  | "habitat-required";

export type PollinatorVisitResult = {
  state: PollinatorState;
  flowerId: PollinatorFlowerId;
  distance: number;
  outcome: PollinatorVisitOutcome;
  compatibleTransfer: boolean;
};

export type PollinatorRouteInput = {
  reach: number;
  habitat: boolean;
  flowerIds: readonly string[];
  trialSpecies?: FlowerSpecies;
};

export type PollinatorRouteResult = {
  state: PollinatorState;
  visits: number;
  transfers: number;
  receivedCount: number;
  blockedAttempts: number;
  reachedTarget: boolean;
};

const isReach = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value) &&
  value >= POLLINATOR_TEACHING_ASSUMPTIONS.minimumReach &&
  value <= POLLINATOR_TEACHING_ASSUMPTIONS.maximumReach &&
  value % POLLINATOR_TEACHING_ASSUMPTIONS.reachStep === 0;

const isPollen = (pollen: unknown) => {
  if (pollen === null) return true;
  if (typeof pollen !== "object") return false;
  const candidate = pollen as { sourceId?: unknown; species?: unknown };
  if (
    !isPollinatorFlowerId(candidate.sourceId) ||
    !isPollinatorSpecies(candidate.species)
  )
    return false;
  return (
    POLLINATOR_FLOWER_BY_ID[candidate.sourceId].species === candidate.species
  );
};

const isState = (state: unknown): state is PollinatorState => {
  if (typeof state !== "object" || state === null) return false;
  const candidate = state as PollinatorState;
  return (
    isKnownPollinatorPoint(candidate) &&
    Number.isSafeInteger(candidate.visits) &&
    candidate.visits >= 0 &&
    candidate.visits < Number.MAX_SAFE_INTEGER &&
    Number.isSafeInteger(candidate.transfers) &&
    candidate.transfers >= 0 &&
    candidate.transfers <= candidate.visits &&
    Array.isArray(candidate.pollinated) &&
    candidate.pollinated.every(isPollinatorFlowerId) &&
    Array.isArray(candidate.path) &&
    candidate.path.length > 0 &&
    candidate.path.length <=
      POLLINATOR_TEACHING_ASSUMPTIONS.maximumRouteStops &&
    candidate.path.every(isKnownPollinatorPoint) &&
    candidate.path[candidate.path.length - 1].x === candidate.x &&
    candidate.path[candidate.path.length - 1].y === candidate.y &&
    typeof candidate.message === "string" &&
    isPollen(candidate.pollen)
  );
};

export function initialPollinator(): PollinatorState {
  const { x, y } = POLLINATOR_TEACHING_ASSUMPTIONS.nest;
  return {
    x,
    y,
    pollen: null,
    visits: 0,
    transfers: 0,
    pollinated: [],
    path: [{ x, y }],
    message: "Start at the nest. Visit a flower to collect pollen.",
  };
}

export function calculatePollinatorVisit(input: {
  state: PollinatorState;
  flowerId: string;
  reach: number;
  habitat: boolean;
}): PollinatorVisitResult | null {
  if (
    !isState(input.state) ||
    !isPollinatorFlowerId(input.flowerId) ||
    !isReach(input.reach) ||
    typeof input.habitat !== "boolean"
  )
    return null;
  const target = POLLINATOR_FLOWER_BY_ID[input.flowerId];
  const distance = Math.hypot(
    target.x - input.state.x,
    target.y - input.state.y,
  );
  if (!Number.isFinite(distance)) return null;
  if ("bridge" in target && target.bridge && !input.habitat)
    return {
      state: {
        ...input.state,
        message: `${target.name} is absent until the habitat stop is added.`,
      },
      flowerId: target.id,
      distance,
      outcome: "habitat-required",
      compatibleTransfer: false,
    };
  if (distance > input.reach)
    return {
      state: {
        ...input.state,
        message: `${target.name} is beyond the bee's invented flight reach. Choose a closer stop.`,
      },
      flowerId: target.id,
      distance,
      outcome: "out-of-reach",
      compatibleTransfer: false,
    };
  const compatibleTransfer =
    input.state.pollen?.species === target.species &&
    input.state.pollen.sourceId !== target.id;
  return {
    state: {
      x: target.x,
      y: target.y,
      pollen: { species: target.species, sourceId: target.id },
      visits: input.state.visits + 1,
      transfers: input.state.transfers + (compatibleTransfer ? 1 : 0),
      pollinated: compatibleTransfer
        ? [...new Set([...input.state.pollinated, target.id])]
        : [...input.state.pollinated],
      path: [
        ...input.state.path.slice(
          -(POLLINATOR_TEACHING_ASSUMPTIONS.maximumRouteStops - 1),
        ),
        { x: target.x, y: target.y },
      ],
      message: compatibleTransfer
        ? `${target.name} received compatible pollen from a different flower in this model.`
        : input.state.pollen?.sourceId === target.id
          ? "Revisiting the same flower did not transfer pollen from a different flower."
          : input.state.pollen
            ? "Different flower species: the bee visited, but this model records no compatible pollen transfer."
            : `${target.name}: pollen collected. Next, visit another flower of the same model species.`,
    },
    flowerId: target.id,
    distance,
    outcome: "visited",
    compatibleTransfer,
  };
}

export function visitFlower(
  state: PollinatorState,
  flowerId: string,
  reach: number,
  habitat: boolean,
): PollinatorState {
  const result = calculatePollinatorVisit({ state, flowerId, reach, habitat });
  if (!result) throw new RangeError("Invalid pollinator visit input.");
  return result.state;
}

export function runPollinatorRoute(
  input: PollinatorRouteInput,
): PollinatorRouteResult | null {
  if (
    !isReach(input.reach) ||
    typeof input.habitat !== "boolean" ||
    !Array.isArray(input.flowerIds) ||
    input.flowerIds.length === 0 ||
    input.flowerIds.length >
      POLLINATOR_TEACHING_ASSUMPTIONS.maximumRouteStops ||
    !input.flowerIds.every(
      (flowerId) => flowerId === "trial" || isPollinatorFlowerId(flowerId),
    ) ||
    (input.flowerIds.includes("trial")
      ? !isPollinatorSpecies(input.trialSpecies)
      : input.trialSpecies !== undefined)
  )
    return null;
  let state = initialPollinator();
  let blockedAttempts = 0;
  for (const routeStop of input.flowerIds) {
    const flowerId =
      routeStop === "trial"
        ? POLLINATOR_COMPATIBILITY_TARGETS[input.trialSpecies!].id
        : routeStop;
    const result = calculatePollinatorVisit({
      state,
      flowerId,
      reach: input.reach,
      habitat: input.habitat,
    });
    if (!result) return null;
    state = result.state;
    if (result.outcome !== "visited") blockedAttempts += 1;
  }
  const lastStop = input.flowerIds[input.flowerIds.length - 1];
  const target =
    lastStop === "trial"
      ? POLLINATOR_COMPATIBILITY_TARGETS[input.trialSpecies!]
      : POLLINATOR_FLOWER_BY_ID[lastStop as PollinatorFlowerId];
  return {
    state,
    visits: state.visits,
    transfers: state.transfers,
    receivedCount: state.pollinated.length,
    blockedAttempts,
    reachedTarget: state.x === target.x && state.y === target.y,
  };
}

export function comparePollinatorRoutes(
  baselineInput: PollinatorRouteInput,
  comparisonInput: PollinatorRouteInput,
) {
  const baseline = runPollinatorRoute(baselineInput);
  const comparison = runPollinatorRoute(comparisonInput);
  if (!baseline || !comparison) return null;
  return {
    baseline,
    comparison,
    change: {
      visits: comparison.visits - baseline.visits,
      transfers: comparison.transfers - baseline.transfers,
      receivedCount: comparison.receivedCount - baseline.receivedCount,
      blockedAttempts: comparison.blockedAttempts - baseline.blockedAttempts,
    },
  };
}

export const POLLINATOR_COMPATIBILITY_TRIAL = Object.freeze({
  baseline: Object.freeze({
    reach: 170,
    habitat: false,
    flowerIds: Object.freeze(["a", "trial"]),
    trialSpecies: "gold",
  }) satisfies PollinatorRouteInput,
  comparison: Object.freeze({
    reach: 170,
    habitat: false,
    flowerIds: Object.freeze(["a", "trial"]),
    trialSpecies: "violet",
  }) satisfies PollinatorRouteInput,
});

export const POLLINATOR_HABITAT_TRIAL = Object.freeze({
  baseline: Object.freeze({
    reach: 170,
    habitat: false,
    flowerIds: Object.freeze(["a", "b", "bridge-a", "d"]),
  }) satisfies PollinatorRouteInput,
  comparison: Object.freeze({
    reach: 170,
    habitat: true,
    flowerIds: Object.freeze(["a", "b", "bridge-a", "d"]),
  }) satisfies PollinatorRouteInput,
});
