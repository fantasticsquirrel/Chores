const fixedCamera = <T extends { camera: object }>(s: T) => ({
  ...s,
  camera: { ...s.camera, interactive: false },
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
const ctx = context(),
  visual = buildGravityScene(ctx);
let height = 20,
  mass = 5,
  world = 0,
  progress = 0,
  playing = false,
  prediction = "",
  tested = false;
const scrub = timelineDrag();
function run(i: Input) {
  const narrow = (i.viewportWidth ?? i.width ?? 800) <= 760;
  progress = scrub(i, progress);
  if (i.type === "reset") {
    height = 20;
    mass = 5;
    world = 0;
    progress = 0;
    playing = false;
    prediction = "";
    tested = false;
  }
  if (i.control === "height" || i.control === "world") {
    if (i.control === "height") height = i.values.height;
    else world = i.values.world;
    progress = 0;
    playing = false;
    tested = false;
  }
  if (i.control === "mass") {
    mass = i.values.mass;
    tested = false;
  }
  if (i.control === "progress") progress = i.values.progress / 100;
  if (i.control === "play") {
    if (progress >= 0.9999) progress = 0;
    playing = !playing;
  }
  if (i.control?.startsWith("predict")) {
    prediction = ["1 kg object", "10 kg object", "Same time"][
      Number(i.control.slice(7))
    ];
    tested = false;
  }
  if (i.control === "test") {
    world = 0;
    mass = 10;
    progress = 0.9999;
    playing = false;
    tested = true;
  }
  const chosen = WORLDS[world],
    result = gravityDrop(height, chosen.g),
    earth = gravityDrop(height, 9.81),
    duration = Math.max(result.time, earth.time) + 1;
  if (i.type === "step" && playing) {
    progress = clamp(progress + (i.dt ?? 0.05) / duration, 0, 0.9999);
    if (progress >= 0.9999) playing = false;
  }
  const elapsed = progress * duration,
    ref = fallAtTime(height, 9.81, elapsed),
    comparison = fallAtTime(height, chosen.g, elapsed);
  visual.resize((i.width ?? 800) / (i.height ?? 480));
  visual.update({ height, gravity: chosen.g, elapsed, mass });
  return {
    animate: playing,
    pointer: true,
    pointerMode: "drag",
    shapes: [],
    description: `${height} m drop, elapsed ${elapsed.toFixed(2)} s. Earth reference 1 kg, gravity 9.81 m/s², fall time ${earth.time.toFixed(2)} s, ${ref.landed ? "landed" : (height - ref.distance).toFixed(1) + " m above floor"}. ${chosen.name} comparison ${mass} kg, gravity ${chosen.g} m/s², fall time ${result.time.toFixed(2)} s, ${comparison.landed ? "landed" : (height - comparison.distance).toFixed(1) + " m above floor"}. Impact speed ${result.speed.toFixed(1)} m/s. Comparison weight ${(mass * chosen.g).toFixed(1)} N.`,
    readoutColumns: 2,
    readouts: [
      {
        label: "Earth reference · 1 kg",
        value: "9.81 m/s²",
        detail: `${ref.landed ? "Landed" : (height - ref.distance).toFixed(1) + " m above floor"} · ${earth.time.toFixed(2)} s fall`,
      },
      {
        label: `${chosen.name} comparison · ${mass} kg`,
        value: `${chosen.g} m/s²`,
        detail: `${comparison.landed ? "Landed" : (height - comparison.distance).toFixed(1) + " m above floor"} · ${result.time.toFixed(2)} s fall`,
      },
      {
        label: "Comparison impact speed",
        value: `${result.speed.toFixed(1)} m/s`,
      },
      {
        label: "Comparison weight",
        value: `${(mass * chosen.g).toFixed(1)} N`,
      },
    ],
    controls: [
      select(
        "world",
        "Comparison world",
        world,
        WORLDS.map((w) => w.name),
      ),
      range("height", "Drop height (m)", 5, 50, 1, height),
      range("mass", "Comparison object mass (kg)", 1, 20, 1, mass),
      range("progress", "Timeline (%)", 0, 100, 1, progress * 100),
    ],
    buttons: [
      button("play", playing ? "Pause motion" : "Play motion"),
      ...["1 kg object", "10 kg object", "Same time"].map((v, n) =>
        button(`predict${n}`, v, prediction === v),
      ),
      button("test", "Compare 1 kg with 10 kg"),
    ],
    sections: [
      {
        heading: "1. Predict",
        text: `On Earth, which object reaches the floor first?${prediction ? " Your prediction: " + prediction + "." : ""}`,
        buttonIds: ["predict0", "predict1", "predict2"],
      },
      {
        heading: "2. Compare",
        text: `Use the same height and gravity. Change only mass.${tested ? ` Both land after ${earth.time.toFixed(2)} s. The 10 kg object has ten times the weight, but the same acceleration.` : ""}`,
        buttonIds: ["test"],
      },
      {
        heading: "3. Explain",
        text: "Gravity pulls harder on more mass, but more mass takes more force to accelerate. Without air resistance, these effects balance: both objects fall together. Predict whether the same drop takes longer on the Moon. Select Moon, reset the timeline to zero, play and compare at the same elapsed time.",
      },
    ],
    footnote:
      "Mass is amount of matter; weight is gravitational force. Earth reference weighs 9.81 N. Equal illustrated size does not imply that mass determines size. Uniform gravity and no air resistance. Towers rescale to chosen height. Jupiter gravity refers to cloud-top region, not a solid surface.",
    scene3d: fixedCamera(
      serializeScene(ctx.scene, ctx.camera, {
        target: [0, 2.4, 0],
        presentation: {
          layout: {
            height: narrow ? 540 : 620,
            canvasInset: narrow ? [135, 0, 38, 0] : [100, 12, 30, 12],
          },
          stat: { value: `${elapsed.toFixed(2)} s`, label: "elapsed time" },
          gestureHint:
            "Drag horizontally to advance or rewind the drop. Keyboard: use Timeline below.",
          toneMapping: "aces",
          exposure: 1.3,
          title: `${height} m drop`,
          subtitle: "Released together from rest. No air resistance.",
          background: ["#2d3c40", "#121f29", "#0b151f"],
        },
      }),
    ),
  };
}
install(run);
