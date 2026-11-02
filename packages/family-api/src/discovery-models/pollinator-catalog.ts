/** Schematic flower catalog and numeric bounds for the pollinator lesson. */
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

export const POLLINATOR_FLOWER_BY_ID: Readonly<
  Record<PollinatorFlowerId, PollinatorFlower>
> = {
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

export const isPollinatorFlowerId = (
  value: unknown,
): value is PollinatorFlowerId =>
  typeof value === "string" &&
  Object.prototype.hasOwnProperty.call(POLLINATOR_FLOWER_BY_ID, value);

export const isPollinatorSpecies = (value: unknown): value is FlowerSpecies =>
  value === "gold" || value === "violet";

export const isKnownPollinatorPoint = (
  point: unknown,
): point is { x: number; y: number } => {
  if (typeof point !== "object" || point === null) return false;
  const { x, y } = point as { x?: number; y?: number };
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const nest = POLLINATOR_TEACHING_ASSUMPTIONS.nest;
  return (
    (x === nest.x && y === nest.y) ||
    Object.values(POLLINATOR_FLOWER_BY_ID).some(
      (flower) => flower.x === x && flower.y === y,
    )
  );
};
