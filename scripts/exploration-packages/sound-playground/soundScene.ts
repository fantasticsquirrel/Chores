import * as THREE from "three";
import { box, cylinder, material, disposeObject, screw } from "./sceneGeometry";
import type { SoundSceneState, PhysicalSceneModel } from "./sceneTypes";
export const stringEndX = (length: number) => -4.8 + length / 12;
export function createSoundScene(initial: SoundSceneState): PhysicalSceneModel {
  const group = new THREE.Group();
  const maple = material("#bc8d55", 0.05, 0.56),
    edge = material("#6c472b"),
    brass = material("#c9ad69", 0.7, 0.3),
    iron = material("#65777b", 0.7, 0.3),
    black = material("#152128");
  box(group, [15, 0.2, 8], [0, -0.65, 0], material("#162c35"));
  for (const x of [-4.6, 4.6])
    for (const z of [-1.08, 1.08])
      cylinder(group, 0.25, 0.36, [x, -0.36, z], black);
  box(group, [12, 0.55, 3.1], [0, 0.06, 0], edge);
  box(group, [12.1, 0.13, 3.18], [0, 0.4, 0], maple);
  box(group, [12.1, 0.07, 3.18], [0, -0.19, 0], maple);
  // Fine grain and edge banding are real surface geometry, not a background gradient.
  for (let i = 0; i < 36; i++) {
    const grain = box(
      group,
      [11.86, 0.003, 0.004 + (i % 3) * 0.002],
      [0, 0.468, -1.51 + i * 0.086],
      material(i % 3 ? "#b48851" : "#c49b64", 0, 0.85),
    );
    grain.rotation.y = Math.sin(i * 1.7) * 0.002;
  }
  for (const z of [-1.54, 1.54])
    box(group, [11.9, 0.03, 0.025], [0, 0.25, z], maple);
  for (const x of [-2.0, 2.1]) {
    const hole = cylinder(group, 0.38, 0.012, [x, 0.479, -0.73], black, 48);
    hole.scale.z = 0.76;
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.43, 0.025, 8, 48),
      brass,
    );
    rim.rotation.x = -Math.PI / 2;
    rim.scale.y = 0.76;
    rim.position.set(x, 0.49, -0.73);
    group.add(rim);
  }
  for (const x of [-5.65, 5.65])
    for (const z of [-1.27, 1.27]) screw(group, [x, 0.49, z], brass, 0.07);
  box(group, [0.45, 0.45, 1.8], [-4.8, 0.69, 0], edge);
  box(group, [0.48, 0.07, 1.83], [-4.8, 0.95, 0], brass);
  const movingBridge = new THREE.Group();
  group.add(movingBridge);
  box(movingBridge, [0.4, 0.45, 1.8], [0, 0.69, 0], edge, "length-bridge");
  box(movingBridge, [0.44, 0.07, 1.83], [0, 0.95, 0], brass, "length-bridge");
  for (const z of [-0.65, 0.65]) screw(movingBridge, [0, 1, z], iron, 0.07);
  const tuning = new THREE.Group();
  tuning.position.set(5.65, 0.65, 0);
  group.add(tuning);
  cylinder(tuning, 0.24, 0.35, [0, 0, 0], iron, 24);
  box(tuning, [0.75, 0.15, 0.22], [0, 0.18, 0], brass);
  cylinder(group, 0.065, 0.5, [-4.8, 0.76, 0], iron, 12);
  const ruler = box(group, [10.2, 0.025, 0.32], [0.2, 0.49, 1.2], brass);
  ruler.name = "length-ruler";
  for (let i = 0; i <= 60; i++)
    box(
      group,
      [0.014, 0.01, i % 5 === 0 ? 0.25 : 0.12],
      [-4.8 + i / 6, 0.51, 1.2],
      edge,
    );
  // A slender tube is rebuilt only for this one string, not the instrument, on explicit playback.
  const wireMaterial = material("#fff1bb", 0.8, 0.24);
  const wire = new THREE.Mesh(new THREE.BufferGeometry(), wireMaterial);
  wire.name = "pluck";
  wire.castShadow = true;
  group.add(wire);
  const tail = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: "#718183" }),
  );
  group.add(tail);
  const baseline = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({
      color: "#6e858a",
      dashSize: 0.09,
      gapSize: 0.08,
    }),
  );
  group.add(baseline);
  let previous = "";
  const update = (s: SoundSceneState) => {
    const end = stringEndX(s.length);
    movingBridge.position.x = end;
    tuning.rotation.y = s.tension / 25;
    const key = `${s.length}:${s.amplitude}:${s.progress}`;
    if (key !== previous) {
      const points = Array.from(
        { length: 61 },
        (_, i) =>
          new THREE.Vector3(
            -4.8 + ((end + 4.8) * i) / 60,
            1.02 +
              Math.sin((i / 60) * Math.PI) *
                s.amplitude *
                0.1 *
                Math.cos(s.progress * Math.PI * 2),
            0,
          ),
      );
      wire.geometry.dispose();
      wire.geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        100,
        0.017,
        6,
        false,
      );
      tail.geometry.dispose();
      tail.geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(end, 1.02, 0),
        new THREE.Vector3(5.65, 0.9, 0),
      ]);
      baseline.geometry.dispose();
      baseline.geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-4.8, 1.02, 0),
        new THREE.Vector3(end, 1.02, 0),
      ]);
      baseline.computeLineDistances();
      previous = key;
    }
  };
  update(initial);
  return {
    group,
    labels: () => [
      { text: "Fixed end", at: [-4.8, 1.55, 0] },
      { text: "Movable bridge", at: [movingBridge.position.x, 1.55, 0] },
    ],
    view: {
      position: [6.4, 8.7, 12],
      target: [0, 0.2, 0],
      width: 14.7,
      height: 6.3,
    },
    update: (s) => {
      if (s.kind === "sound") update(s);
    },
    interact: (name, p, dragging) =>
      name === "length-bridge" || name === "length-ruler" || dragging
        ? {
            type: "length",
            value: Math.max(20, Math.min(120, Math.round((p.x + 4.8) * 12))),
          }
        : { type: "pluck" },
    dispose: () => disposeObject(group),
  };
}
