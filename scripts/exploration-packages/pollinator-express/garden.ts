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
function flower(
  group: T.Object3D,
  index: number,
  received: boolean,
  trialSpecies: GardenSceneState["trialSpecies"],
) {
  const item = gardenFlowers[index],
    species =
      index === 1 && trialSpecies !== "none" ? trialSpecies : item.species,
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
  const count = species === "gold" ? 12 : 6;
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count,
      petal = ellipsoid(
        plant,
        [species === "gold" ? 0.14 : 0.22, 0.06, 0.32],
        species === "gold"
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
      species === "gold" ? "#dfac45" : "#836397",
      0.007,
    );
  }
  ellipsoid(
    plant,
    [0.2, 0.1, 0.2],
    species === "gold" ? "#78603b" : "#d7b24b",
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
  // Enlarged reproductive structures make the mechanism inspectable.
  rod(plant, v(0, 0.86, 0), v(0, 1.19, 0), 0.025, "#b8d788");
  ellipsoid(plant, [0.07, 0.035, 0.07], "#d9efad", 0, 1.21, 0);
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const x = Math.cos(angle) * 0.14;
    const z = Math.sin(angle) * 0.14;
    rod(plant, v(x * 0.45, 0.9, z * 0.45), v(x, 1.08, z), 0.012, "#efe1a0");
    ellipsoid(plant, [0.035, 0.025, 0.06], "#d9a93d", x, 1.1, z);
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
    for (let i = 0; i < 3; i++)
      ellipsoid(
        plant,
        [0.025, 0.018, 0.025],
        "#f3d26d",
        (i - 1) * 0.035,
        1.25 + (i % 2) * 0.018,
        0.015 * (i - 1),
      );
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
  box(group, [14.06, 0.07, 8.26], "#4f3d2e", 0, -0.45, 0);
  box(group, [14.04, 0.045, 8.24], "#947252", 0, -0.31, 0);
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
    48,
  );
  const grassPositions: number[] = [];
  const grassColors: number[] = [];
  const grassIndices: number[] = [];
  const addGrassBlade = (
    x: number,
    z: number,
    height: number,
    angle: number,
    color: T.Color,
  ) => {
    const offset = grassPositions.length / 3;
    const halfWidth = 0.025;
    const sideX = Math.cos(angle) * halfWidth;
    const sideZ = Math.sin(angle) * halfWidth;
    grassPositions.push(
      x - sideX,
      0.04,
      z - sideZ,
      x + sideX,
      0.04,
      z + sideZ,
      x + Math.sin(angle) * 0.05,
      height,
      z + Math.cos(angle) * 0.05,
    );
    for (let vertex = 0; vertex < 3; vertex++)
      grassColors.push(color.r, color.g, color.b);
    grassIndices.push(offset, offset + 1, offset + 2);
  };
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
    const color = new T.Color(i % 2 ? "#8c9c58" : "#4c7242");
    for (let j = 0; j < 2; j++)
      addGrassBlade(
        x,
        z,
        0.19 + (i % 3) * 0.06,
        i * 2.399 + (j * Math.PI) / 2,
        color,
      );
  }
  if (grassPositions.length) {
    const grassGeometry = new T.BufferGeometry();
    grassGeometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(grassPositions, 3),
    );
    grassGeometry.setAttribute(
      "color",
      new T.Float32BufferAttribute(grassColors, 3),
    );
    grassGeometry.setIndex(grassIndices);
    grassGeometry.computeVertexNormals();
    const grassMaterial = new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      side: T.DoubleSide,
    });
    mesh(group, grassGeometry, grassMaterial);
  }
  const reachOutline = Array.from({ length: 97 }, (_, i) =>
    gardenPoint(
      state.x + Math.cos((i * Math.PI) / 48) * state.reach,
      state.y + Math.sin((i * Math.PI) / 48) * state.reach,
      0.11,
    ),
  );
  const reachHighlight = reachOutline.map((point) => point.clone().setY(0.145));
  for (let i = 0; i < 96; i += 3) {
    const outlineSegment = reachOutline.slice(i, i + 2);
    if (
      outlineSegment.every(
        (point) => Math.abs(point.x) < 6.95 && Math.abs(point.z) < 4.05,
      )
    ) {
      line(group, outlineSegment, "#142826", 0.032);
      line(group, reachHighlight.slice(i, i + 2), "#f7f5d4", 0.014);
    }
  }
  if (state.path.length > 1) {
    const routeOutline = state.path.map((point) =>
      gardenPoint(point.x, point.y, 0.13),
    );
    line(group, routeOutline, "#162c29", 0.052);
    line(
      group,
      routeOutline.map((point) => point.clone().setY(0.18)),
      "#fff0a8",
      0.023,
    );
  }
  if (state.path.length > 1)
    state.path.forEach((point, index) =>
      ellipsoid(
        group,
        [
          index === state.path.length - 1 ? 0.09 : 0.055,
          0.035,
          index === state.path.length - 1 ? 0.09 : 0.055,
        ],
        index === state.path.length - 1 ? "#fff1a8" : "#d9a94e",
        gardenPoint(point.x, point.y).x,
        0.16,
        gardenPoint(point.x, point.y).z,
      ),
    );
  const labels: BuiltLandscape["labels"] = [];
  gardenFlowers.forEach((item, i) => {
    if ("bridge" in item && !state.habitat) return;
    flower(group, i, state.received.includes(i), state.trialSpecies);
    const point = gardenPoint(item.x, item.y);
    labels.push({
      text: `${i === 1 && state.trialSpecies !== "none" ? `Trial flower · ${state.trialSpecies === "gold" ? "Gold" : "Violet"} type` : item.name}${state.received.includes(i) ? " ✓" : ""}`,
      x: point.x,
      y: 1.02,
      z: point.z + 0.6,
    });
  });
  const nest = gardenPoint(70, 320);
  box(group, [0.5, 0.3, 0.5], "#98784d", nest.x, 0.2, nest.z);
  ellipsoid(group, [0.11, 0.09, 0.02], "#3b3d2a", nest.x, 0.2, nest.z + 0.26);
  for (let i = 0; i < 7; i++) {
    const angle = i === 0 ? 0 : ((i - 1) * Math.PI) / 3;
    const radius = i === 0 ? 0 : 0.12;
    ellipsoid(
      group,
      [0.035, 0.035, 0.012],
      i === 0 ? "#5b4632" : "#d1a85c",
      nest.x + Math.cos(angle) * radius,
      0.24 + Math.sin(angle) * radius,
      nest.z + 0.266,
    );
  }
  labels.push({ text: "Nest", x: nest.x, y: 0.68, z: nest.z + 0.45 });
  bee(group, state);
  return { group, labels };
}
