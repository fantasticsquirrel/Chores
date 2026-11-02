import * as T from "three";
import {
  box,
  ellipsoid,
  line,
  material,
  mesh,
  stone,
  tree,
  v,
  type BuiltLandscape,
} from "./geometry";
import type { PondSceneState } from "./state";
function fish(group: T.Object3D, x: number, y: number, z: number, i: number) {
  const animal = new T.Group();
  animal.name = `fish-${i}`;
  animal.position.set(x, y, z);
  animal.rotation.y = i % 2 ? 0.35 : Math.PI + 0.25;
  group.add(animal);
  ellipsoid(animal, [0.49, 0.2, 0.13], "#dfaa68");
  ellipsoid(animal, [0.4, 0.13, 0.133], "#e9c891", 0.03, -0.04, 0);
  const tail = mesh(
    animal,
    new T.ConeGeometry(0.23, 0.34, 3),
    material("#bc7851"),
    -0.5,
    0,
    0,
  );
  tail.rotation.z = Math.PI / 2;
  tail.scale.z = 0.3;
  const fin = mesh(
    animal,
    new T.ConeGeometry(0.15, 0.23, 3),
    material("#bd7950"),
    -0.03,
    0.21,
    0,
  );
  fin.scale.z = 0.25;
  for (const side of [-1, 1]) {
    ellipsoid(animal, [0.05, 0.05, 0.025], "#182d2a", 0.33, 0.06, side * 0.12);
    line(
      animal,
      [
        v(0.2, 0.11, side * 0.13),
        v(0.13, 0, side * 0.14),
        v(0.2, -0.1, side * 0.12),
      ],
      "#a5704b",
      0.012,
    );
  }
}
function energyArrow(
  group: T.Object3D,
  name: string,
  start: T.Vector3,
  end: T.Vector3,
  phase: number,
) {
  const arrow = new T.Group();
  arrow.name = name;
  group.add(arrow);
  const direction = end.clone().sub(start).normalize();
  line(arrow, [start, end], "#e3b94f", 0.065);
  const head = mesh(
    arrow,
    new T.ConeGeometry(0.19, 0.42, 16),
    new T.MeshStandardMaterial({
      color: "#f1cc61",
      emissive: "#6c4b08",
      emissiveIntensity: 0.28,
      roughness: 0.3,
    }),
    end.x,
    end.y,
    end.z,
  );
  head.name = `${name}-head`;
  head.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction);
  const markerPosition = start.clone().lerp(end, phase);
  const marker = mesh(
    arrow,
    new T.SphereGeometry(0.12, 8, 6),
    new T.MeshStandardMaterial({
      color: "#fff1a8",
      emissive: "#d99111",
      emissiveIntensity: 0.75,
      roughness: 0.2,
    }),
    markerPosition.x,
    markerPosition.y,
    markerPosition.z,
  );
  marker.name = `${name}-marker`;
}
export function buildPond(state: PondSceneState): BuiltLandscape {
  const group = new T.Group(),
    level = 1.1 - state.drought * 0.012;
  box(group, [13.4, 0.45, 7.8], "#644d39", 0, -1.6, 0);
  for (let i = 0; i < 3; i++)
    box(group, [13.45, 0.035, 7.85], "#a78657", 0, -1.45 - i * 0.13, 0);
  box(group, [13.4, 0.3, 7.8], "#698c7c", 0, -1.24, 0);
  box(group, [13.4, 2, 1.2], "#70824c", 0, -0.2, -3.45);
  box(group, [1.2, 1.9, 6.7], "#7b8451", -6.1, -0.25, 0.3);
  box(group, [1.2, 1.9, 6.7], "#7b8451", 6.1, -0.25, 0.3);
  for (let i = 0; i < 62; i++) {
    const x = -5.4 + ((i * 1.713) % 10.8),
      z = -2.9 + ((i * 1.33) % 6.1);
    stone(group, x, -1.02, z, 0.05 + (i % 4) * 0.025);
  }
  const water = mesh(
    group,
    new T.BoxGeometry(10.9, level + 1.05, 6.4),
    new T.MeshPhysicalMaterial({
      color: new T.Color("#397f92").lerp(
        new T.Color("#477848"),
        state.algae / 220,
      ),
      transparent: true,
      opacity: 0.3,
      roughness: 0.2,
      metalness: 0.04,
      side: T.DoubleSide,
      depthWrite: false,
    }),
    0,
    (level - 1.05) / 2,
    0.25,
  );
  water.name = "water";
  water.castShadow = false;
  water.renderOrder = 3;
  const cutWater = mesh(
    group,
    new T.PlaneGeometry(10.9, level + 1.05),
    new T.MeshBasicMaterial({
      color: "#287f94",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: T.DoubleSide,
    }),
    0,
    (level - 1.05) / 2,
    3.46,
  );
  cutWater.castShadow = false;
  cutWater.renderOrder = 4;
  line(
    group,
    [v(-5.45, level + 0.02, 3.46), v(5.45, level + 0.02, 3.46)],
    "#9bd5d5",
    0.025,
  );
  for (let i = 0; i < 8; i++)
    line(
      group,
      [
        v(-5, level + 0.02, -2.5 + i * 0.8),
        v(-1, level + 0.04, -2.58 + i * 0.8),
        v(2.5, level + 0.02, -2.5 + i * 0.8),
        v(5.1, level + 0.04, -2.55 + i * 0.8),
      ],
      "#b6d9c7",
      0.012,
    );
  for (let i = 0; i < 21; i++) {
    const x = -5.2 + ((i * 0.73) % 10.4),
      z = -2.65 + (i % 3) * 0.23;
    for (let j = 0; j < 3; j++)
      line(
        group,
        [
          v(x, -1.1, z),
          v(x + 0.13 * (j - 1), -0.5, z + 0.05),
          v(x + Math.sin(i + j) * 0.27, 0.12 + (i % 4) * 0.12, z),
        ],
        "#4f7d4c",
        0.035,
      );
  }
  for (let i = 0; i < 15; i++) {
    const x = -5.8 + ((i * 1.17) % 11.6),
      z = -3.5 + (i % 2) * 0.24;
    line(
      group,
      [v(x, 0.8, z), v(x + 0.06, 2.1 + (i % 3) * 0.15, z)],
      "#637740",
      0.035,
    );
    mesh(
      group,
      new T.CapsuleGeometry(0.065, 0.3, 4, 7),
      material("#705138"),
      x + 0.06,
      2.15 + (i % 3) * 0.15,
      z,
    );
    line(
      group,
      [v(x, 0.8, z), v(x - 0.2, 1.6, z), v(x - 0.35, 1.85, z)],
      "#819b4e",
      0.025,
    );
  }
  tree(group, -5.8, 0.8, -3.4, 0.9);
  tree(group, 5.7, 0.8, -3.5, 0.75);
  const algae = new T.Group();
  algae.name = "algae";
  group.add(algae);
  for (let i = 0; i < Math.ceil(state.algae * 0.65); i++) {
    const x = -4.8 + ((i * 1.419) % 9.6),
      z = -2.2 + ((i * 0.837) % 5.2);
    ellipsoid(
      algae,
      [0.17 + (i % 3) * 0.05, 0.025, 0.14],
      "#8fab58",
      x,
      level + 0.03,
      z,
    );
    for (let j = 0; j < 3; j++)
      ellipsoid(
        algae,
        [0.035, 0.035, 0.035],
        "#b5c76a",
        x + j * 0.06,
        level - 0.25 - (i % 4) * 0.14,
        z,
      );
  }
  for (let i = 0; i < Math.ceil(state.zooplankton / 2.3); i++) {
    const x = -4.7 + ((i * 1.797) % 9.4),
      z = -1.8 + ((i * 1.53) % 4.5),
      y = level - 0.3 - (i % 3) * 0.16;
    ellipsoid(group, [0.07, 0.11, 0.055], "#e1e6c7", x, y, z);
    line(
      group,
      [v(x - 0.12, y + 0.17, z), v(x, y + 0.07, z), v(x + 0.12, y + 0.17, z)],
      "#bad7c8",
      0.009,
    );
  }
  for (let i = 0; i < Math.ceil(state.fish / 4); i++)
    fish(
      group,
      -4.1 + ((i * 2.19) % 8.2),
      level - 0.55 - (i % 2) * 0.25,
      -0.6 + ((i * 0.97) % 3.3),
      i,
    );
  const detritus = new T.Group();
  detritus.name = "detritus";
  group.add(detritus);
  for (let i = 0; i < Math.ceil(state.detritus / 2.2); i++) {
    const particle = mesh(
      detritus,
      new T.SphereGeometry(1, 7, 5),
      material(i % 2 ? "#8b633b" : "#b88b4c"),
      -4.8 + ((i * 1.49) % 9.6),
      -0.96 + (i % 3) * 0.035,
      -1.9 + ((i * 0.91) % 4.8),
    );
    particle.scale.set(0.075 + (i % 3) * 0.025, 0.025, 0.055);
    particle.rotation.y = i * 0.73;
  }
  for (let i = 0; i < Math.floor(state.oxygen / 5); i++) {
    const bubble = mesh(
      group,
      new T.SphereGeometry(0.025 + (i % 3) * 0.012, 8, 6),
      new T.MeshStandardMaterial({
        color: "#d0e6d9",
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
      }),
      -4.5 + ((i * 1.23) % 9),
      level - 0.2 - (i % 5) * 0.15,
      1.7 + (i % 3) * 0.35,
    );
    bubble.castShadow = false;
  }
  const flowPhase = ((state.energyFlowPhase % 1) + 1) % 1;
  if (state.algae > 0 && state.zooplankton > 0)
    energyArrow(
      group,
      "energy-flow-algae-to-zooplankton",
      v(-3.7, level + 0.53, 3.6),
      v(-0.45, level + 0.15, 3.6),
      flowPhase,
    );
  if (state.zooplankton > 0 && state.fish > 0)
    energyArrow(
      group,
      "energy-flow-zooplankton-to-fish",
      v(0.15, level + 0.08, 3.6),
      v(3.45, level - 0.35, 3.6),
      flowPhase,
    );
  return {
    group,
    labels: [
      {
        text: state.algae > 0 ? "Algae" : "Algae absent",
        x: -2.9,
        y: level + 0.35,
        z: -0.8,
      },
      {
        text: state.zooplankton > 0 ? "Grazers" : "Grazers absent",
        x: 2.3,
        y: level,
        z: 1.3,
      },
      {
        text: state.fish > 0 ? "Fish" : "Fish absent",
        x: 3.15,
        y: level - 0.28,
        z: 2.85,
      },
      {
        text: "Resource → consumer",
        x: 0,
        y: level + 1.02,
        z: 3.6,
      },
    ],
  };
}
