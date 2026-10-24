import * as THREE from "three";
import {
  heatResult,
  heatWallMaterials,
  normalizeHeat,
  type HeatState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import type { ExpansionLabel, ExpansionScene } from "../types";
import {
  arrow,
  bar,
  bench,
  box,
  disposeTree,
  material,
  pickPlane,
  replaceGroup,
} from "./geometry";
function house(root: THREE.Group, s: HeatState) {
  const wall = material(
    s.material === "brick"
      ? "#ad6c54"
      : s.material === "wood"
        ? "#b89b6c"
        : "#b7c5b7",
  );
  const mortar = material("#d3c8b2"),
    frame = material("#e9d9b8"),
    roof = material("#485d6b", 0.15),
    insulation = material("#e2b875");
  const windowWidth = 0.65 + (s.windowM2 / 18) * 2.5,
    windowHeight = 1.15;
  box(root, [5.2, 0.2, 3.2], [0, 0.2, 0], material("#6c7b79"));
  for (let i = 0; i < 12; i++)
    box(
      root,
      [0.395, 0.05, 2.8],
      [-2.2 + i * 0.4, 0.33, 0],
      material("#b18d5b"),
    );
  box(root, [4.9, 2.5, 0.15], [0, 1.6, -1.4], wall);
  for (const x of [-2.4, 2.4]) {
    box(root, [0.15, 2.5, 2.8], [x, 1.6, 0], wall);
    if (s.insulationCm > 0)
      box(
        root,
        [0.025 + s.insulationCm * 0.014, 2.45, 2.8],
        [x + Math.sign(x) * (0.09 + s.insulationCm * 0.007), 1.6, 0],
        insulation,
      );
  }
  const sideWidth = (4.8 - windowWidth) / 2;
  for (const sign of [-1, 1])
    box(
      root,
      [sideWidth, 2.5, 0.17],
      [sign * (windowWidth / 2 + sideWidth / 2), 1.6, 1.4],
      wall,
    );
  box(root, [windowWidth, 0.6, 0.17], [0, 0.65, 1.4], wall);
  box(root, [windowWidth, 0.75, 0.17], [0, 2.475, 1.4], wall);
  if (s.material === "brick") {
    for (let row = 0; row < 11; row++) {
      const y = 0.45 + row * 0.225;
      const sections =
        y > 0.9 && y < 2.13
          ? [
              [-2.4, -windowWidth / 2],
              [windowWidth / 2, 2.4],
            ]
          : [[-2.4, 2.4]];
      sections.forEach(([a, b]) => {
        box(root, [b - a, 0.018, 0.012], [(a + b) / 2, y, 1.492], mortar);
        for (let x = a + (row % 2 ? 0.2 : 0.4); x < b - 0.02; x += 0.45)
          box(root, [0.015, 0.21, 0.012], [x, y + 0.11, 1.493], mortar);
      });
    }
  } else {
    for (let row = 0; row < 11; row++)
      for (const sign of [-1, 1])
        box(
          root,
          [sideWidth, 0.015, 0.015],
          [sign * (windowWidth / 2 + sideWidth / 2), 0.5 + row * 0.21, 1.5],
          mortar,
        );
  }
  const glass = new THREE.MeshStandardMaterial({
    color: "#8ac5d1",
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    metalness: 0.3,
  });
  box(root, [windowWidth, windowHeight, 0.035], [0, 1.525, 1.43], glass);
  for (const x of [-windowWidth / 2, 0, windowWidth / 2])
    box(root, [0.065, windowHeight + 0.12, 0.15], [x, 1.525, 1.48], frame);
  for (const y of [0.95, 1.525, 2.1])
    box(root, [windowWidth + 0.12, 0.065, 0.15], [0, y, 1.48], frame);
  box(root, [windowWidth + 0.32, 0.09, 0.35], [0, 0.92, 1.55], frame);
  // Only the rear roof half remains: the opening makes the wall layers visible.
  for (let i = 0; i < 7; i++) {
    const x = -2.4 + i * 0.8;
    bar(root, [x, 2.88, -1.58], [x, 3.7, 0], 0.07, frame);
    bar(root, [x, 3.7, 0], [x, 2.88, 1.58], 0.045, frame);
  }
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 14; col++) {
      const tile = box(
        root,
        [0.37, 0.055, 0.4],
        [-2.45 + col * 0.38, 2.94 + row * 0.17, -1.48 + row * 0.32],
        roof,
      );
      tile.rotation.x = -0.47;
    }
  for (let i = 0; i < 10; i++)
    box(
      root,
      [0.09, 0.55, 0.15],
      [-0.65 + i * 0.14, 0.7, -1.18],
      material("#f4e4cb", 0.3),
    );
  const glow = new THREE.PointLight("#ffb36f", 4, 6);
  glow.position.set(0, 1.4, 0);
  root.add(glow);
  const r = heatResult(s);
  if (r.deltaC !== 0)
    for (const x of [-1.9, 1.9])
      arrow(
        root,
        [x, 1.5, 1.53],
        Math.min(1.3, (r.wallU * Math.abs(r.deltaC)) / 35) + 0.08,
        "#ebb270",
        [0, 0, Math.sign(r.deltaC) || 1],
      );
  if (r.deltaC !== 0)
    arrow(
      root,
      [0, 1.5, 1.55],
      Math.min(1.5, (r.windowU * Math.abs(r.deltaC)) / 35),
      "#7ad6df",
      [0, 0, Math.sign(r.deltaC) || 1],
    );
}
function wallSample(root: THREE.Group, s: HeatState) {
  const x = -3.55,
    y = 1.3,
    insulationWidth = 0.02 + s.insulationCm * 0.035;
  box(
    root,
    [0.25, 1.65, 0.65],
    [x - 0.18, y, 0.1],
    material(
      s.material === "brick"
        ? "#b77358"
        : s.material === "wood"
          ? "#b89b6c"
          : "#b7c5b7",
    ),
  );
  box(
    root,
    [insulationWidth, 1.65, 0.65],
    [x + insulationWidth / 2, y, 0.1],
    material("#e3bf79"),
  );
  box(
    root,
    [0.06, 1.65, 0.68],
    [x + insulationWidth + 0.04, y, 0.1],
    material("#e5e0cc"),
  );
  for (let row = 0; row < 9; row++)
    for (let col = 0; col < Math.ceil(insulationWidth / 0.1); col++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 6, 4),
        material("#b79355"),
      );
      dot.position.set(x + 0.04 + col * 0.095, 0.55 + row * 0.18, 0.435);
      root.add(dot);
    }
  const ruler = material("#93b5bd");
  box(root, [1.15, 0.04, 0.1], [-3.1, 0.33, 0.55], ruler);
  for (let i = 0; i <= 4; i++)
    box(root, [0.015, 0.12, 0.08], [-3.55 + i * 0.225, 0.36, 0.55], ruler);
  box(
    root,
    [0.1, 0.28, 0.2],
    [-3.55 + s.insulationCm * 0.045, 0.38, 0.58],
    material("#f3d18d"),
  );
}
export function createHeatScene(initial: HeatState): ExpansionScene<HeatState> {
  const group = new THREE.Group();
  bench(group, 9.4, 6);
  let dynamic: THREE.Group | undefined,
    labels: ExpansionLabel[] = [];
  function update(input: HeatState) {
    const s = normalizeHeat(input),
      result = heatResult(s);
    dynamic = replaceGroup(group, dynamic);
    house(dynamic, s);
    wallSample(dynamic, s);
    labels = [
      { text: `${s.insideC}°C held inside`, at: [0, 3.75, 0.2] },
      { text: `${s.outsideC}°C outside`, at: [2.3, 0.3, 2.3] },
      { text: `Walls ${result.wallWatts.toFixed(0)} W`, at: [2, 2.2, 2.1] },
      { text: `Windows ${result.windowWatts.toFixed(0)} W`, at: [0, 0.8, 2.5] },
      {
        text: `${heatWallMaterials[s.material].label} + ${s.insulationCm} cm`,
        at: [-3.1, 2.55, 0.4],
      },
      { text: "Drag thickness ↔", at: [-3.15, 0.12, 1.1] },
    ];
  }
  update(initial);
  return {
    group,
    view: {
      position: [9, 6.8, 12],
      target: [-0.4, 1.65, 0.3],
      width: 10.4,
      height: 6.2,
    },
    update,
    labels: () => labels,
    pick(ray) {
      const p = pickPlane(ray, 0.58);
      return p && p.x > -3.7 && p.x < -2.5 && p.y > 0.15 && p.y < 0.7
        ? Math.round(Math.max(0, Math.min(20, (p.x + 3.55) / 0.045)))
        : null;
    },
    dispose: () => disposeTree(group),
  };
}
