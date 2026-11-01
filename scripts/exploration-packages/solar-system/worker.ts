const fixedCamera = <T extends { camera: object }>(scene: T) => ({
  ...scene,
  camera: { ...scene.camera, interactive: false },
});

import { timelineDrag } from "../space-life-support/worker";
import { PLANETS } from "./spaceModels";
import { buildSolarScene } from "./solarScene";
import { serializeScene } from "../shared/serialize-scene";
import {
  context,
  range,
  select,
  button,
  install,
  background,
  type Input,
} from "../space-life-support/worker";

type OrbitPrediction = "" | "Earth" | "Neptune" | "Same fraction";
type DiameterPrediction = "" | "5" | "11" | "50";

const ctx = context();
const visual = buildSolarScene(ctx, "assets/earth.jpg");
const scrub = timelineDrag();

let selected = 2;
let speed = 1;
let mode = 0;
let cameraMode = 0;
let progress = 0;
let playing = false;
let orbitPrediction: OrbitPrediction = "";
let orbitComplete = false;
let diameterPrediction: DiameterPrediction = "";
let diameterComplete = false;

function resetLesson() {
  selected = 2;
  speed = 1;
  mode = 0;
  cameraMode = 0;
  progress = 0;
  playing = false;
  orbitPrediction = "";
  orbitComplete = false;
  diameterPrediction = "";
  diameterComplete = false;
}

