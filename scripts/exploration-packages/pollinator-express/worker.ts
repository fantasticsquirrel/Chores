import { landscapeScene, serializeLandscape } from "../shared/landscape-scene";
import { buildGarden } from "./garden";
import {
  POLLINATOR_COMPATIBILITY_TRIAL,
  POLLINATOR_COMPATIBILITY_TARGETS,
  POLLINATOR_FLOWERS,
  POLLINATOR_HABITAT_TRIAL,
  comparePollinatorRoutes,
  initialPollinator,
  runPollinatorRoute,
  visitFlower,
  type FlowerSpecies,
} from "./model";

type CompatibilityPrediction = "gold" | "violet" | "neither" | "";
type HabitatPrediction = "without" | "with" | "both" | "";
let reach = 170,
  habitat = false,
  journey = initialPollinator();
let trialSpecies: FlowerSpecies | "none" = "none";
let compatibilityPrediction: CompatibilityPrediction = "";
let habitatPrediction: HabitatPrediction = "";
let compatibilityCompared = false,
  habitatCompared = false;
const compatibility = comparePollinatorRoutes(
  POLLINATOR_COMPATIBILITY_TRIAL.baseline,
  POLLINATOR_COMPATIBILITY_TRIAL.comparison,
)!;
const habitatEvidence = comparePollinatorRoutes(
  POLLINATOR_HABITAT_TRIAL.baseline,
  POLLINATOR_HABITAT_TRIAL.comparison,
)!;
const MAX_SCENE_CACHE_ENTRIES = 6;
const sceneCache = new Map<string, ReturnType<typeof serializeLandscape>>();

function renderGarden(narrow: boolean) {
  const state = {
    kind: "garden" as const,
    x: journey.x,
    y: journey.y,
    reach,
    habitat,
    pollen: journey.pollen?.species ?? "none",
    trialSpecies,
    received: journey.pollinated.map((id) =>
      id.startsWith("trial-")
        ? 1
        : POLLINATOR_FLOWERS.findIndex((flower) => flower.id === id),
    ),
    path: journey.path,
  };
  const cacheKey = JSON.stringify([
    narrow,
    state.x,
    state.y,
    state.reach,
    state.habitat,
    state.pollen,
    state.trialSpecies,
    state.received,
    state.path.map(({ x, y }) => [x, y]),
  ]);
  const cached = sceneCache.get(cacheKey);
  if (cached) {
    sceneCache.delete(cacheKey);
    sceneCache.set(cacheKey, cached);
    return cached;
  }

  const scene = landscapeScene(buildGarden(state), "garden");
  const scene3d = serializeLandscape(scene, {
    title: "Pollinator Express",
    subtitle: "Trace pollen through an invented teaching garden",
    layout: {
      height: narrow ? 430 : 650,
      canvasInset: narrow ? [88, -12, 48, -12] : [72, 0, 34, 0],
    },
    background: ["#eef0d5", "#dae0bb", "#a9b986"],
  });
  scene3d.camera.narrowHalfWidth = 7.25;
  scene.dispose();

  sceneCache.set(cacheKey, scene3d);
  if (sceneCache.size > MAX_SCENE_CACHE_ENTRIES) {
    const oldestKey = sceneCache.keys().next().value;
    if (oldestKey !== undefined) sceneCache.delete(oldestKey);
  }
  return scene3d;
}

function reset() {
  reach = 170;
  habitat = false;
  trialSpecies = "none";
  journey = initialPollinator();
  compatibilityPrediction = "";
  habitatPrediction = "";
  compatibilityCompared = false;
  habitatCompared = false;
}
function showRoute(
  input:
    | typeof POLLINATOR_COMPATIBILITY_TRIAL.baseline
    | typeof POLLINATOR_COMPATIBILITY_TRIAL.comparison
    | typeof POLLINATOR_HABITAT_TRIAL.baseline
    | typeof POLLINATOR_HABITAT_TRIAL.comparison,
) {
  reach = input.reach;
  habitat = input.habitat;
  trialSpecies = input.trialSpecies ?? "none";
  journey = runPollinatorRoute(input)!.state;
}
function visit(id: string) {
  journey = visitFlower(journey, id, reach, habitat);
}

