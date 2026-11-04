import {
  defaultAdaptationIslandState,
  islandObservation,
  nextIslandGeneration,
  type AdaptationIslandState,
} from "./expansion-life-geometry";

export const ISLAND_GENERATION_MAX = 20;
export const ISLAND_SHARE_MIN = 0;
export const ISLAND_SHARE_MAX = 100;

const bound = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizeAdaptationIslandState(
  input: AdaptationIslandState,
): AdaptationIslandState {
  const darkCount = bound(
    input.darkCount,
    ISLAND_SHARE_MIN,
    ISLAND_SHARE_MAX,
    defaultAdaptationIslandState.darkCount,
  );
  return {
    habitat: input.habitat === "light" ? "light" : "dark",
    predators: input.predators === true,
    generation: Math.round(
      bound(
        input.generation,
        0,
        ISLAND_GENERATION_MAX,
        defaultAdaptationIslandState.generation,
      ),
    ),
    darkCount,
    lightCount: ISLAND_SHARE_MAX - darkCount,
    initialDark: bound(
      input.initialDark,
      ISLAND_SHARE_MIN,
      ISLAND_SHARE_MAX,
      defaultAdaptationIslandState.initialDark,
    ),
  };
}

export function advanceIslandGenerations(
  input: AdaptationIslandState,
  count: number,
): AdaptationIslandState {
  const steps = Math.max(0, Math.min(ISLAND_GENERATION_MAX, Math.floor(count)));
  return Array.from({ length: steps }).reduce<AdaptationIslandState>(
    (state) => nextIslandGeneration(state),
    normalizeAdaptationIslandState(input),
  );
}

export type AdaptationIslandTrial = {
  id: "compare-habitats" | "remove-predation";
  title: string;
  question: string;
  choices: readonly string[];
  correctChoice: string;
  controlled: string;
  before: AdaptationIslandState;
  after: AdaptationIslandState;
  caseLabels: readonly [string, string];
  change: string;
  changed: string;
  held: readonly string[];
  evidence: string;
  explain: string;
};

const fiveDark = advanceIslandGenerations(defaultAdaptationIslandState, 5);
const fiveLight = advanceIslandGenerations(
  { ...defaultAdaptationIslandState, habitat: "light" },
  5,
);
const fiveNoPredation = advanceIslandGenerations(
  { ...defaultAdaptationIslandState, predators: false },
  5,
);

export const adaptationIslandTrials: readonly AdaptationIslandTrial[] = [
  {
    id: "compare-habitats",
    title: "Compare habitats",
    question:
      "From the same inherited variation, will dark and pale ground produce the same expected proportions?",
    choices: ["Same proportions", "Different proportions"],
    correctChoice: "Different proportions",
    controlled:
      "Start each trial with 50% dark and 50% pale variants, visual predators present, the same invented 0.9/0.5 survival weights and exactly five generations. Change only ground color.",
    before: fiveDark,
    after: fiveLight,
    caseLabels: ["Dark ground · 5 generations", "Pale ground · 5 generations"],
    change: "Compare pale ground after five generations",
    changed: "ground color, from dark to pale",
    held: [
      "50% dark and 50% pale start",
      "predators present",
      "survival weights 0.9 and 0.5",
      "five generations",
    ],
    evidence:
      "After five model generations, dark ground gives 95.0% dark and 5.0% pale; pale ground gives 5.0% dark and 95.0% pale.",
    explain:
      "The advantageous inherited variant depends on the environment. Differential survival changes which variants contribute more descendants; no individual changes shell color.",
  },
  {
    id: "remove-predation",
    title: "Remove predation",
    question:
      "With equal survival weights, will the expected shell-color proportions change?",
    choices: ["Proportions stay fixed", "One color increases"],
    correctChoice: "Proportions stay fixed",
    controlled:
      "Use dark ground and start each trial with 50% dark and 50% pale variants for exactly five generations. Change only whether visual predators create unequal survival weights.",
    before: fiveDark,
    after: fiveNoPredation,
    caseLabels: [
      "Predation on · 5 generations",
      "Predation off · 5 generations",
    ],
    change: "Compare no predation after five generations",
    changed: "predation, from present to absent",
    held: [
      "dark ground",
      "50% dark and 50% pale start",
      "five generations",
      "fixed population total",
    ],
    evidence:
      "With predators, unequal 0.9/0.5 weights shift the expected population to 95.0% dark. Without predators, both weights are 0.9 and the expected population remains 50.0% dark and 50.0% pale.",
    explain:
      "Inherited variation alone does not favor either variant. In this controlled model, proportions shift only when the variants differ in expected survival and descendant contribution.",
  },
] as const;

export const adaptationIslandCoreBoundary =
  "This deterministic model compares expected variant proportions, not sampled animals or a forecast. Its 0.9 and 0.5 survival weights are invented teaching values, not measured probabilities.";
export const adaptationIslandBoundary =
  "The model assumes two inherited shell-color variants, visual predation as the only selective pressure, identical descendant contribution among survivors and a population normalized to 100% each generation. Twenty symbols round the calculated percentages to 5-point increments; use the numeric readout as evidence. It omits genes and mating, mutation, migration, random genetic drift, population-size change, overlapping generations, other traits and environmental complexity. A missing variant cannot reappear. Individuals retain their variant; only population proportions change across generations.";

export const adaptationIslandTrialObservations = adaptationIslandTrials.map(
  (trial) => ({
    id: trial.id,
    before: islandObservation(trial.before),
    after: islandObservation(trial.after),
  }),
);
