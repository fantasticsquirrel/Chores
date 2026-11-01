const fixedCamera = <T extends { camera: object }>(scene: T) => ({
  ...scene,
  camera: { ...scene.camera, interactive: false },
});
import { moonInset } from "./inset";
import * as THREE from "three";
import { illuminatedFraction } from "./physics";
import { serializeScene } from "../shared/serialize-scene";
import {
  range,
  button,
  install,
  packageTexture,
  type Input,
} from "../space-life-support/worker";

const SYNODIC_DAYS = 29.53059;
const SIDEREAL_DAYS = 27.32166;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
camera.position.set(0, 0, 5.2);
const color = packageTexture("assets/lroc-color-2k.jpg", 2048, 1024);
const bump = packageTexture("assets/lola-elevation-1k.jpg", 1024, 512);
bump.colorSpace = THREE.NoColorSpace;
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(1.42, 128, 96),
  new THREE.MeshStandardMaterial({
    map: color,
    bumpMap: bump,
    bumpScale: 0.032,
    roughness: 0.98,
    metalness: 0,
  }),
);
moon.rotation.y = -Math.PI / 2;
scene.add(moon);
const sunlight = new THREE.DirectionalLight(0xfff4dc, 4.8);
scene.add(
  sunlight,
  new THREE.DirectionalLight(0x6c90b8, 0.055),
  new THREE.AmbientLight(0x7590a5, 0.012),
);

const stars: THREE.Points[] = [];
for (let bucket = 0; bucket < 10; bucket++) {
  const points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: 0xdcebf2,
      size: bucket >= 5 ? 2 : 1,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.18 + (bucket % 5) * 0.13,
      depthWrite: false,
    }),
  );
  points.userData.indices = Array.from(
    { length: 65 },
    (_, index) => index,
  ).filter((index) => (index % 5) + (index % 7 === 0 ? 5 : 0) === bucket);
  scene.add(points);
  stars.push(points);
}

function resizeStars(aspect: number) {
  const half = Math.tan((32 * Math.PI) / 360) * 7.4;
  for (const cloud of stars) {
    const indices = cloud.userData.indices as number[];
    cloud.geometry.setFromPoints(
      indices.map(
        (index) =>
          new THREE.Vector3(
            (((index * 73 + 11) % 100) / 50 - 1) * half * aspect,
            (1 - ((index * 41 + 7) % 100) / 50) * half,
            -2,
          ),
      ),
    );
  }
}

type QuarterPrediction = 25 | 50 | 75 | null;
type OppositePrediction = "first" | "last" | "same" | null;
const INITIAL_ANGLE = 45;
let angle = INITIAL_ANGLE;
let playing = false;
let view: "earth" | "orbit" = "earth";
let quarterPrediction: QuarterPrediction = null;
let quarterComplete = false;
let oppositePrediction: OppositePrediction = null;
let oppositeComplete = false;

export function phaseName(value: number) {
  const normalized = value % 360;
  if (normalized < 10 || normalized > 350) return "New Moon";
  if (normalized < 80) return "Waxing crescent";
  if (normalized < 100) return "First quarter";
  if (normalized < 170) return "Waxing gibbous";
  if (normalized < 190) return "Full Moon";
  if (normalized < 260) return "Waning gibbous";
  if (normalized < 280) return "Last quarter";
  return "Waning crescent";
}