function run(input: Input) {
  const narrow = (input.viewportWidth ?? input.width ?? 800) <= 760;
  progress = scrub(input, progress);

  if (input.type === "reset") resetLesson();
  if (input.control === "selected") selected = input.values.selected;
  if (input.control === "speed") speed = input.values.speed;
  if (input.control === "mode") mode = input.values.mode;
  if (input.control === "camera") cameraMode = input.values.camera;
  if (input.control === "progress") progress = input.values.progress / 100;
  if (input.control === "play") playing = !playing;
  if (input.control?.startsWith("planet")) {
    selected = Number(input.control.slice(6));
  }
  if (input.control === "orbitEarth") {
    orbitPrediction = "Earth";
    orbitComplete = false;
    diameterPrediction = "";
    diameterComplete = false;
  }
  if (input.control === "orbitNeptune") {
    orbitPrediction = "Neptune";
    orbitComplete = false;
    diameterPrediction = "";
    diameterComplete = false;
  }
  if (input.control === "orbitSame") {
    orbitPrediction = "Same fraction";
    orbitComplete = false;
    diameterPrediction = "";
    diameterComplete = false;
  }
  if (input.control === "compareOrbit" && orbitPrediction) {
    selected = 7;
    mode = 0;
    cameraMode = 1;
    progress = 0.1;
    playing = false;
    orbitComplete = true;
    diameterPrediction = "";
    diameterComplete = false;
  }
  if (input.control === "diameter5" && orbitComplete) {
    diameterPrediction = "5";
    diameterComplete = false;
  }
  if (input.control === "diameter11" && orbitComplete) {
    diameterPrediction = "11";
    diameterComplete = false;
  }
  if (input.control === "diameter50" && orbitComplete) {
    diameterPrediction = "50";
    diameterComplete = false;
  }
  if (
    input.control === "compareDiameter" &&
    orbitComplete &&
    diameterPrediction
  ) {
    selected = 4;
    mode = 1;
    cameraMode = 0;
    playing = false;
    diameterComplete = true;
  }
  if (input.type === "step" && playing) {
    progress = (progress + (input.dt ?? 0.05) / (60 / speed)) % 1;
  }

  const planet = PLANETS[selected];
  const earthYears = progress * 10;
  const diameterEarths = planet.diameter / PLANETS[2].diameter;
  const camera = ["Close", "Overview", "Follow"][cameraMode];
  const orbitFeedback = !orbitPrediction
    ? "Predict first, then compare one Earth year."
    : orbitComplete
      ? `The result ${orbitPrediction === "Earth" ? "matches" : "differs from"} your prediction. Earth completes 1.000 orbit; Neptune completes 0.006 orbit (about 1/165). Equal elapsed time does not mean equal orbit fractions.`
      : `Your prediction: ${orbitPrediction}. Compare one Earth year to reveal the measured-period result.`;
  const diameterFeedback = !orbitComplete
    ? "Complete the orbit comparison first."
    : !diameterPrediction
      ? "Predict whether Jupiter is about 5, 11 or 50 Earth diameters across."
      : diameterComplete
        ? `The result ${diameterPrediction === "11" ? "matches" : "differs from"} your prediction. Earth is 12,756 km across; Jupiter is 142,984 km, or 11.21 Earth diameters. Both globes use one linear diameter scale.`
        : `Your prediction: about ${diameterPrediction} Earth diameters. Compare Earth and Jupiter to reveal the result.`;

  visual.resize((input.width ?? 800) / (input.height ?? 480));
  visual.update({
    selected,
    earthYears,
    mode: mode ? "sizes" : "orbits",
    cameraMode: ["close", "overview", "follow"][cameraMode],
  });

  return {
    animate: playing,
    pointer: true,
    pointerMode: "drag",
    shapes: [],
    description: `${mode ? "One-scale diameter comparison" : `${camera} orbit view`}. ${planet.name}, ${planet.kind}, planet ${selected + 1} from the Sun. Mean distance ${planet.distance} AU; orbital period ${planet.year} Earth years; equatorial diameter ${planet.diameter.toLocaleString("en-US")} km, ${diameterEarths.toFixed(2)} Earth diameters. Elapsed ${earthYears.toFixed(2)} Earth years. ${mode ? "Earth and the selected planet share one linear diameter scale and baseline; the Sun and orbit gaps are omitted." : camera === "Close" ? "An enlarged planet close-up is shown separately from the Sun-centered inset with compressed orbit gaps." : "Orbit gaps are compressed from unequal mean distances, planets are enlarged, and circular starting positions are illustrative."}`,
    readouts: [
      { label: "Mean distance", value: `${planet.distance} AU` },
      { label: "Orbital period", value: `${planet.year} Earth years` },
      { label: "Elapsed time", value: `${earthYears.toFixed(2)} Earth years` },
      ...(mode
        ? [
            { label: "Earth diameter", value: "12,756 km" },
            {
              label: `${planet.name} diameter`,
              value: `${planet.diameter.toLocaleString("en-US")} km`,
            },
          ]
        : []),
    ],
    controls: [
      select(
        "selected",
        "Choose a planet",
        selected,
        PLANETS.map((option) => option.name),
      ),
      select("mode", "Comparison view", mode, [
        "Sun-centered orbits",
        "Same-scale diameters",
      ]),
      select("camera", "Camera", cameraMode, ["Close", "Overview", "Follow"]),
      range("speed", "Time speed (×)", 1, 10, 1, speed),
      range(
        "progress",
        "Model time (%)",
        0,
        100,
        1,
        Math.min(100, progress * 100),
      ),
    ],
    buttons: [
      ...PLANETS.map((option, index) =>
        button(
          `planet${index}`,
          `${option.name} ${index + 1}`,
          selected === index,
        ),
      ),
      button("play", playing ? "Pause motion" : "Play motion"),
      button("orbitEarth", "Earth", orbitPrediction === "Earth"),
      button("orbitNeptune", "Neptune", orbitPrediction === "Neptune"),
      button("orbitSame", "Same fraction", orbitPrediction === "Same fraction"),
      ...(orbitPrediction
        ? [button("compareOrbit", "Compare one Earth year", orbitComplete)]
        : []),
      ...(orbitComplete
        ? [
            button("diameter5", "About 5×", diameterPrediction === "5"),
            button("diameter11", "About 11×", diameterPrediction === "11"),
            button("diameter50", "About 50×", diameterPrediction === "50"),
          ]
        : []),
      ...(diameterPrediction
        ? [
            button(
              "compareDiameter",
              "Compare Earth and Jupiter",
              diameterComplete,
            ),
          ]
        : []),
    ],
    sections: [
      {
        heading: "1. Hold elapsed time fixed",
        text: orbitFeedback,
        buttonIds: [
          "orbitEarth",
          "orbitNeptune",
          "orbitSame",
          ...(orbitPrediction ? ["compareOrbit"] : []),
        ],
      },
      {
        heading: "2. Hold one diameter scale",
        text: diameterFeedback,
        buttonIds: orbitComplete
          ? [
              "diameter5",
              "diameter11",
              "diameter50",
              ...(diameterPrediction ? ["compareDiameter"] : []),
            ]
          : [],
      },
      {
        heading: "Explain the evidence",
        text: "Planetary years are complete orbits, so different measured periods produce different fractions in the same elapsed time. A close camera frames each planet separately; only the diameter bay establishes the Earth–Jupiter size ratio.",
      },
    ],
    footnote:
      "1 AU is about Earth’s mean distance from the Sun. NASA rounded mean-distance, period and equatorial-diameter values. Orbit views compress gaps and enlarge planets; circular coplanar paths and starting positions are illustrative, not today’s sky. Close uses an enlarged planet close-up beside a Sun-centered inset with compressed orbit gaps. Diameter comparison uses one linear planet scale and baseline and excludes Saturn’s rings. Non-Earth globe textures are illustrations, including gas and ice giant banding. Sources: NASA Planetary Fact Sheet, NASA Cosmic Distances and NASA/JPL Make a Scale Solar System.",
    scene3d: fixedCamera(
      serializeScene(ctx.scene, ctx.camera, {
        target: [0, 0, 0],
        presentation: {
          layout: {
            height: narrow ? (mode ? 510 : 720) : 600,
            canvasInset: narrow
              ? mode
                ? [112, 8, 58, 8]
                : [122, 5, 46, 5]
              : [86, 12, 42, 12],
          },
          stat: {
            value: mode
              ? `${diameterEarths.toFixed(2)}×`
              : `${planet.distance} AU`,
            label: mode ? "Earth diameters" : "mean distance",
          },
          gestureHint:
            "Drag horizontally to change the ten-year timeline. Keyboard users can use Model time.",
          toneMapping: "aces",
          exposure: 1.18,
          title: planet.name,
          subtitle: mode
            ? "Earth and selected planet use one diameter scale and baseline."
            : camera === "Close"
              ? "Enlarged globe · Sun-centered inset."
              : `${camera} camera · eight compressed orbit paths.`,
          background,
        },
      }),
    ),
  };
}

install(run);
