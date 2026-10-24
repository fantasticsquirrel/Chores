const fixedCamera = <T extends { camera: object }>(s: T) => ({
  ...s,
  camera: { ...s.camera, interactive: false },
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
const scene = new THREE.Scene(),
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
camera.position.set(0, 0, 5.4);
const color = packageTexture("assets/lroc-color-2k.jpg", 2048, 1024),
  bump = packageTexture("assets/lola-elevation-1k.jpg", 1024, 512);
bump.colorSpace = THREE.NoColorSpace;
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(1.24, 128, 96),
  new THREE.MeshStandardMaterial({
    map: color,
    bumpMap: bump,
    bumpScale: 0.025,
    roughness: 1,
    metalness: 0,
  }),
);
moon.rotation.y = -Math.PI / 2;
scene.add(moon);
const sunlight = new THREE.DirectionalLight(0xffffff, 3.4);
scene.add(sunlight, new THREE.AmbientLight(0x879bb6, 0.025));
// Original deterministic star positions, owned by the package rather than host CSS.
const stars: THREE.Points[] = [];
for (let bucket = 0; bucket < 10; bucket++) {
  const points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: bucket >= 5 ? 2 : 1,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.18 + (bucket % 5) * 0.13,
      depthWrite: false,
    }),
  );
  points.userData.indices = Array.from({ length: 65 }, (_, i) => i).filter(
    (i) => (i % 5) + (i % 7 === 0 ? 5 : 0) === bucket,
  );
  scene.add(points);
  stars.push(points);
}
function resizeStars(aspect: number) {
  const half = Math.tan((32 * Math.PI) / 360) * 7.4;
  for (const cloud of stars) {
    const indices = cloud.userData.indices as number[];
    cloud.geometry.setFromPoints(
      indices.map(
        (i) =>
          new THREE.Vector3(
            (((i * 73 + 11) % 100) / 50 - 1) * half * aspect,
            (1 - ((i * 41 + 7) % 100) / 50) * half,
            -2,
          ),
      ),
    );
  }
}
let angle = 90,
  playing = false,
  prediction: number | null = null,
  revealed = false;
