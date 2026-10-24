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
  prediction = "",
  tested = false,
  orbit = traceOrbit(1, 1);
const scrub = timelineDrag();
function run(i: Input) {
  const narrow = (i.viewportWidth ?? i.width ?? 800) <= 760;
  progress = scrub(i, progress);
  if (i.type === "reset") {
    speed = mass = 1;
    progress = 0;
    playing = false;
    prediction = "";
    tested = false;
  }
  if (i.control === "speed" || i.control === "mass") {
    if (i.control === "speed") speed = i.values.speed;
    else mass = i.values.mass;
    progress = 0;
    playing = false;
    tested = false;
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
    tested = false;
  }
  if (i.control?.startsWith("predict")) {
    prediction = ["Returns safely", "Hits planet", "Escapes"][
      Number(i.control.slice(7))
    ];
    tested = false;
  }
  if (i.control === "test") {
    speed = 0.6;
    mass = 1;
    progress = 0.9999;
    playing = false;
    tested = true;
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
      ...["Returns safely", "Hits planet", "Escapes"].map((v, n) =>
        button(`predict${n}`, v, prediction === v),
      ),
      button("test", "Test 0.60× speed"),
    ],
    sections: [
      {
        heading: "1. Predict",
        text: `At 0.60× baseline speed, what happens?${prediction ? " Your prediction: " + prediction + "." : ""}`,
        buttonIds: ["predict0", "predict1", "predict2"],
      },
      {
        heading: "2. Compare",
        text: `Keep central mass at 1× and reduce only launch speed.${tested ? " " + (prediction === "Hits planet" ? "Your prediction matches: " : "Observed: ") + "the path reaches the planet." : ""}`,
        buttonIds: ["test"],
      },
      {
        heading: "3. Explain",
        text: "Sideways motion carries the probe forward while gravity curves its path inward. At this lower speed, it reaches the surface before it can go around. Predict what 1.42× will do, then test it while keeping mass at 1×. Why does a faster launch escape even though gravity still acts?",
        buttonIds: ["preset142"],
      },
    ],
    footnote:
      "Fixed-step two-body model, no air resistance. Planet radius is 0.22 starting radii; probe enlarged. Camera fits the whole trajectory. Speed remains relative to the original planet’s circular speed when mass changes. Arrows show direction, not force or speed to scale. Earth surface: NASA Earth Observatory Blue Marble, August 2004.",
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
