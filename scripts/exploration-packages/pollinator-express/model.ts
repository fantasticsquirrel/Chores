/** Standalone deterministic package model. All distances are invented garden units. */
export type FlowerSpecies = "gold" | "violet";
export const POLLINATOR_FLOWERS = [
  { id: "a", name: "Gold 1", species: "gold", x: 140, y: 250 },
  { id: "b", name: "Gold 2", species: "gold", x: 230, y: 195 },
  { id: "c", name: "Violet 1", species: "violet", x: 180, y: 145 },
  {
    id: "bridge-a",
    name: "Gold bridge",
    species: "gold",
    x: 350,
    y: 205,
    bridge: true,
  },
  {
    id: "bridge-b",
    name: "Violet bridge",
    species: "violet",
    x: 340,
    y: 300,
    bridge: true,
  },
  { id: "d", name: "Gold 3", species: "gold", x: 490, y: 235 },
  { id: "e", name: "Violet 2", species: "violet", x: 570, y: 160 },
  { id: "f", name: "Gold 4", species: "gold", x: 590, y: 300 },
] as const;
export const POLLINATOR_COMPATIBILITY_TARGETS = Object.freeze({
  gold: Object.freeze({
    id: "trial-gold",
    name: "Gold trial flower",
    species: "gold",
    x: 230,
    y: 195,
    trial: true,
  }),
  violet: Object.freeze({
    id: "trial-violet",
    name: "Violet trial flower",
    species: "violet",
    x: 230,
    y: 195,
    trial: true,
  }),
} as const);
export type PollinatorFlower =
  | (typeof POLLINATOR_FLOWERS)[number]
  | (typeof POLLINATOR_COMPATIBILITY_TARGETS)[FlowerSpecies];
export type PollinatorFlowerId = PollinatorFlower["id"];
const BY_ID: Readonly<Record<PollinatorFlowerId, PollinatorFlower>> = {
  a: POLLINATOR_FLOWERS[0],
  b: POLLINATOR_FLOWERS[1],
  c: POLLINATOR_FLOWERS[2],
  "bridge-a": POLLINATOR_FLOWERS[3],
  "bridge-b": POLLINATOR_FLOWERS[4],
  d: POLLINATOR_FLOWERS[5],
  e: POLLINATOR_FLOWERS[6],
  f: POLLINATOR_FLOWERS[7],
  "trial-gold": POLLINATOR_COMPATIBILITY_TARGETS.gold,
  "trial-violet": POLLINATOR_COMPATIBILITY_TARGETS.violet,
};
export const POLLINATOR_TEACHING_ASSUMPTIONS = Object.freeze({
  nest: Object.freeze({ x: 70, y: 320 }),
  comparisonReach: 170,
  minimumReach: 80,
  maximumReach: 240,
  reachStep: 10,
  maximumRouteStops: 24,
  pollenLoadsRemembered: 1,
});
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
const owns = (value: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);
export const isPollinatorFlowerId = (
  value: unknown,
): value is PollinatorFlowerId =>
  typeof value === "string" && owns(BY_ID, value);
const isReach = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value) &&
  value >= POLLINATOR_TEACHING_ASSUMPTIONS.minimumReach &&
  value <= POLLINATOR_TEACHING_ASSUMPTIONS.maximumReach &&
  value % POLLINATOR_TEACHING_ASSUMPTIONS.reachStep === 0;
const isSpecies = (value: unknown): value is FlowerSpecies =>
  value === "gold" || value === "violet";
const isKnownPoint = (point: unknown): point is { x: number; y: number } => {
  if (typeof point !== "object" || point === null) return false;
  const { x, y } = point as { x?: number; y?: number };
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const nest = POLLINATOR_TEACHING_ASSUMPTIONS.nest;
  return (
    (x === nest.x && y === nest.y) ||
    Object.values(BY_ID).some((flower) => flower.x === x && flower.y === y)
  );
};
const isPollen = (pollen: unknown) => {
  if (pollen === null) return true;
  if (typeof pollen !== "object") return false;
  const candidate = pollen as { sourceId?: unknown; species?: unknown };
  return (
    isPollinatorFlowerId(candidate.sourceId) &&
    isSpecies(candidate.species) &&
    BY_ID[candidate.sourceId].species === candidate.species
  );
};
const isState = (state: unknown): state is PollinatorState => {
  if (typeof state !== "object" || state === null) return false;
  const s = state as PollinatorState;
  return (
    isKnownPoint(s) &&
    Number.isSafeInteger(s.visits) &&
    s.visits >= 0 &&
    s.visits < Number.MAX_SAFE_INTEGER &&
    Number.isSafeInteger(s.transfers) &&
    s.transfers >= 0 &&
    s.transfers <= s.visits &&
    Array.isArray(s.pollinated) &&
    s.pollinated.every(isPollinatorFlowerId) &&
    Array.isArray(s.path) &&
    s.path.length > 0 &&
    s.path.length <= POLLINATOR_TEACHING_ASSUMPTIONS.maximumRouteStops &&
    s.path.every(isKnownPoint) &&
    s.path[s.path.length - 1].x === s.x &&
    s.path[s.path.length - 1].y === s.y &&
    typeof s.message === "string" &&
    isPollen(s.pollen)
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
}) {
  if (
    !isState(input.state) ||
    !isPollinatorFlowerId(input.flowerId) ||
    !isReach(input.reach) ||
    typeof input.habitat !== "boolean"
  )
    return null;
  const target = BY_ID[input.flowerId];
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
      outcome: "habitat-required" as const,
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
      outcome: "out-of-reach" as const,
      compatibleTransfer: false,
    };
  const compatibleTransfer =
    input.state.pollen?.species === target.species &&
    input.state.pollen.sourceId !== target.id;
  const state: PollinatorState = {
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
  };
  return {
    state,
    flowerId: target.id,
    distance,
    outcome: "visited" as const,
    compatibleTransfer,
  };
}
export function visitFlower(
  state: PollinatorState,
  flowerId: string,
  reach: number,
  habitat: boolean,
) {
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
      ? !isSpecies(input.trialSpecies)
      : input.trialSpecies !== undefined)
  )
    return null;
  let state = initialPollinator(),
    blockedAttempts = 0;
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
      : BY_ID[lastStop as PollinatorFlowerId];
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
  const baseline = runPollinatorRoute(baselineInput),
    comparison = runPollinatorRoute(comparisonInput);
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
