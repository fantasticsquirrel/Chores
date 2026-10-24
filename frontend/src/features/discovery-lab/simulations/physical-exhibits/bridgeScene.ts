import * as THREE from "three";
import {
  box,
  bar,
  cylinder,
  material,
  disposeObject,
  arrow,
} from "./sceneGeometry";
import type { BridgeSceneState, PhysicalSceneModel } from "./sceneTypes";
export const bridgeDeckSurface = 1.5;
export const truckTireRadius = 0.26;
export const truckAxleHeight = bridgeDeckSurface + truckTireRadius;
/** The chassis origin is the axle center. Tires touch the deck at every load position. */
export const bridgeLoadX = (position: number) => -5 + position / 10;
export function createBridgeScene(
  initial: BridgeSceneState,
): PhysicalSceneModel {
  const group = new THREE.Group();
  const stone = material("#8c938a"),
    darkStone = material("#58635c"),
    turf = material("#4f6550"),
    soil = material("#655e50");
  const steel = material("#8fa7ad", 0.65, 0.4),
    timber = material("#b58a58", 0, 0.75),
    darkWood = material("#4a3625"),
    rubber = material("#17222b", 0.1, 0.8);
  const water = new THREE.MeshStandardMaterial({
    color: "#255b66",
    metalness: 0.35,
    roughness: 0.22,
  });
  box(group, [22, 0.3, 20], [0, -1.65, 0], material("#182a30"));
  box(group, [9, 0.04, 20], [0, -1.43, 0], water);
  for (const side of [-1, 1]) {
    box(group, [6, 2.8, 17], [side * 7.7, -0.03, 0], soil);
    box(group, [5.6, 0.12, 17], [side * 7.85, 1.38, 0], turf);
    // Layered, irregular riverbank faces, shaded by the scene light.
    for (let i = 0; i < 14; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.7 + (i % 3) * 0.18, 0),
        i % 2 ? stone : darkStone,
      );
      rock.position.set(side * (4.7 + (i % 3) * 0.13), -0.2, -7 + i * 1.05);
      rock.scale.set(0.8, 2.2, 1.1);
      rock.rotation.set(i * 0.34, i * 0.7, 0.3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
    }
    box(group, [4.5, 0.12, 2.05], [side * 7.3, 1.43, 0], material("#66675d"));
    box(group, [1.2, 2.0, 2.6], [side * 5.15, 0.4, 0], stone);
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 3; column++)
        box(
          group,
          [0.012, 0.028, 0.79],
          [side * 4.542, -0.35 + row * 0.45, -0.84 + column * 0.85],
          darkStone,
        );
    for (let i = 0; i < 8; i++) {
      const x = side * (6 + (i % 3) * 1.35),
        z = -3.2 - Math.floor(i / 3) * 1.8;
      cylinder(group, 0.12, 0.8, [x, 1.8, z], darkWood);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(0.58 + (i % 2) * 0.2, 2.3, 7),
        material(i % 2 ? "#405849" : "#65715a"),
      );
      crown.position.set(x, 2.8, z);
      crown.castShadow = true;
      group.add(crown);
    }
  }
  for (let i = 0; i < 21; i++) {
    const wake = box(
      group,
      [0.45 + (i % 5) * 0.34, 0.005, 0.018],
      [-3.8 + (i % 7) * 1.1, -1.4, -6 + Math.floor(i / 7) * 5 + (i % 3) * 0.5],
      material("#83a4a1", 0.3, 0.5),
    );
    wake.rotation.y = 0.08;
  }
  const bridgeBody = new THREE.Group();
  group.add(bridgeBody);
  const deck = box(
    bridgeBody,
    [10, 0.22, 1.85],
    [0, bridgeDeckSurface - 0.11, 0],
    timber,
  );
  for (let i = 0; i < 40; i++)
    box(
      bridgeBody,
      [0.024, 0.01, 1.83],
      [-4.9 + i * 0.25, bridgeDeckSurface + 0.004, 0],
      darkWood,
    );
  const frame: THREE.Mesh[] = [];
  const braceMeshes: THREE.Mesh[][] = [];
  const capacityMats: THREE.MeshStandardMaterial[] = [];
  for (let section = 0; section < 4; section++) {
    const start = -5 + section * 2.5,
      end = start + 2.5;
    const colorMat = material("#8bd6bd", 0.35, 0.42);
    capacityMats.push(colorMat);
    const sectionBraces: THREE.Mesh[] = [];
    for (const z of [-1.02, 1.02]) {
      frame.push(
        bar(bridgeBody, [start, 3.25, z], [end, 3.25, z], 0.16, timber),
      );
      frame.push(
        bar(
          bridgeBody,
          [start, bridgeDeckSurface, z],
          [start, 3.25, z],
          0.16,
          timber,
        ),
      );
      bar(bridgeBody, [start, 1.42, z], [end, 1.42, z], 0.21, colorMat);
      const diagonal = bar(
        bridgeBody,
        [start, 1.5, z],
        [end, 3.25, z],
        0.13,
        timber,
      );
      diagonal.name = `brace-${section}`;
      sectionBraces.push(diagonal);
      for (const x of [start, end])
        for (const y of [1.48, 3.25]) {
          const plate = box(
            bridgeBody,
            [0.24, 0.24, 0.045],
            [x, y, z + (z > 0 ? 0.1 : -0.1)],
            steel,
          );
          plate.rotation.z = Math.PI / 4;
          const bolt = cylinder(
            bridgeBody,
            0.045,
            0.08,
            [x, y, z + (z > 0 ? 0.13 : -0.13)],
            darkStone,
          );
          bolt.rotation.x = Math.PI / 2;
        }
    }
    braceMeshes.push(sectionBraces);
  }
  for (const z of [-1.02, 1.02])
    frame.push(bar(bridgeBody, [5, 1.5, z], [5, 3.25, z], 0.16, timber));
  for (const x of [-5, -2.5, 0, 2.5, 5])
    frame.push(bar(bridgeBody, [x, 1.3, -1.13], [x, 1.3, 1.13], 0.16, timber));
  const truck = new THREE.Group();
  truck.name = "truck";
  group.add(truck);
  const yellow = material("#e6af50", 0.35, 0.35),
    amber = material("#c48130", 0.3, 0.4),
    glass = material("#9bc7cd", 0.5, 0.18);
  box(truck, [1.45, 0.15, 0.78], [0, 0.13, 0], darkStone, "truck");
  box(truck, [0.95, 0.48, 0.84], [-0.25, 0.46, 0], yellow, "truck");
  box(truck, [0.94, 0.08, 0.9], [-0.25, 0.74, 0], amber, "truck");
  box(truck, [0.55, 0.6, 0.78], [0.53, 0.5, 0], yellow, "truck");
  box(truck, [0.56, 0.26, 0.015], [0.53, 0.66, 0.4], glass, "truck");
  box(truck, [0.015, 0.26, 0.62], [0.82, 0.66, 0], glass, "truck");
  box(
    truck,
    [0.1, 0.1, 0.13],
    [0.84, 0.27, 0.24],
    material("#fff0be"),
    "truck",
  );
  box(
    truck,
    [0.1, 0.1, 0.13],
    [0.84, 0.27, -0.24],
    material("#fff0be"),
    "truck",
  );
  for (const x of [-0.49, 0.54])
    for (const z of [-0.47, 0.47]) {
      const tire = cylinder(
        truck,
        truckTireRadius,
        0.17,
        [x, 0, z],
        rubber,
        20,
      );
      tire.rotation.x = Math.PI / 2;
      tire.name = "truck";
      const hub = cylinder(truck, 0.12, 0.18, [x, 0, z], steel, 16);
      hub.rotation.x = Math.PI / 2;
    }
  const loadArrow = arrow(group, 1.0, "#f5cf7e", true);
  const supports = [-5, 5].map((x) => {
    const a = arrow(group, 1, "#9ad6c7");
    a.position.set(x, -0.9, 1.65);
    return a;
  });
  const update = (state: BridgeSceneState) => {
    deck.material = state.material === "steel" ? steel : timber;
    frame.forEach(
      (m) => (m.material = state.material === "steel" ? steel : timber),
    );
    braceMeshes.forEach((meshes, i) =>
      meshes.forEach((m) => {
        m.visible = state.braces[i];
        m.material = state.material === "steel" ? steel : timber;
      }),
    );
    capacityMats.forEach((mat, i) =>
      mat.color.set(
        state.utilization[i] > 1
          ? "#e38667"
          : state.utilization[i] > 0.7
            ? "#dfbc6d"
            : "#78bfa8",
      ),
    );
    truck.position.set(bridgeLoadX(state.position), truckAxleHeight, 0);
    loadArrow.position.set(bridgeLoadX(state.position), 4.8, 0);
    loadArrow.scale.y = 0.4 + state.load / 35;
    loadArrow.visible = state.load > 0;
    supports.forEach((a, i) => {
      const force = i ? state.rightReaction : state.leftReaction;
      a.scale.y = 0.18 + force / 18;
      a.visible = force > 0;
    });
  };
  update(initial);
  return {
    group,
    view: {
      position: [10, 7.1, 15],
      target: [0, 1.0, 0],
      width: 15.6,
      height: 8.4,
    },
    update: (s) => {
      if (s.kind === "bridge") update(s);
    },
    interact: (_name, point) => ({
      type: "position",
      value: Math.max(5, Math.min(95, Math.round((point.x + 5) * 10))),
    }),
    dispose: () => disposeObject(group),
  };
}
