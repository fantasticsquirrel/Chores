import { addFractionParts, normalizeFraction } from "./fractions";

export * from "./fractions";
export * from "./caravans";

import {
  patternVertexFit,
  regularPolygonVertices,
  rigidTransformPoint,
} from "./patterns";

/** Deterministic teaching models. Distances, cargo prices and route timings are illustrative. */
export function simplifyFraction(numerator: number, denominator: number) {
  const result = normalizeFraction(numerator, denominator);
  if (!result) throw new RangeError("Invalid bounded fraction.");
  return result;
}
export function addFractions(a: number, b: number, c: number, d: number) {
  const result = addFractionParts(a, b, c, d);
  if (!result) throw new RangeError("Invalid bounded fraction addition.");
  return result.sum;
}
export function vertexFit(sides: number, copies: number) {
  const result = patternVertexFit(sides, copies);
  if (!result) throw new RangeError("Invalid regular-polygon vertex input.");
  return {
    angle: result.interiorAngle,
    gap: result.gapAngle,
    overlap: result.overlapAngle,
  };
}
export function transformPoint(
  x: number,
  y: number,
  degrees: number,
  reflected: boolean,
) {
  const result = rigidTransformPoint(
    { x, y },
    {
      rotationDegreesClockwise: degrees,
      reflectAcrossVertical: reflected,
    },
  );
  if (!result) throw new RangeError("Invalid rigid-transform input.");
  return result;
}
export function regularTile(sides: number, side: number, rotation = 0) {
  const result = regularPolygonVertices(sides, side, rotation);
  if (!result) throw new RangeError("Invalid regular-polygon geometry input.");
  return result;
}
export type FlowerSpecies = "gold" | "violet";
export const POLLINATOR_FLOWERS: ReadonlyArray<{
  id: string;
  name: string;
  species: FlowerSpecies;
  x: number;
  y: number;
  bridge?: boolean;
}> = [
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
];
export type PollinatorState = {
  x: number;
  y: number;
  pollen: { species: FlowerSpecies; sourceId: string } | null;
  visits: number;
  transfers: number;
  pollinated: string[];
  path: { x: number; y: number }[];
  message: string;
};
export function initialPollinator(): PollinatorState {
  return {
    x: 70,
    y: 320,
    pollen: null,
    visits: 0,
    transfers: 0,
    pollinated: [],
    path: [{ x: 70, y: 320 }],
    message: "Visit a flower to collect pollen.",
  };
}
export function visitFlower(
  state: PollinatorState,
  flowerId: string,
  reach: number,
  habitat: boolean,
): PollinatorState {
  const target = POLLINATOR_FLOWERS.find((flower) => flower.id === flowerId);
  if (!target || (target.bridge && !habitat))
    return { ...state, message: "That flower needs a habitat patch." };
  if (Math.hypot(target.x - state.x, target.y - state.y) > reach)
    return {
      ...state,
      message:
        "That flower is beyond the bee's flight reach. Find a closer flower.",
    };
  const compatible =
    state.pollen?.species === target.species &&
    state.pollen.sourceId !== target.id;
  return {
    x: target.x,
    y: target.y,
    pollen: { species: target.species, sourceId: target.id },
    visits: state.visits + 1,
    transfers: state.transfers + (compatible ? 1 : 0),
    pollinated: compatible
      ? [...new Set([...state.pollinated, target.id])]
      : state.pollinated,
    path: [...state.path.slice(-23), { x: target.x, y: target.y }],
    message: compatible
      ? `${target.name} received compatible pollen from a different flower.`
      : state.pollen?.sourceId === target.id
        ? "Revisiting the same flower did not transfer pollen from a different flower."
        : state.pollen
          ? "Different flower species: a visit, but no compatible pollen transfer."
          : `${target.name}: pollen collected. Visit another flower of the same species.`,
  };
}
export function probabilities(weights: number[]) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((weight) => (total > 0 ? weight / total : 0));
}
export function drawOutcomes(
  weights: number[],
  trials: number,
  random: () => number = Math.random,
) {
  const chances = probabilities(weights);
  let fallback = -1;
  for (let index = 0; index < chances.length; index++) {
    if (chances[index] > 0) fallback = index;
  }
  if (fallback < 0 || trials <= 0) return [];
  const outcomes: number[] = [];
  for (let trial = 0; trial < Math.floor(trials); trial++) {
    const value = random();
    let cumulative = 0;
    let outcome = fallback;
    for (let index = 0; index < chances.length; index++) {
      cumulative += chances[index];
      if (value < cumulative) {
        outcome = index;
        break;
      }
    }
    outcomes.push(outcome);
  }
  return outcomes;
}
export function countOutcomes(outcomes: number[], outcomeCount: number) {
  const counts = Array.from({ length: outcomeCount }, () => 0);
  for (const outcome of outcomes) {
    if (Number.isInteger(outcome) && outcome >= 0 && outcome < counts.length)
      counts[outcome]++;
  }
  return counts;
}
export function sampleOutcomes(
  weights: number[],
  trials: number,
  random: () => number = Math.random,
) {
  return countOutcomes(drawOutcomes(weights, trials, random), weights.length);
}
export function fairnessDistance(counts: number[], weights: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  const chances = probabilities(weights);
  return total === 0
    ? 0
    : Math.max(
        ...counts.map((count, i) => Math.abs(count / total - chances[i]) * 100),
      );
}
