const fixedCamera = <T extends { camera: object }>(s: T) => ({
  ...s,
  camera: { ...s.camera, interactive: false },
});
import { timelineDrag } from "../space-life-support/worker";
import { traceOrbit } from "./physics";
import { buildOrbitScene } from "./orbitScene";
import { serializeScene } from "../shared/serialize-scene";
import {
  context,
  range,
  button,
  install,
  background,
  clamp,
  type Input,
} from "../space-life-support/worker";
const ctx = context(),
  visual = buildOrbitScene(ctx, "assets/earth.jpg");
let speed = 1,
  mass = 1,
  progress = 0,
  playing = false,
  speedPrediction = "",
  speedTested = false,
  massPrediction = "",
  massTested = false,
  orbit = traceOrbit(1, 1);
const scrub = timelineDrag();
function run(i: Input) {
  const narrow = (i.viewportWidth ?? i.width ?? 800) <= 760;
  progress = scrub(i, progress);
  if (i.type === "reset") {
    speed = mass = 1;
    progress = 0;
    playing = false;
    speedPrediction = "";
    speedTested = false;
    massPrediction = "";
    massTested = false;
  }
  if (i.control === "speed" || i.control === "mass") {
    if (i.control === "speed") speed = i.values.speed;
    else mass = i.values.mass;
    progress = 0;
    playing = false;
  }
  if (i.control === "progress") progress = i.values.progress / 100;
  if (i.control === "play") {
    if (progress >= 0.9999) progress = 0;
    playing = !playing;
  }
  if (i.control?.startsWith("preset")) {
    speed = Number(i.control.slice(6)) / 100;
    mass = 1;
    progress = 0;
    playing = false;
  }
  if (i.control?.startsWith("predict")) {
    speedPrediction = [
      "All three orbit",
      "Hit → orbit → escape",
      "All three escape",
    ][Number(i.control.slice(7))];
    speedTested = false;
    massPrediction = "";
    massTested = false;
  }
  if (i.control === "test") {
    speed = 0.6;
    mass = 1;
    progress = 0.9999;
    playing = false;
    speedTested = Boolean(speedPrediction);
    massPrediction = "";
    massTested = false;
  }
  if (i.control?.startsWith("masspredict") && speedTested) {
    massPrediction = [
      "Curves into a tighter ellipse",
      "Stays on the same circle",
      "Escapes",
    ][Number(i.control.slice(11))];
    massTested = false;
  }
  if (i.control === "masstest" && speedTested && massPrediction) {
    speed = 1;
    mass = 2;
    progress = 0.9999;
    playing = false;
    massTested = true;
  }
  if (i.type === "step" && playing) {
    progress = clamp(progress + (i.dt ?? 0.05) / 16, 0, 0.9999);
    if (progress >= 0.9999) playing = false;
  }
  orbit = traceOrbit(speed, mass);
  const point =
      orbit.points[
        Math.min(
          orbit.points.length - 1,
          Math.floor(progress * orbit.points.length),
        )
      ],
    radius = Math.hypot(point.x, point.y),
    outcome =
      orbit.outcome === "orbit"
        ? "bound orbit"
        : orbit.outcome === "escape"
          ? "escape path"
          : "planet collision";
  visual.update({ points: orbit.points, progress });
  visual.resize((i.width ?? 800) / (i.height ?? 480));
  const xs = [0, ...orbit.points.map((p) => p.x)],
    ys = [0, ...orbit.points.map((p) => p.y)],
    target: [number, number, number] = [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      0,
      -(Math.min(...ys) + Math.max(...ys)) / 2,
    ];
  return {
    animate: playing,
    pointer: true,
    pointerMode: "drag",
    shapes: [],
    description: `${outcome}. Launch speed ${speed.toFixed(2)} times baseline; central mass ${mass.toFixed(1)} times. Distance ${radius.toFixed(2)} starting radii; gravity ${(mass / radius ** 2).toFixed(2)} times starting reference. Escape threshold ${Math.sqrt(2 * mass).toFixed(3)} times baseline speed. Gravity pulls toward the planet throughout flight; arrows show gravity and motion directions.`,
    readouts: [
      {
        label: "Escape threshold",
        value: `${Math.sqrt(2 * mass).toFixed(3)}× baseline speed`,
      },
      {
        label: "Gravity here",
        value: `${(mass / radius ** 2).toFixed(2)}× starting reference`,
      },
      {
        label: "Gravity arrow",
        value: "Toward the planet",
        detail: "Gold arrow; direction only, not force to scale.",
      },
      {
        label: "Motion arrow",
        value: "Along the path",
        detail: "Blue arrow; direction only, not speed to scale.",
      },
    ],
    controls: [
      range("speed", "Launch speed (×)", 0, 1.8, 0.02, speed),
      range("mass", "Central mass (×)", 0.5, 2, 0.1, mass),
      range("progress", "Trace position (%)", 0, 100, 1, progress * 100),
    ],
    buttons: [
      button("play", playing ? "Pause motion" : "Play motion"),
      ...[60, 100, 142].map((v) =>
        button(
          `preset${v}`,
          `${(v / 100).toFixed(2)}× speed`,
          speed === v / 100 && mass === 1,
        ),
      ),
      ...["All three orbit", "Hit → orbit → escape", "All three escape"].map(
        (v, n) => button(`predict${n}`, v, speedPrediction === v),
      ),
      button("test", "Compare 0.60×, 1.00× and 1.42×"),
      ...[
        "Curves into a tighter ellipse",
        "Stays on the same circle",
        "Escapes",
      ].map((v, n) => button(`masspredict${n}`, v, massPrediction === v)),
      button("masstest", "Compare 1× and 2× mass"),
    ],
    sections: [
      {
        heading: "1. Change only sideways speed",
        text: `Keep central mass at 1× and starting distance fixed. Predict the order at 0.60×, 1.00× and 1.42×.${speedPrediction ? " Your prediction: " + speedPrediction + "." : ""}${speedTested ? " " + (speedPrediction === "Hit → orbit → escape" ? "Your prediction matches: " : "The result differs: ") + "0.60× collision; 1.00× near-circle orbit; 1.42× escape." : ""}`,
        buttonIds: ["predict0", "predict1", "predict2", "test"],
      },
      {
        heading: "2. Change only central mass",
        text: `${speedTested ? "Keep speed at 1.00× and starting distance fixed. Predict the 2×-mass path." : "Complete the speed comparison first."}${massPrediction ? " Your prediction: " + massPrediction + "." : ""}${massTested ? " " + (massPrediction === "Curves into a tighter ellipse" ? "Your prediction matches: " : "The result differs: ") + "The displayed 1×-mass trace spans 1.00–1.00 starting radii; the displayed 2×-mass trace spans 0.33–1.00 starting radii." : ""}`,
        buttonIds: ["masspredict0", "masspredict1", "masspredict2", "masstest"],
      },
      {
        heading: "Explain the evidence",
        text: "Sideways motion carries the probe forward while gravity curves its path inward. Escape means the path does not return in this two-body model; gravity still acts along it. Doubling central mass raises circular speed from 1.00× to 1.41×, so the unchanged 1.00× launch curves inward more strongly.",
      },
    ],
    footnote:
      "Dimensionless fixed-step two-body model. Starting distance and baseline gravitational parameter are 1; planet radius is 0.22. It omits air, other bodies, burns and the probe’s pull on the planet. A finite trace labeled escape is not proof that gravity becomes zero. Probe enlarged; arrows show direction, not force or speed to scale. Earth surface: NASA Earth Observatory Blue Marble, August 2004.",
    scene3d: fixedCamera(
      serializeScene(ctx.scene, ctx.camera, {
        target,
        presentation: {
          layout: {
            height: narrow ? 535 : 565,
            canvasInset: narrow ? [135, 8, 80, 8] : [85, 20, 45, 20],
          },
          stat: {
            value: radius.toFixed(2),
            label: "distance in starting radii",
          },
          gestureHint:
            "Drag horizontally to follow the flight path. Keyboard: use Trace position below.",
          toneMapping: "aces",
          exposure: 1.15,
          title: outcome,
          subtitle: "Gravity pulls toward the planet throughout the flight.",
          background,
        },
      }),
    ),
  };
}
install(run);
