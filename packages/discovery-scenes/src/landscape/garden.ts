import * as T from "three";
import {
  box,
  ellipsoid,
  line,
  material,
  mesh,
  noise,
  rod,
  stone,
  terrain,
  v,
  type BuiltLandscape,
} from "./geometry";
import type { GardenSceneState } from "./state";
// These schematic coordinates match the shared pollination model, not real distances.
export const gardenFlowers = [
  { x: 140, y: 250, species: "gold", name: "Gold 1" },
  { x: 230, y: 195, species: "gold", name: "Gold 2" },
  { x: 180, y: 145, species: "violet", name: "Violet 1" },
  { x: 350, y: 205, species: "gold", name: "Gold bridge", bridge: true },
  { x: 340, y: 300, species: "violet", name: "Violet bridge", bridge: true },
  { x: 490, y: 235, species: "gold", name: "Gold 3" },
  { x: 570, y: 160, species: "violet", name: "Violet 2" },
  { x: 590, y: 300, species: "gold", name: "Gold 4" },
] as const;
export const gardenPoint = (x: number, y: number, height = 0.1) =>
  v((x - 360) / 50, height, (y - 225) / 50);
function flower(group: T.Object3D, index: number, received: boolean) {
  const item = gardenFlowers[index],
    point = gardenPoint(item.x, item.y),
    plant = new T.Group();
  plant.position.copy(point);
  plant.name = `flower-${index}`;
  plant.userData.select = index;
  group.add(plant);
  rod(plant, v(0, 0, 0), v(0, 0.8, 0), 0.035, "#547b3c");
  for (let i = 0; i < 4; i++) {
    const leaf = ellipsoid(
      plant,
      [0.27, 0.035, 0.12],
      i % 2 ? "#6b944d" : "#487a43",
      Math.cos(i * 2) * 0.18,
      0.2 + i * 0.1,
      Math.sin(i * 2) * 0.16,
    );
    leaf.rotation.y = -i * 2;
    leaf.rotation.z = 0.25;
  }
  const count = item.species === "gold" ? 12 : 6;
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count,
      petal = ellipsoid(
        plant,
        [item.species === "gold" ? 0.14 : 0.22, 0.06, 0.32],
        item.species === "gold"
          ? i % 2
            ? "#efbd48"
            : "#f3d16e"
          : i % 2
            ? "#9870b2"
            : "#b793c8",
        Math.sin(angle) * 0.26,
        0.81 + Math.sin(i) * 0.014,
        Math.cos(angle) * 0.26,
      );
    petal.rotation.y = angle;
    petal.rotation.x = 0.12;
    line(
      plant,
      [
        v(Math.sin(angle) * 0.18, 0.88, Math.cos(angle) * 0.18),
        v(Math.sin(angle) * 0.42, 0.875, Math.cos(angle) * 0.42),
      ],
      item.species === "gold" ? "#dfac45" : "#836397",
      0.007,
    );
  }
  ellipsoid(
    plant,
    [0.2, 0.1, 0.2],
    item.species === "gold" ? "#78603b" : "#d7b24b",
    0,
    0.85,
    0,
  );
  for (let i = 0; i < 28; i++) {
    const angle = i * 2.399,
      radius = 0.028 * Math.sqrt(i);
    ellipsoid(
      plant,
      [0.016, 0.025, 0.016],
      "#edcf75",
      Math.cos(angle) * radius,
      0.95,
      Math.sin(angle) * radius,
    );
  }
  if (received) {
    const ring = mesh(
      plant,
      new T.TorusGeometry(0.61, 0.025, 6, 48),
      material("#d4f0aa"),
      0,
      0.06,
      0,
    );
    ring.rotation.x = Math.PI / 2;
  }
}
function bee(group: T.Object3D, state: GardenSceneState) {
  const insect = new T.Group();
  insect.position.copy(gardenPoint(state.x, state.y, 1.24));
  insect.rotation.y = 0.5;
  group.add(insect);
  ellipsoid(insect, [0.18, 0.14, 0.28], "#d8ac43", 0, 0, 0.05);
  for (let i = 0; i < 3; i++)
    ellipsoid(
      insect,
      [0.183 - i * 0.015, 0.143 - i * 0.01, 0.03],
      "#3b3427",
      0,
      0,
      -0.07 + i * 0.11,
    );
  ellipsoid(insect, [0.14, 0.14, 0.14], "#453f30", 0, 0.05, -0.27);
  for (const side of [-1, 1]) {
    const wing = mesh(
      insect,
      new T.SphereGeometry(1, 16, 8),
      new T.MeshStandardMaterial({
        color: "#e1eeee",
        transparent: true,
        opacity: 0.72,
        roughness: 0.22,
      }),
      side * 0.23,
      0.12,
      -0.02,
    );
    wing.scale.set(0.24, 0.025, 0.15);
    wing.rotation.y = side * -0.3;
    rod(
      insect,
      v(side * 0.06, 0.13, -0.32),
      v(side * 0.12, 0.23, -0.4),
      0.012,
      "#3b3427",
    );
    for (let i = 0; i < 3; i++)
      rod(
        insect,
        v(side * 0.1, -0.06, -0.1 + i * 0.1),
        v(side * 0.25, -0.2, -0.03 + i * 0.1),
        0.018,
        "#514732",
      );
    if (state.pollen !== "none")
      ellipsoid(
        insect,
        [0.06, 0.06, 0.06],
        state.pollen === "gold" ? "#f3c84f" : "#bd92d2",
        side * 0.22,
        -0.15,
        0.11,
      );
  }
}
export function buildGarden(state: GardenSceneState): BuiltLandscape {
  const group = new T.Group();
  box(group, [14, 0.48, 8.2], "#6d563e", 0, -0.27, 0);
  const planted = (x: number, z: number) =>
    Math.abs(x) > 1.4 || (state.habitat && Math.abs(z) < 2.3);
  terrain(
    group,
    14,
    8.2,
    (x, z) => 0.03 + noise(x, z) * 0.026,
    (x, z) =>
      new T.Color(planted(x, z) ? "#6c814e" : "#b8a27b").multiplyScalar(
        0.95 + noise(x, z) * 0.1,
      ),
  );
  for (let i = 0; i < 200; i++) {
    const x = -6.7 + ((i * 1.343) % 13.4),
      z = -3.8 + ((i * 1.727) % 7.6);
    if (!planted(x, z)) {
      if (i % 5 === 0) stone(group, x, 0.07, z, 0.045);
      continue;
    }
    if (
      gardenFlowers.some(
        (f) => Math.hypot((f.x - 360) / 50 - x, (f.y - 225) / 50 - z) < 0.65,
      )
    )
      continue;
    for (let j = 0; j < 2; j++)
      line(
        group,
        [
          v(x, 0.04, z),
          v(x + (j - 0.5) * 0.09, 0.19 + (i % 3) * 0.06, z + 0.03),
        ],
        i % 2 ? "#8c9c58" : "#4c7242",
        0.015,
      );
  }
  const circle = Array.from({ length: 97 }, (_, i) =>
    gardenPoint(
      state.x + Math.cos((i * Math.PI) / 48) * state.reach,
      state.y + Math.sin((i * Math.PI) / 48) * state.reach,
      0.1,
    ),
  );
  for (let i = 0; i < 96; i += 3) {
    const segment = circle.slice(i, i + 2);
    if (segment.every((p) => Math.abs(p.x) < 6.95 && Math.abs(p.z) < 4.05))
      line(group, segment, "#e7edc2", 0.015);
  }
  if (state.path.length > 1)
    line(
      group,
      state.path.map((p) => gardenPoint(p.x, p.y, 0.13)),
      "#e4bd6a",
      0.026,
    );
  const labels: BuiltLandscape["labels"] = [];
  gardenFlowers.forEach((item, i) => {
    if ("bridge" in item && !state.habitat) return;
    flower(group, i, state.received.includes(i));
    const point = gardenPoint(item.x, item.y);
    labels.push({
      text: `${item.name}${state.received.includes(i) ? " ✓" : ""}`,
      x: point.x,
      y: 1.02,
      z: point.z + 0.6,
    });
  });
  const nest = gardenPoint(70, 320);
  box(group, [0.5, 0.3, 0.5], "#98784d", nest.x, 0.2, nest.z);
  ellipsoid(group, [0.11, 0.09, 0.02], "#3b3d2a", nest.x, 0.2, nest.z + 0.26);
  bee(group, state);
  return { group, labels };
}