function run(input: any) {
  const narrow = (input.viewportWidth ?? input.width ?? 800) <= 760;
  if (input.type === "reset") reset();
  const key = input.control;
  const value = input.values?.[key];
  const unlocked = compatibilityCompared && habitatCompared;

  if (
    key === "predictGold" ||
    key === "predictViolet" ||
    key === "predictNeither"
  ) {
    compatibilityPrediction =
      key === "predictGold"
        ? "gold"
        : key === "predictViolet"
          ? "violet"
          : "neither";
    compatibilityCompared = false;
    showRoute(POLLINATOR_COMPATIBILITY_TRIAL.baseline);
  }
  if (key === "compareFlowers" && compatibilityPrediction) {
    compatibilityCompared = true;
    showRoute(POLLINATOR_COMPATIBILITY_TRIAL.comparison);
  }
  if (key === "showGold" && compatibilityCompared)
    showRoute(POLLINATOR_COMPATIBILITY_TRIAL.baseline);
  if (key === "showViolet" && compatibilityCompared)
    showRoute(POLLINATOR_COMPATIBILITY_TRIAL.comparison);

  if (
    key === "predictWithout" ||
    key === "predictWith" ||
    key === "predictBoth"
  ) {
    habitatPrediction =
      key === "predictWithout"
        ? "without"
        : key === "predictWith"
          ? "with"
          : "both";
    habitatCompared = false;
    showRoute(POLLINATOR_HABITAT_TRIAL.baseline);
  }
  if (key === "compareHabitat" && habitatPrediction) {
    habitatCompared = true;
    showRoute(POLLINATOR_HABITAT_TRIAL.comparison);
  }
  if (key === "showBlocked" && habitatCompared)
    showRoute(POLLINATOR_HABITAT_TRIAL.baseline);
  if (key === "showConnected" && habitatCompared)
    showRoute(POLLINATOR_HABITAT_TRIAL.comparison);

  if (input.type === "control" && unlocked && Number.isFinite(value)) {
    if (key === "reach") {
      reach = Math.max(80, Math.min(240, Math.round(value / 10) * 10));
      trialSpecies = "none";
      journey = initialPollinator();
    }
    if (key === "habitat") {
      habitat = value >= 0.5;
      trialSpecies = "none";
      journey = initialPollinator();
    }
  }
  if (key === "nest" && unlocked) {
    trialSpecies = "none";
    journey = initialPollinator();
  }
  if (key?.startsWith("flower_") && unlocked) visit(key.slice(7));
  if (input.type === "select" && unlocked && Number.isInteger(input.index)) {
    const flower = POLLINATOR_FLOWERS[input.index];
    if (flower) visit(flower.id);
  }

  const nowUnlocked = compatibilityCompared && habitatCompared;
  const scene3d = renderGarden(narrow);
  const pollenSource = journey.pollen?.sourceId.startsWith("trial-")
    ? POLLINATOR_COMPATIBILITY_TARGETS[journey.pollen.species].name
    : POLLINATOR_FLOWERS.find(
        (flower) => flower.id === journey.pollen?.sourceId,
      )?.name;
  const pollen = journey.pollen
    ? `${journey.pollen.species} pollen from ${pollenSource}`
    : "no pollen";
  const compatibilityText = compatibilityCompared
    ? `${compatibilityPrediction === "gold" ? "The evidence matches your prediction." : "The evidence differs from your prediction."} Gold 1 → fixed Gold trial flower: ${compatibility.baseline.visits} visits · ${compatibility.baseline.transfers} compatible transfer · ${compatibility.baseline.receivedCount} receiving flower. Gold 1 → fixed Violet trial flower: ${compatibility.comparison.visits} visits · ${compatibility.comparison.transfers} compatible transfers · ${compatibility.comparison.receivedCount} receiving flowers. Changed: trial flower species. Held: its position, start, Gold 1 first, reach 170, no extra habitat, coordinates and transfer rule.`
    : "The bee visits Gold 1 first. Reach 170, the nest, habitat and every coordinate stay fixed. Predict which second flower receives compatible pollen in this model.";
  const habitatText = habitatCompared
    ? `${habitatPrediction === "with" ? "The evidence matches your prediction." : "The evidence differs from your prediction."} Without habitat: Gold 3 blocked · ${habitatEvidence.baseline.visits} visits · ${habitatEvidence.baseline.transfers} compatible transfer. With habitat: Gold 3 reached · ${habitatEvidence.comparison.visits} visits · ${habitatEvidence.comparison.transfers} compatible transfers. Changed: one bridge habitat patch containing a Gold and a Violet flower. Held: nest, reach 170, target, planned route, coordinates and transfer rule. The fixed planned route uses the Gold bridge stop; the Violet flower is visible but not visited in this trial. This is not a population forecast.`
    : "The bee starts at the same nest and reach stays 170. The same planned route always attempts the Gold bridge stop. Predict which habitat condition reaches Gold 3 under the invented distance rule.";
  return {
    animate: false,
    shapes: [],
    scene3d,
    description:
      !compatibilityPrediction && !habitatPrediction
        ? "Choose a prediction to begin. Compare one changed condition while the named start, reach, coordinates and transfer rule stay fixed."
        : `${journey.visits} visits · ${journey.transfers} compatible transfers · ${journey.pollinated.length} receiving flowers · carrying ${pollen}. ${journey.message}`,
    controls: nowUnlocked
      ? [
          {
            id: "reach",
            label: "Flight reach (invented garden units)",
            min: 80,
            max: 240,
            step: 10,
            value: reach,
          },
          {
            id: "habitat",
            label: "Bridge habitat patch (Gold and Violet)",
            kind: "select",
            min: 0,
            max: 1,
            step: 1,
            value: habitat ? 1 : 0,
            options: [
              { value: 0, label: "Absent" },
              { value: 1, label: "Present" },
            ],
          },
        ]
      : [],
    buttons: [
      {
        id: "predictGold",
        label: "Gold trial flower",
        pressed: compatibilityPrediction === "gold",
      },
      {
        id: "predictViolet",
        label: "Violet trial flower",
        pressed: compatibilityPrediction === "violet",
      },
      {
        id: "predictNeither",
        label: "Neither flower",
        pressed: compatibilityPrediction === "neither",
      },
      {
        id: "compareFlowers",
        label: "Compare the two second flowers",
        disabled: !compatibilityPrediction,
      },
      {
        id: "showGold",
        label: "Show Gold trial evidence",
        disabled: !compatibilityCompared,
      },
      {
        id: "showViolet",
        label: "Show Violet trial evidence",
        disabled: !compatibilityCompared,
      },
      {
        id: "predictWithout",
        label: "Without habitat",
        pressed: habitatPrediction === "without",
      },
      {
        id: "predictWith",
        label: "With habitat",
        pressed: habitatPrediction === "with",
      },
      {
        id: "predictBoth",
        label: "Both routes",
        pressed: habitatPrediction === "both",
      },
      {
        id: "compareHabitat",
        label: "Compare routes with and without habitat",
        disabled: !habitatPrediction,
      },
      {
        id: "showBlocked",
        label: "Show blocked route",
        disabled: !habitatCompared,
      },
      {
        id: "showConnected",
        label: "Show connected route",
        disabled: !habitatCompared,
      },
      { id: "nest", label: "Return to nest", disabled: !nowUnlocked },
      ...POLLINATOR_FLOWERS.map((flower) => ({
        id: `flower_${flower.id}`,
        label: `Visit ${flower.name}`,
        disabled:
          !nowUnlocked || ("bridge" in flower && flower.bridge && !habitat),
      })),
    ],
    sections: [
      {
        heading: "1 · Change the second flower",
        text: compatibilityText,
        buttonIds: [
          "predictGold",
          "predictViolet",
          "predictNeither",
          "compareFlowers",
          "showGold",
          "showViolet",
        ],
      },
      {
        heading: "2 · Add a bridge habitat patch",
        text: habitatText,
        buttonIds: [
          "predictWithout",
          "predictWith",
          "predictBoth",
          "compareHabitat",
          "showBlocked",
          "showConnected",
        ],
      },
      {
        heading: "Explore one change at a time",
        text: nowUnlocked
          ? "Controls are unlocked. Return to the nest before comparing a new route. A received-pollen mark is not a seed."
          : "Complete both prediction-first comparisons to unlock reach, habitat and flower controls.",
        buttonIds: [
          "nest",
          ...POLLINATOR_FLOWERS.map((flower) => `flower_${flower.id}`),
        ],
      },
      {
        heading: "Keep the processes separate",
        text: "Pollination is pollen transfer to a flower’s receptive part. Fertilization can happen later after pollen-tube growth and the joining of sperm and egg cells. Seed dispersal moves formed seeds away from a parent plant. This lesson records only pollen transfer.",
        buttonIds: [],
      },
    ],
    footnote:
      "Every coordinate, flower placement, reach value and route is an invented deterministic teaching assumption—not an ecological measurement, probability or forecast. The bee remembers only the last flower’s pollen; real pollinators can carry mixed loads. Same displayed flower type is compatible here, while real plants vary in self-pollination and compatibility. Pollinators seek nectar or pollen; a plant may receive pollen during a visit, but a visit does not guarantee pollination, fertilization, fruit or seeds. Flowers, pollen structures and the bee are enlarged for inspection.",
  };
}
self.onmessage = ({ data }) => self.postMessage(run(data));
