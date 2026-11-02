/** Deterministic teaching models. Distances, cargo prices and route timings are illustrative. */
export function simplifyFraction(numerator: number, denominator: number) {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.abs(numerator), denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}
export function addFractions(a: number, b: number, c: number, d: number) {
  return simplifyFraction(a * d + c * b, b * d);
}
export function vertexFit(sides: number, copies: number) {
  const angle = ((sides - 2) * 180) / sides;
  const occupied = angle * copies;
  return {
    angle,
    gap: Math.max(0, 360 - occupied),
    overlap: Math.max(0, occupied - 360),
  };
}
export function transformPoint(
  x: number,
  y: number,
  degrees: number,
  reflected: boolean,
) {
  const angle = (degrees * Math.PI) / 180;
  const horizontal = reflected ? -x : x;
  return {
    x: horizontal * Math.cos(angle) - y * Math.sin(angle),
    y: horizontal * Math.sin(angle) + y * Math.cos(angle),
  };
}
export function regularTile(sides: number, side: number, rotation = 0) {
  const vertices = [{ x: 0, y: 0 }];
  let x = 0,
    y = 0;
  for (let i = 0; i < sides - 1; i++) {
    const heading = (rotation * Math.PI) / 180 + (i * 2 * Math.PI) / sides;
    x += side * Math.cos(heading);
    y += side * Math.sin(heading);
    vertices.push({ x, y });
  }
  return vertices;
}
export * from "./caravans";
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
export function sampleOutcomes(
  weights: number[],
  trials: number,
  random: () => number = Math.random,
) {
  const chances = probabilities(weights),
    counts = weights.map(() => 0);
  if (!chances.some((p) => p > 0)) return counts;
  for (let trial = 0; trial < trials; trial++) {
    const value = random();
    let cumulative = 0;
    for (let i = 0; i < chances.length; i++) {
      cumulative += chances[i];
      if (value < cumulative || i === chances.length - 1) {
        counts[i]++;
        break;
      }
    }
  }
  return counts;
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
