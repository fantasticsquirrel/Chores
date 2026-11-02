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
export {
  POLLINATOR_COMPATIBILITY_TRIAL,
  POLLINATOR_COMPATIBILITY_TARGETS,
  POLLINATOR_FLOWERS,
  POLLINATOR_HABITAT_TRIAL,
  POLLINATOR_TEACHING_ASSUMPTIONS,
  calculatePollinatorVisit,
  comparePollinatorRoutes,
  initialPollinator,
  isPollinatorFlowerId,
  runPollinatorRoute,
  visitFlower,
} from "./pollinators";
export type {
  FlowerSpecies,
  PollinatorFlower,
  PollinatorFlowerId,
  PollinatorRouteInput,
  PollinatorRouteResult,
  PollinatorState,
  PollinatorVisitOutcome,
  PollinatorVisitResult,
} from "./pollinators";
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
