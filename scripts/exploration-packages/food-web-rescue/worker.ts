import { createFrameCompactor } from "../shared/compact-frame";
import { landscapeScene, serializeLandscape } from "../shared/landscape-scene";
import { svgNodes } from "../shared/vector-author";
import { PondTrend } from "./PondTrend";
import {
  POND_DEFAULT_CONDITIONS,
  POND_INITIAL_STATE,
  POND_NUTRIENT_COMPARISON,
  POND_PREDATOR_COMPARISON,
  advancePondWeek,
  comparePondScenarios,
  normalizePondConditions,
  pondStateAtPhase,
  runPondTrial,
  type PondConditions,
  type PondScenario,
  type PondState,
} from "./model";
import { buildPond } from "./pond";

type PredatorPrediction = "" | "cascade" | "algae-up" | "unchanged";
type NutrientPrediction = "" | "fish-lower" | "all-higher" | "same";
type Trial = { week: number; pond: PondState; trail: PondState[] };

const predatorEvidence = POND_PREDATOR_COMPARISON.map((scenario) =>
  runPondTrial(scenario),
);
const nutrientEvidence = POND_NUTRIENT_COMPARISON.map((scenario) =>
  runPondTrial(scenario),
);
const predatorVariables = comparePondScenarios(...POND_PREDATOR_COMPARISON);
const nutrientVariables = comparePondScenarios(...POND_NUTRIENT_COMPARISON);

let conditions: PondConditions;
let trial: Trial;
let phase: number;
let playing: boolean;
let predatorPrediction: PredatorPrediction;
let nutrientPrediction: NutrientPrediction;
let predatorComplete: boolean;
let nutrientComplete: boolean;

function reset() {
  conditions = { ...POND_DEFAULT_CONDITIONS };
  trial = {
    week: 0,
    pond: { ...POND_INITIAL_STATE },
    trail: [{ ...POND_INITIAL_STATE }],
  };
  phase = 0;
  playing = false;
  predatorPrediction = "";
  nutrientPrediction = "";
  predatorComplete = false;
  nutrientComplete = false;
}
reset();

function stopMarkers() {
  phase = 0;
  playing = false;
}
function showTrial(scenario: PondScenario) {
  const result = runPondTrial(scenario);
  conditions = { ...result.conditions };
  trial = { week: result.week, pond: result.state, trail: result.trail };
  stopMarkers();
}
function readings(label: string, result: (typeof predatorEvidence)[number]) {
  const state = result.state;
  return `${label}: algae ${state.algae.toFixed(1)} · zooplankton ${state.zooplankton.toFixed(1)} · fish ${state.fish.toFixed(1)} · oxygen ${state.oxygen.toFixed(1)} · detritus ${state.detritus.toFixed(1)}`;
}

