const fixedCamera = <T extends { camera: object }>(scene: T) => ({
  ...scene,
  camera: { ...scene.camera, interactive: false },
});
import { timelineDrag } from "../space-life-support/worker";
import { gravityDrop } from "./physics";
import { WORLDS, fallAtTime } from "./spaceModels";
import { buildGravityScene } from "./gravityScene";
import { serializeScene } from "../shared/serialize-scene";
import {
  context,
  range,
  select,
  button,
  install,
  clamp,
  type Input,
} from "../space-life-support/worker";

type Comparison = "mass" | "world" | "open";
type Inputs = { height: number; mass: number; gravity: number };
type Trial = { label: string; inputs: Inputs };

const ctx = context();
const visual = buildGravityScene(ctx);
const massTrials: [Trial, Trial] = [
  { label: "Earth · 1 kg", inputs: { height: 20, mass: 1, gravity: 9.81 } },
  { label: "Earth · 10 kg", inputs: { height: 20, mass: 10, gravity: 9.81 } },
];
const worldTrials: [Trial, Trial] = [
  { label: "Earth · 5 kg", inputs: { height: 20, mass: 5, gravity: 9.81 } },
  { label: "Moon · 5 kg", inputs: { height: 20, mass: 5, gravity: 1.62 } },
];

let height = 20;
let mass = 5;
let world = 0;
let comparison: Comparison = "mass";
let progress = 0;
let playing = false;
let massPrediction = "";
let massComplete = false;
let worldPrediction = "";
let worldComplete = false;
const scrub = timelineDrag();

function resultFor(inputs: Inputs) {
  return gravityDrop(inputs.height, inputs.gravity);
}

function trials(): [Trial, Trial] {
  if (comparison === "mass") return massTrials;
  if (comparison === "world") return worldTrials;
  const selected = WORLDS[world];
  return [
    { label: "Earth · 1 kg", inputs: { height, mass: 1, gravity: 9.81 } },
    {
      label: `${selected.name} · ${mass} kg`,
      inputs: { height, mass, gravity: selected.g },
    },
  ];
}

function durationFor(pair: [Trial, Trial]) {
  return Math.max(...pair.map((trial) => resultFor(trial.inputs).time)) + 0.55;
}

function showEvidence(next: "mass" | "world") {
  const pair = next === "mass" ? massTrials : worldTrials;
  comparison = next;
  progress = resultFor(pair[0].inputs).time / durationFor(pair);
  playing = false;
}

function reset() {
  height = 20;
  mass = 5;
  world = 0;
  comparison = "mass";
  progress = 0;
  playing = false;
  massPrediction = "";
  massComplete = false;
  worldPrediction = "";
  worldComplete = false;
}

