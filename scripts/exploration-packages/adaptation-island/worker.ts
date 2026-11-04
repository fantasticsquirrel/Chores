import { installLesson } from "../physical-lesson";
import {
  defaultAdaptationIslandState as initial,
  nextIslandGeneration,
  resetIsland,
  islandObservation,
  adaptationIslandBoundary,
  adaptationIslandCoreBoundary,
  adaptationIslandTrials,
  advanceIslandGenerations,
  normalizeAdaptationIslandState,
} from "./model";
import { createAdaptationIslandScene } from "./island";
installLesson({
  initial,
  normalize: normalizeAdaptationIslandState,
  build: createAdaptationIslandScene,
  title: "Which inherited variant becomes more common?",
  introduction:
    "Predict a population trend, change one selective condition, and use five-generation proportions to explain the evidence.",
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
      run: (state) => advanceIslandGenerations(state, 5),
    },
    { id: "resetPopulation", label: "Reset population", run: resetIsland },
  ],
  describe: (s) =>
    `${islandObservation(s)} Initial dark ${s.initialDark.toFixed(1)}%; pale ${(100 - s.initialDark).toFixed(1)}%. Current dark ${s.darkCount.toFixed(1)}%; pale ${s.lightCount.toFixed(1)}%. Twenty symbols approximate shares, each 5 percentage points, not tracked individuals. ${s.predators ? "Matching shells have relative survival-and-contribution weight 0.9; contrasting shells 0.5." : "Both colors have equal relative weight 0.9 without predation."} ${s.darkCount === 0 || s.lightCount === 0 ? "Missing colors cannot appear without mutation or migration." : ""}`,
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
  trials: adaptationIslandTrials.map((trial) => ({
    ...trial,
    choices: [...trial.choices],
    held: [...trial.held],
  })),
  note: `${adaptationIslandCoreBoundary} ${adaptationIslandBoundary} Initial-share changes reset generation 0; habitat or predation changes affect future generations only, so reset for a fair manual trial.`,
});