function run(input: any) {
  if (input.type === "reset") reset();
  const key = input.control as string | undefined;
  const value = key ? input.values?.[key] : undefined;
  const unlocked = () => predatorComplete && nutrientComplete;

  const predatorChoice: Record<string, PredatorPrediction> = {
    predatorCascade: "cascade",
    predatorAlgaeUp: "algae-up",
    predatorUnchanged: "unchanged",
  };
  const nutrientChoice: Record<string, NutrientPrediction> = {
    nutrientFishLower: "fish-lower",
    nutrientAllHigher: "all-higher",
    nutrientSame: "same",
  };
  if (key && predatorChoice[key]) {
    predatorPrediction = predatorChoice[key];
    predatorComplete = false;
    stopMarkers();
  }
  if (key && nutrientChoice[key]) {
    nutrientPrediction = nutrientChoice[key];
    nutrientComplete = false;
    stopMarkers();
  }
  if (key === "comparePredator" && predatorPrediction) {
    predatorComplete = true;
    showTrial(POND_PREDATOR_COMPARISON[1]);
  }
  if (key === "showFishPresent") showTrial(POND_PREDATOR_COMPARISON[0]);
  if (key === "showFishAbsent") showTrial(POND_PREDATOR_COMPARISON[1]);
  if (key === "compareNutrients" && nutrientPrediction) {
    nutrientComplete = true;
    showTrial(POND_NUTRIENT_COMPARISON[1]);
  }
  if (key === "showLowNutrients") showTrial(POND_NUTRIENT_COMPARISON[0]);
  if (key === "showHighNutrients") showTrial(POND_NUTRIENT_COMPARISON[1]);

  if (unlocked() && input.type === "control" && Number.isFinite(value)) {
    if (key === "nutrients" || key === "drought")
      conditions = normalizePondConditions({ ...conditions, [key]: value });
    if (key === "algae" || key === "zooplankton" || key === "fish") {
      const pond = {
        ...trial.pond,
        [key]: value === 1 ? POND_INITIAL_STATE[key] : 0,
      };
      trial = {
        ...trial,
        pond,
        trail: [...trial.trail.slice(0, -1), pond],
      };
    }
    if (key === "phase") {
      phase = value / 100;
      playing = false;
    } else stopMarkers();
  }
  if (unlocked() && key === "advanceWeek") {
    const next = advancePondWeek(trial.pond, conditions).state;
    trial = {
      week: trial.week + 1,
      pond: next,
      trail: [...trial.trail.slice(-20), next],
    };
    playing = false;
  }
  if (unlocked() && key === "play") playing = !playing;
  if (unlocked() && key === "start") stopMarkers();
  if (playing && Number.isFinite(input.dt) && input.dt > 0)
    phase = (phase + input.dt / 3.5) % 1;

  const visual = pondStateAtPhase(trial.pond, conditions, phase);
  const scene = landscapeScene(buildPond({ kind: "pond", ...visual }), "pond");
  const scene3d = serializeLandscape(scene, {
    title: "Trace a change through the pond",
    subtitle: `Week ${trial.week} · algae → zooplankton → fish · relative indices`,
    background: ["#d9e3d6", "#acc5bb", "#7d9f91"],
  });
  scene.dispose();

  const freeExploration = unlocked();
  const buttons = [
    {
      id: "predatorCascade",
      label: "Zooplankton rises and algae falls",
      pressed: predatorPrediction === "cascade",
    },
    {
      id: "predatorAlgaeUp",
      label: "Algae and zooplankton both rise",
      pressed: predatorPrediction === "algae-up",
    },
    {
      id: "predatorUnchanged",
      label: "Only fish changes",
      pressed: predatorPrediction === "unchanged",
    },
    {
      id: "comparePredator",
      label: "Compare fish present and absent",
      disabled: !predatorPrediction || predatorComplete,
    },
    ...(predatorComplete
      ? [
          { id: "showFishPresent", label: "Show fish-present evidence" },
          { id: "showFishAbsent", label: "Show fish-absent evidence" },
        ]
      : []),
    {
      id: "nutrientFishLower",
      label: "Fish and oxygen both finish lower",
      pressed: nutrientPrediction === "fish-lower",
    },
    {
      id: "nutrientAllHigher",
      label: "Every index finishes higher",
      pressed: nutrientPrediction === "all-higher",
    },
    {
      id: "nutrientSame",
      label: "Nutrients make no difference",
      pressed: nutrientPrediction === "same",
    },
    {
      id: "compareNutrients",
      label: "Compare low and high nutrients",
      disabled: !nutrientPrediction || nutrientComplete,
    },
    ...(nutrientComplete
      ? [
          { id: "showLowNutrients", label: "Show low-nutrient evidence" },
          { id: "showHighNutrients", label: "Show high-nutrient evidence" },
        ]
      : []),
    ...(freeExploration
      ? [
          { id: "advanceWeek", label: "Advance one week" },
          {
            id: "play",
            label: playing ? "Pause energy flow" : "Play energy flow",
          },
          { id: "start", label: "Start markers" },
        ]
      : []),
  ];

  const predatorText = predatorComplete
    ? `The evidence ${predatorPrediction === "cascade" ? "matches" : "differs from"} your prediction. ${readings("Fish present", predatorEvidence[0])}. ${readings("Fish absent", predatorEvidence[1])}. Changed: ${predatorVariables.changed.join(", ")}. Held: ${predatorVariables.held.join(" · ")}. With no fish predation, the grazer index rises and grazing pushes the algae index lower.`
    : "Keep nutrient supply at 50, drought at 0%, and every other starting index the same. Predict what changes after 6 model weeks when fish are absent.";
  const nutrientText = nutrientComplete
    ? `The evidence ${nutrientPrediction === "fish-lower" ? "matches" : "differs from"} your prediction. ${readings("Low nutrients", nutrientEvidence[0])}. ${readings("High nutrients", nutrientEvidence[1])}. Changed: ${nutrientVariables.changed.join(", ")}. Held: ${nutrientVariables.held.join(" · ")}. Added nutrients support more algae in this model, while algal turnover and detritus are linked to lower net oxygen; this is not a real-pond forecast.`
    : "Keep drought at 60%, every population present, and all starting indices the same. Predict what changes after 8 model weeks from nutrient index 20 to 100.";
  const first = trial.trail[0];
  const trendSummary = `Trend from week ${Math.max(0, trial.week - trial.trail.length + 1)} to ${trial.week}: algae ${first.algae.toFixed(1)} to ${trial.pond.algae.toFixed(1)}; zooplankton ${first.zooplankton.toFixed(1)} to ${trial.pond.zooplankton.toFixed(1)}; fish ${first.fish.toFixed(1)} to ${trial.pond.fish.toFixed(1)}; oxygen ${first.oxygen.toFixed(1)} to ${trial.pond.oxygen.toFixed(1)}.`;
  const vectorTree = PondTrend(trial);

  return {
    animate: playing,
    scene3d,
    shapes: [],
    vector: {
      viewBox: [0, 0, 800, 130],
      description: `${trendSummary} All values are relative indices from 0 to 100.`,
      nodes: [
        ...svgNodes(vectorTree)[0].children,
        {
          tag: "text",
          attrs: { x: 5, y: 120, fontSize: 14, fill: "#35493a" },
          children: [
            "Algae · zooplankton · fish · oxygen — relative indices 0–100",
          ],
        },
      ],
    },
    description: `Dimensional pond at model week ${trial.week}. Algae ${trial.pond.algae.toFixed(1)}, zooplankton ${trial.pond.zooplankton.toFixed(1)}, fish ${trial.pond.fish.toFixed(1)}, net oxygen ${trial.pond.oxygen.toFixed(1)}, and detritus ${trial.pond.detritus.toFixed(1)}; all are relative indices. Nutrient supply index ${conditions.nutrients.toFixed(0)} and drought severity ${conditions.drought.toFixed(0)}%. Gold arrows point algae → zooplankton → fish, from resource or prey to consumer, and show energy-flow direction rather than animal movement. Marker phase ${Math.round(phase * 100)}%. ${trendSummary}`,
    readoutColumns: 4,
    readouts: [
      { label: "Algae population index", value: trial.pond.algae.toFixed(1) },
      { label: "Zooplankton index", value: trial.pond.zooplankton.toFixed(1) },
      { label: "Fish population index", value: trial.pond.fish.toFixed(1) },
      { label: "Net oxygen index", value: trial.pond.oxygen.toFixed(1) },
      { label: "Detritus index", value: trial.pond.detritus.toFixed(1) },
    ],
    controls: freeExploration
      ? [
          {
            id: "nutrients",
            label: "Nutrient supply index",
            min: 0,
            max: 100,
            step: 1,
            value: conditions.nutrients,
          },
          {
            id: "drought",
            label: "Drought severity (%)",
            min: 0,
            max: 100,
            step: 1,
            value: conditions.drought,
          },
          ...(["algae", "zooplankton", "fish"] as const).map((id) => ({
            id,
            label: `${id === "zooplankton" ? "Zooplankton" : id[0].toUpperCase() + id.slice(1)} present`,
            kind: "toggle",
            min: 0,
            max: 1,
            step: 1,
            value: trial.pond[id] > 0 ? 1 : 0,
          })),
          {
            id: "phase",
            label: "Energy-flow marker phase (%)",
            min: 0,
            max: 100,
            step: 1,
            value: Math.round(phase * 100),
          },
        ]
      : [],
    buttons,
    sections: [
      {
        heading: "1. Remove a consumer",
        text: predatorText,
        buttonIds: buttons
          .filter(
            (button) =>
              button.id.startsWith("predator") ||
              button.id === "comparePredator" ||
              button.id.startsWith("showFish"),
          )
          .map((button) => button.id),
      },
      {
        heading: "2. Increase nutrient supply",
        text: nutrientText,
        buttonIds: buttons
          .filter(
            (button) =>
              button.id.startsWith("nutrient") ||
              button.id === "compareNutrients" ||
              button.id.includes("Nutrients"),
          )
          .map((button) => button.id),
      },
      {
        heading: "3. Explore one variable",
        text: freeExploration
          ? "Controls are unlocked. Reset before a new comparison, change one input, and advance equal numbers of illustrative weeks. Motion is optional and changes no reading."
          : "Complete both fixed comparisons to unlock population, nutrient, drought, week, and static marker controls.",
        buttonIds: buttons
          .filter((button) =>
            ["advanceWeek", "play", "start"].includes(button.id),
          )
          .map((button) => button.id),
      },
      {
        heading: "Explain the evidence",
        text: "Food-web arrows run from resource or prey to consumer because they trace energy transfer. They do not depict organisms moving. Nutrients can support algal growth; respiration and decomposition can consume dissolved oxygen. Real responses depend on light, temperature, mixing, nutrient form, species, and other processes.",
      },
    ],
    footnote:
      "Model boundary: one algae–grazer–fish chain inside a larger food web. The 0–100 population, nutrient, oxygen and detritus indices, weekly step and coefficients are invented bounded teaching quantities—not counts, concentrations, measured rates or forecasts. Oxygen is a simplified net-balance index. Organisms, bubbles, particles and gold energy-flow arrows are magnified schematic symbols; web and offline-package geometry match, while the native app uses its platform diagram renderer.",
  };
}

const compact = createFrameCompactor();
self.onmessage = ({ data }) =>
  self.postMessage(compact(run(data), data.type === "reset"));