function run(input: Input) {
  const narrow = (input.viewportWidth ?? input.width ?? 800) <= 760;
  progress = scrub(input, progress);
  if (input.type === "reset") reset();

  if (input.control === "height") {
    height = input.values.height;
    comparison = "open";
    progress = 0;
    playing = false;
  }
  if (input.control === "mass") {
    mass = input.values.mass;
    comparison = "open";
    progress = 0;
    playing = false;
  }
  if (input.control === "world") {
    world = input.values.world;
    comparison = "open";
    progress = 0;
    playing = false;
  }
  if (input.control === "progress")
    progress = clamp(input.values.progress / 100, 0, 0.9999);
  if (input.control === "play") {
    if (progress >= 0.9999) progress = 0;
    playing = !playing;
  }
  if (input.control === "restart") {
    progress = 0;
    playing = false;
  }

  if (["massLight", "massHeavy", "massSame"].includes(input.control ?? "")) {
    massPrediction =
      input.control === "massLight"
        ? "1 kg lands first"
        : input.control === "massHeavy"
          ? "10 kg lands first"
          : "same landing time";
    massComplete = false;
    worldPrediction = "";
    worldComplete = false;
    comparison = "mass";
    progress = 0;
  }
  if (input.control === "compareMass" && massPrediction) {
    massComplete = true;
    showEvidence("mass");
  }
  if (
    massComplete &&
    ["worldEarthLonger", "worldMoonLonger", "worldSame"].includes(
      input.control ?? "",
    )
  ) {
    worldPrediction =
      input.control === "worldEarthLonger"
        ? "Earth takes longer"
        : input.control === "worldMoonLonger"
          ? "Moon takes longer"
          : "same landing time";
    worldComplete = false;
    comparison = "world";
    progress = 0;
  }
  if (input.control === "compareWorld" && massComplete && worldPrediction) {
    worldComplete = true;
    showEvidence("world");
  }
  if (input.control === "showMass" && massComplete) showEvidence("mass");
  if (input.control === "showWorld" && worldComplete) showEvidence("world");

  const pair = trials();
  const results = pair.map((trial) => resultFor(trial.inputs));
  const duration = durationFor(pair);
  if (input.type === "step" && playing) {
    progress = clamp(progress + (input.dt ?? 0.05) / duration, 0, 0.9999);
    if (progress >= 0.9999) playing = false;
  }
  const elapsed = progress * duration;
  const positions = pair.map((trial) =>
    fallAtTime(trial.inputs.height, trial.inputs.gravity, elapsed),
  );
  visual.resize((input.width ?? 800) / (input.height ?? 480));
  visual.update({
    height: pair[1].inputs.height,
    gravity: pair[1].inputs.gravity,
    elapsed,
    mass: pair[1].inputs.mass,
    referenceGravity: pair[0].inputs.gravity,
    referenceMass: pair[0].inputs.mass,
    referenceDistance: positions[0].distance,
    comparisonDistance: positions[1].distance,
  });

  const massMatch = massPrediction === "same landing time";
  const worldMatch = worldPrediction === "Moon takes longer";
  return {
    animate: playing,
    pointer: true,
    pointerMode: "drag",
    shapes: [],
    description: `${comparison === "mass" ? "Mass comparison" : comparison === "world" ? "Earth–Moon comparison" : "Open comparison"}, elapsed ${elapsed.toFixed(2)} s. ${pair
      .map((trial, index) => {
        const result = results[index];
        const position = positions[index];
        return `${trial.label}, gravity ${trial.inputs.gravity.toFixed(2)} m/s², fall time ${result.time.toFixed(2)} s, ${position.landed ? "at the ideal floor" : `${(trial.inputs.height - position.distance).toFixed(1)} m above the floor`}, weight ${(trial.inputs.mass * trial.inputs.gravity).toFixed(1)} N`;
      })
      .join(". ")}. Equal drawn sizes do not encode mass.`,
    readoutColumns: 2,
    readouts: pair.flatMap((trial, index) => [
      {
        label: trial.label,
        value: `${trial.inputs.gravity.toFixed(2)} m/s²`,
        detail: `${positions[index].landed ? "At the ideal floor" : `${(trial.inputs.height - positions[index].distance).toFixed(1)} m above floor`} · ${results[index].time.toFixed(2)} s fall`,
      },
      {
        label: `${trial.label} weight`,
        value: `${(trial.inputs.mass * trial.inputs.gravity).toFixed(1)} N`,
      },
    ]),
    controls: [
      select(
        "world",
        "Comparison world",
        world,
        WORLDS.slice(0, 3).map((item) => item.name),
      ),
      range("height", "Drop height (m)", 5, 50, 1, height),
      range("mass", "Comparison object mass (kg)", 1, 20, 1, mass),
      range("progress", "Drop timeline (%)", 0, 100, 1, progress * 100),
    ],
    buttons: [
      button("play", playing ? "Pause motion" : "Play motion"),
      button("restart", "Restart drop"),
      button(
        "massLight",
        "1 kg lands first",
        massPrediction === "1 kg lands first",
      ),
      button(
        "massHeavy",
        "10 kg lands first",
        massPrediction === "10 kg lands first",
      ),
      button(
        "massSame",
        "Same landing time",
        massPrediction === "same landing time",
      ),
      ...(massPrediction
        ? [button("compareMass", "Compare 1 kg and 10 kg")]
        : []),
      ...(massComplete
        ? [
            button(
              "worldEarthLonger",
              "Earth takes longer",
              worldPrediction === "Earth takes longer",
            ),
            button(
              "worldMoonLonger",
              "Moon takes longer",
              worldPrediction === "Moon takes longer",
            ),
            button(
              "worldSame",
              "Same landing time",
              worldPrediction === "same landing time",
            ),
            ...(worldPrediction
              ? [button("compareWorld", "Compare Earth and Moon")]
              : []),
            button("showMass", "Show mass evidence"),
            ...(worldComplete
              ? [button("showWorld", "Show world evidence")]
              : []),
          ]
        : []),
    ],
    sections: [
      {
        heading: "1. Change only mass",
        text: massComplete
          ? `Both Earth objects accelerate at 9.81 m/s² and land in 2.02 s. The 1 kg object weighs 9.81 N; the 10 kg object weighs 98.1 N. The result ${massMatch ? "matches" : "differs from"} your prediction. Extra gravitational force and extra inertia scale together, so mass does not change vacuum acceleration. Explain why weight changes while fall time does not.`
          : massPrediction
            ? `Keep Earth gravity and the 20 m release height fixed. Your prediction: ${massPrediction}.`
            : "Keep Earth gravity and the 20 m release height fixed. Predict first, then run the comparison.",
        buttonIds: [
          "massLight",
          "massHeavy",
          "massSame",
          ...(massPrediction ? ["compareMass"] : []),
        ],
      },
      {
        heading: "2. Change only local gravity",
        text: worldComplete
          ? `Earth: 2.02 s and 49.1 N. Moon: 4.97 s and 8.1 N. The result ${worldMatch ? "matches" : "differs from"} your prediction. The unchanged 5 kg mass accelerates more slowly under weaker local gravity. Explain which held value rules out mass as the cause.`
          : massComplete
            ? worldPrediction
              ? `Keep mass at 5 kg and height at 20 m. Your prediction: ${worldPrediction}.`
              : "Keep mass at 5 kg and height at 20 m. Predict first, then compare Earth and Moon."
            : "Complete the mass comparison first.",
        buttonIds: massComplete
          ? [
              "worldEarthLonger",
              "worldMoonLonger",
              "worldSame",
              ...(worldPrediction ? ["compareWorld"] : []),
              "showMass",
              ...(worldComplete ? ["showWorld"] : []),
            ]
          : [],
      },
    ],
    footnote:
      "Mass is amount of matter; weight is gravitational force. One-dimensional release from rest; constant local gravity over a short height; no air, wind, buoyancy, rotation or terrain; ideal floor. Towers rescale distance, and equal ball size does not encode mass. Jupiter is excluded because it has no true solid surface for this floor-drop model.",
    scene3d: fixedCamera(
      serializeScene(ctx.scene, ctx.camera, {
        target: [0, 2.4, 0],
        presentation: {
          layout: {
            height: narrow ? 500 : 600,
            canvasInset: narrow ? [125, 0, 42, 0] : [108, 18, 31, 18],
          },
          stat: { value: `${elapsed.toFixed(2)} s`, label: "elapsed time" },
          gestureHint:
            "Drag to compare equal elapsed time. Keyboard: use Drop timeline below.",
          toneMapping: "aces",
          exposure: 1.45,
          title:
            comparison === "mass"
              ? "Mass comparison"
              : comparison === "world"
                ? "Earth–Moon comparison"
                : "Open comparison",
          subtitle: "Released together from rest in the model.",
          background: ["#173843", "#102a32", "#07141d"],
        },
      }),
    ),
  };
}

install(run);
