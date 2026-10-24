import { installLesson } from "../physical-lesson";
import {
  defaultAdaptationIslandState as initial,
  nextIslandGeneration,
  resetIsland,
  islandObservation,
} from "./model";
import { createAdaptationIslandScene } from "./island";
const five = (s: typeof initial) =>
  Array.from({ length: 5 }).reduce<typeof initial>(
    (p) => nextIslandGeneration(p),
    s,
  );
installLesson({
  initial,
  build: createAdaptationIslandScene,
  title: "Which inherited variant becomes more common?",
  introduction:
    "Compare shell-color proportions across generations. Change the ground or remove predation, then start from the same population.",
  fields: [
    {
      id: "habitat",
      label: "Ground color",
      options: ["dark", "light"],
      labels: ["Dark rocky ground", "Pale sandy ground"],
    },
    { id: "predators", label: "Include predation", toggle: true },
    {
      id: "initialDark",
      label: "Initial dark-shell share (%)",
      min: 0,
      max: 100,
      step: 5,
    },
  ],
  change: (s, k, v) =>
    k === "initialDark"
      ? resetIsland({ ...s, initialDark: v })
      : { ...s, [k]: v },
  actions: [
    { id: "next", label: "Next generation", run: nextIslandGeneration },
    {
      id: "five",
      label: "Advance up to five generations (maximum 20)",
      run: five,
    },
    { id: "resetPopulation", label: "Reset population", run: resetIsland },
  ],
  describe: (s) =>
    `${islandObservation(s)} Initial dark ${s.initialDark.toFixed(1)}%; pale ${(100 - s.initialDark).toFixed(1)}%. Current dark ${s.darkCount.toFixed(1)}%; pale ${s.lightCount.toFixed(1)}%. Twenty symbols approximate shares, each 5 percentage points, not tracked individuals. ${s.predators ? "Matching shells have survival weight 0.9; contrasting shells 0.5." : "Both colors have survival weight 0.9 without predation."} ${s.darkCount === 0 || s.lightCount === 0 ? "Missing colors cannot appear without mutation or migration." : ""}`,
  vector: (s) => {
    const bar = (label: string, dark: number, y: number) => [
      {
        tag: "text",
        attrs: { x: 12, y, fill: "#18332c", fontSize: 14 },
        children: [
          `${label}: dark ${dark.toFixed(1)}%, pale ${(100 - dark).toFixed(1)}%`,
        ],
      },
      {
        tag: "rect",
        attrs: { x: 12, y: y + 8, width: 376, height: 20, fill: "#e4d6b1" },
        children: [],
      },
      {
        tag: "rect",
        attrs: {
          x: 12,
          y: y + 8,
          width: (376 * dark) / 100,
          height: 20,
          fill: "#344b49",
        },
        children: [],
      },
    ];
    return {
      viewBox: [0, 0, 400, 130],
      description:
        "Initial and current expected population proportions. Dark and pale sum to 100 percent.",
      nodes: [
        ...bar("Initial", s.initialDark, 22),
        ...bar("Current", s.darkCount, 82),
      ],
    };
  },
  trials: [
    {
      title: "Change the environment",
      question:
        "Will the same starting variants reach the same proportions on dark and pale ground?",
      choices: ["Same proportions", "Different proportions"],
      controlled:
        "Start 50% each variant with predation and compare exactly five generations, changing only habitat. Each comparison resets the same population.",
      before: five({ ...initial, habitat: "dark", predators: true }),
      after: five({ ...initial, habitat: "light", predators: true }),
      change: "Compare pale ground after five generations",
      explain:
        "Which variant increased? How does relative survival change descendant proportions without changing individual shell colors?",
    },
    {
      title: "Remove predation",
      question:
        "Will proportions change when both variants have equal survival?",
      choices: ["Proportions stay fixed", "One color increases"],
      controlled:
        "Use dark ground, 50% each variant and five generations. Change only predation, with identical starting population.",
      before: five({ ...initial, habitat: "dark", predators: true }),
      after: five({ ...initial, habitat: "dark", predators: false }),
      change: "Compare no predation after five generations",
      explain:
        "Compare initial and current proportions. Which difference is necessary for selection to shift proportions here?",
    },
  ],
  note: "Deterministic expected frequencies, not sampled population or real-beetle forecast. Survival weights invented; offspring copy parental variant without mating or genes, normalized to 100%. Population size, mutation, migration and random drift omitted. Natural selection changes populations across generations, not individuals choosing useful traits. Initial-share changes reset generation 0; habitat/predation change future generations only; reset for a fair trial.",
});