let dragStart: { x: number; angle: number } | null = null;
function run(input: Input) {
  const narrow = (input.viewportWidth ?? input.width ?? 800) <= 760;
  if (
    input.type === "pointer" &&
    input.pointer &&
    view === "earth" &&
    oppositeComplete
  ) {
    const pointer = input.pointer;
    if (pointer.phase === "down") dragStart = { x: pointer.x, angle };
    if (dragStart)
      angle =
        (dragStart.angle +
          (pointer.x - dragStart.x) * (input.width ?? 800) * 0.65 +
          720) %
        360;
    if (pointer.phase === "up") dragStart = null;
  }
  if (input.type === "reset") {
    angle = INITIAL_ANGLE;
    playing = false;
    view = "earth";
    quarterPrediction = null;
    quarterComplete = false;
    oppositePrediction = null;
    oppositeComplete = false;
  }
  if (input.control === "angle" && oppositeComplete) angle = input.values.angle;
  if (input.control === "play" && oppositeComplete) playing = !playing;
  if (input.control === "viewEarth") view = "earth";
  if (input.control === "viewOrbit") view = "orbit";
  if (input.control?.startsWith("preset") && oppositeComplete)
    angle = Number(input.control.slice(6));
  if (input.control?.startsWith("quarter")) {
    quarterPrediction = Number(input.control.slice(7)) as QuarterPrediction;
    quarterComplete = false;
    oppositePrediction = null;
    oppositeComplete = false;
  }
  if (input.control === "runQuarter" && quarterPrediction !== null) {
    quarterComplete = true;
    angle = 90;
    view = "earth";
    playing = false;
  }
  if (input.control?.startsWith("opposite")) {
    oppositePrediction = input.control
      .slice(8)
      .toLowerCase() as OppositePrediction;
    oppositeComplete = false;
  }
  if (
    input.control === "runOpposite" &&
    quarterComplete &&
    oppositePrediction !== null
  ) {
    oppositeComplete = true;
    angle = 270;
    view = "earth";
    playing = false;
  }
  if (input.type === "step" && playing)
    angle = (angle + ((input.dt ?? 0.05) / SYNODIC_DAYS) * 360) % 360;

  const radians = (angle * Math.PI) / 180;
  const fraction = illuminatedFraction(angle);
  sunlight.position.set(Math.sin(radians) * 8, 0.3, -Math.cos(radians) * 8);
  camera.aspect = (input.width ?? 800) / (input.height ?? 480);
  camera.updateProjectionMatrix();
  resizeStars(camera.aspect);

  const quarterText =
    quarterPrediction === null
      ? "Predict first, then compare at 90°."
      : quarterComplete
        ? `The result ${quarterPrediction === 50 ? "matches" : "differs from"} your prediction. At 90°, the Earth-view disk is 50% lit. Orbital position changed; Sun direction, Earth viewpoint and the sunlit half stayed fixed.`
        : `Your prediction: ${quarterPrediction}%. Observe first quarter to reveal evidence.`;
  const oppositeText = !quarterComplete
    ? "Complete the first-quarter comparison first."
    : oppositePrediction === null
      ? "Predict whether opposite quarters show the same visible fraction."
      : oppositeComplete
        ? `The result ${oppositePrediction === "same" ? "matches" : "differs from"} your prediction. First quarter 50%; last quarter 50%. The bright half switches sides because orbital position changes. Earth’s shadow is not part of this model.`
        : `Your prediction: ${oppositePrediction}. Compare the two quarters to reveal evidence.`;

  return {
    animate: playing,
    pointer: view === "earth" && oppositeComplete,
    pointerMode: "drag",
    shapes: [],
    vector: moonInset(radians, narrow),
    description: `${phaseName(angle)}: ${Math.round(fraction * 100)}% of the Earth-view lunar disk is illuminated. Mean phase-cycle day ${((angle / 360) * SYNODIC_DAYS).toFixed(1)} of ${SYNODIC_DAYS.toFixed(2)}. ${view === "earth" ? "Textured Earth view." : "Orbit geometry inset with sunlight fixed from the right."} Half the whole Moon remains sunlit; ordinary phases are not Earth’s shadow.`,
    readouts: [
      { label: "Phase", value: phaseName(angle) },
      { label: "Visible disk lit", value: `${Math.round(fraction * 100)}%` },
      { label: "Orbital position", value: `${Math.round(angle)}°` },
      {
        label: "Mean phase-cycle day",
        value: `${((angle / 360) * SYNODIC_DAYS).toFixed(1)}`,
      },
    ],
    controls: oppositeComplete
      ? [range("angle", "Orbit position (°)", 0, 360, 1, angle)]
      : [],
    buttons: [
      button("viewEarth", "Earth view", view === "earth"),
      button("viewOrbit", "Orbit geometry", view === "orbit"),
      ...(oppositeComplete
        ? [
            ...[
              [0, "New"],
              [90, "Quarter"],
              [180, "Full"],
              [270, "Last quarter"],
            ].map(([value, label]) =>
              button(
                `preset${value}`,
                String(label),
                Math.abs(angle - Number(value)) < 0.5,
              ),
            ),
            button("play", playing ? "Pause motion" : "Play motion"),
          ]
        : []),
      ...[25, 50, 75].map((value) =>
        button(`quarter${value}`, `${value}%`, quarterPrediction === value),
      ),
      ...(quarterPrediction !== null
        ? [button("runQuarter", "Observe first quarter")]
        : []),
      ...(quarterComplete
        ? [
            button(
              "oppositeFirst",
              "First quarter is larger",
              oppositePrediction === "first",
            ),
            button(
              "oppositeLast",
              "Last quarter is larger",
              oppositePrediction === "last",
            ),
            button(
              "oppositeSame",
              "Same fraction, opposite sides",
              oppositePrediction === "same",
            ),
            ...(oppositePrediction !== null
              ? [button("runOpposite", "Compare opposite quarters")]
              : []),
          ]
        : []),
    ],
    sections: [
      {
        heading: "1. Test first quarter",
        text: `Keep Sun direction and Earth viewpoint fixed. How much of the disk looks lit at 90°? ${quarterText}`,
        buttonIds: [
          "quarter25",
          "quarter50",
          "quarter75",
          ...(quarterPrediction !== null ? ["runQuarter"] : []),
        ],
      },
      {
        heading: "2. Compare opposite quarters",
        text: oppositeText,
        buttonIds: quarterComplete
          ? [
              "oppositeFirst",
              "oppositeLast",
              "oppositeSame",
              ...(oppositePrediction !== null ? ["runOpposite"] : []),
            ]
          : [],
      },
      {
        heading: "Explain the evidence",
        text: "The Sun illuminates half the whole Moon. Earth sees changing portions of that sunlit hemisphere as orbital position changes. Ordinary phases are not Earth’s shadow; Earth’s shadow causes a lunar eclipse.",
      },
    ],
    footnote: `Circular coplanar teaching geometry; objects and gaps enlarged. The real orbit is tilted about 5°. Mean phase cycle ${SYNODIC_DAYS.toFixed(2)} days; sidereal orbit ${SIDEREAL_DAYS.toFixed(2)} days. Local sky orientation, libration, terrain shadows, eclipses and exact timing are not modeled. Lunar color: NASA LROC; elevation: NASA LOLA.`,
    scene3d: fixedCamera(
      serializeScene(scene, camera, {
        target: [0, 0, 0],
        presentation: {
          title: phaseName(angle),
          showHeading: false,
          layout: {
            height: narrow ? 500 : 620,
            canvasInset: narrow ? [16, -24, 16, -24] : [10, "4%", 10, "4%"],
          },
          toneMapping: "aces",
          exposure: 1.08,
          background: ["#132739", "#071321", "#020711"],
        },
      }),
    ),
  };
}

install(run);