export function phaseName(a: number) {
  if (a < 10 || a > 350) return "New Moon";
  if (a < 80) return "Waxing crescent";
  if (a < 100) return "First quarter";
  if (a < 170) return "Waxing gibbous";
  if (a < 190) return "Full Moon";
  if (a < 260) return "Waning gibbous";
  if (a < 280) return "Last quarter";
  return "Waning crescent";
}
let dragStart: { x: number; angle: number } | null = null;
function run(i: Input) {
  const narrow = (i.viewportWidth ?? i.width ?? 800) <= 760;
  if (
    i.control === "angle" ||
    i.control === "play" ||
    i.control?.startsWith("preset") ||
    i.type === "pointer" ||
    (i.type === "step" && playing)
  )
    revealed = false;
  if (i.type === "pointer" && i.pointer) {
    const p = i.pointer;
    if (p.phase === "down") dragStart = { x: p.x, angle };
    if (dragStart)
      angle =
        (dragStart.angle +
          (p.x - dragStart.x) * (i.width ?? 800) * 0.65 +
          720) %
        360;
    if (p.phase === "up") dragStart = null;
  }
  if (i.type === "reset") {
    angle = 0;
    playing = false;
    prediction = null;
    revealed = false;
  }
  if (i.control === "angle") angle = i.values.angle;
  if (i.control === "play") playing = !playing;
  if (i.control?.startsWith("preset")) angle = Number(i.control.slice(6));
  if (i.control?.startsWith("predict")) {
    prediction = Number(i.control.slice(7));
    revealed = false;
  }
  if (i.control === "test") {
    angle = 90;
    revealed = true;
  }
  if (i.type === "step" && playing)
    angle = (angle + ((i.dt ?? 0.05) / 29.5) * 360) % 360;
  const r = (angle * Math.PI) / 180,
    fraction = illuminatedFraction(angle);
  sunlight.position.set(Math.sin(r) * 8, 0, -Math.cos(r) * 8);
  camera.aspect = (i.width ?? 800) / (i.height ?? 480);
  camera.updateProjectionMatrix();
  resizeStars(camera.aspect);
  return {
    animate: playing,
    pointer: true,
    pointerMode: "drag",
    shapes: [],
    vector: moonInset(r, narrow),
    description: `${phaseName(angle)}: ${Math.round(fraction * 100)}% of the visible lunar disk is illuminated. Cycle day ${((angle / 360) * 29.5).toFixed(1)} of 29.5. The Sun lights half of the Moon; the fraction visible from Earth changes with orbital position.`,
    readouts: [
      { label: "Phase", value: phaseName(angle) },
      { label: "Visible disk lit", value: `${Math.round(fraction * 100)}%` },
      {
        label: "Cycle day",
        value: `${((angle / 360) * 29.5).toFixed(1)} of 29.5`,
      },
    ],
    controls: [
      range("angle", "Orbit position (°)", 0, 359, 1, Math.min(359, angle)),
    ],
    buttons: [
      ...[
        [0, "New"],
        [90, "Quarter"],
        [180, "Full"],
        [270, "Last quarter"],
      ].map(([v, l]) =>
        button(`preset${v}`, String(l), Math.abs(angle - Number(v)) < 0.5),
      ),
      button("play", playing ? "Pause motion" : "Play motion"),
      ...[25, 50, 75].map((v) =>
        button(`predict${v}`, `${v}%`, prediction === v),
      ),
      button("test", "Test at first quarter"),
    ],
    sections: [
      {
        heading: "1. Predict",
        text: `At a quarter orbit, how much of the disk looks lit?${prediction === null ? "" : " Your prediction: " + prediction + "%."}`,
        buttonIds: ["predict25", "predict50", "predict75"],
      },
      {
        heading: "2. Observe",
        text: "Move to 90° and inspect the boundary between light and dark.",
        buttonIds: ["test"],
      },
      {
        heading: "3. Explain",
        text: revealed
          ? `${prediction === 50 ? "Your prediction matches: " : "At 90°, "}50% of the disk is lit. The Sun still illuminates half the whole Moon; from Earth we see half of that sunlit side. Phases are not caused by Earth’s shadow; that happens during a lunar eclipse.`
          : "The Sun lights half the Moon. The fraction we see depends on the Moon’s position around Earth. Phases are not caused by Earth’s shadow; that happens during a lunar eclipse.",
      },
      {
        heading: "Compare opposite quarters",
        text: "Predict whether 90° and 270° show different illuminated fractions. Keep the Earth-view orientation fixed and compare them. Both show half a lit disk on opposite sides. Why can the same fraction have a different phase name?",
        buttonIds: ["preset90", "preset270"],
      },
    ],
    footnote:
      "Fixed Earth-view orientation; apparent rotation depends on your location. Faint reflected light reveals the dark outline. Eclipses and orbital inclination not modeled. The 29.5-day phase cycle differs from the sidereal orbital period. Lunar color: NASA LROC; elevation: NASA LOLA.",
    scene3d: fixedCamera(
      serializeScene(scene, camera, {
        target: [0, 0, 0],
        presentation: {
          layout: {
            height: narrow ? 590 : 620,
            canvasInset: narrow
              ? [110, "-15%", 70, "-15%"]
              : [35, "8%", 0, "16%"],
          },
          stat: {
            value: `${Math.round(fraction * 100)}%`,
            label: "of the visible disk is sunlit",
            corner: "bottom-left",
          },
          gestureHint:
            "Drag horizontally to move through the orbit. Keyboard: use Orbit position below.",
          toneMapping: "none",
          exposure: 1,
          title: phaseName(angle),
          subtitle: `${Math.round(fraction * 100)}% of the visible disk is sunlit`,
          background: ["#132132", "#060c17", "#020711"],
        },
      }),
    ),
  };
}
install(run);
