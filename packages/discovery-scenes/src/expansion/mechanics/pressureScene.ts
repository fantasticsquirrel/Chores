import * as THREE from "three";
import {
  normalizePressure,
  pressureResult,
  tankWidthAt,
  type PressureState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import type { ExpansionLabel, ExpansionScene } from "../types";
import {
  bar,
  bench,
  box,
  cylinder,
  disposeTree,
  material,
  pickPlane,
  replaceGroup,
  rope,
  type Point,
} from "./geometry";
const tankX = -1.75,
  floor = 0.18;
function squareVolume(
  parent: THREE.Group,
  bottomWidth: number,
  topWidth: number,
  height: number,
  mat: THREE.Material,
  name: string,
  open = false,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      topWidth / Math.sqrt(2),
      bottomWidth / Math.sqrt(2),
      height,
      4,
      1,
      open,
    ),
    mat,
  );
  mesh.rotation.y = Math.PI / 4;
  mesh.position.set(tankX, floor + height / 2, 0);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}
function tank(root: THREE.Group, s: PressureState) {
  const frame = material("#a7b7b6", 0.75, 0.3),
    bottom = tankWidthAt(s.shape, 0),
    top = tankWidthAt(s.shape, 3.1);
  box(
    root,
    [bottom + 0.25, 0.13, bottom + 0.25],
    [tankX, floor - 0.065, 0],
    frame,
  );
  for (const signX of [-1, 1])
    for (const signZ of [-1, 1])
      bar(
        root,
        [tankX + (signX * bottom) / 2, floor, (signZ * bottom) / 2],
        [tankX + (signX * top) / 2, 3.1 + floor, (signZ * top) / 2],
        0.035,
        frame,
      );
  for (const height of [0, 3.1]) {
    const half = tankWidthAt(s.shape, height) / 2;
    rope(
      root,
      [
        [tankX - half, floor + height, -half],
        [tankX + half, floor + height, -half],
        [tankX + half, floor + height, half],
        [tankX - half, floor + height, half],
        [tankX - half, floor + height, -half],
      ],
      frame,
      0.045,
    );
  }
  const glass = new THREE.MeshStandardMaterial({
    color: "#c0d9da",
    metalness: 0.12,
    roughness: 0.08,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  squareVolume(root, bottom, top, 3.1, glass, "tank-wall", true);
  const water = new THREE.MeshStandardMaterial({
    color: "#3eaabe",
    roughness: 0.2,
    metalness: 0.15,
    transparent: true,
    opacity: 0.64,
    depthWrite: false,
  });
  squareVolume(
    root,
    bottom - 0.035,
    tankWidthAt(s.shape, s.depthM) - 0.035,
    s.depthM,
    water,
    "water-volume",
  );
  const surfaceWidth = tankWidthAt(s.shape, s.depthM) - 0.035;
  for (let i = -2; i <= 2; i++)
    bar(
      root,
      [
        tankX - surfaceWidth * 0.45,
        floor + s.depthM + 0.006,
        (i * surfaceWidth) / 6,
      ],
      [
        tankX + surfaceWidth * 0.45,
        floor + s.depthM + 0.006,
        (i * surfaceWidth) / 6,
      ],
      0.007,
      material("#9ee3e5"),
    );
  // Depth ruler and handle stay in the front plane so both touch and keyboard can set the water level.
  box(
    root,
    [0.11, 3.25, 0.08],
    [-3.05, floor + 1.55, 0.9],
    material("#d9ded1"),
  );
  for (let i = 0; i <= 30; i++)
    box(
      root,
      [i % 10 === 0 ? 0.28 : 0.13, 0.012, 0.035],
      [-2.92, floor + i / 10, 0.95],
      frame,
    );
  box(
    root,
    [0.42, 0.11, 0.18],
    [-3.03, floor + s.depthM, 0.99],
    material("#f2c97b"),
  );
}
function jet(root: THREE.Group, s: PressureState) {
  const r = pressureResult(s),
    brass = material("#bd9450", 0.7, 0.3),
    x = tankX + tankWidthAt(s.shape, s.outletM) / 2;
  bar(
    root,
    [x - 0.05, floor + s.outletM, 0.24],
    [x + 0.32, floor + s.outletM, 0.24],
    0.085,
    brass,
  );
  const collar = cylinder(
    root,
    0.12,
    0.08,
    [x + 0.27, floor + s.outletM, 0.24],
    brass,
  );
  collar.rotation.z = Math.PI / 2;
  if (r.headM > 0) {
    const points: Point[] = Array.from({ length: 41 }, (_, i) => {
      const dx = (r.rangeM * i) / 40;
      return [
        x + 0.32 + dx,
        floor + Math.max(0, s.outletM - (9.81 * (dx / r.jetSpeedMps) ** 2) / 2),
        0.24,
      ];
    });
    rope(root, points, material("#83e3e6", 0.1, 0.15), 0.035).name =
      "water-jet";
    for (let i = 4; i < points.length; i += 5) {
      const droplet = new THREE.Mesh(
        new THREE.SphereGeometry(0.052, 10, 8),
        material("#b3edf1", 0.1, 0.1),
      );
      droplet.position.set(...points[i]);
      root.add(droplet);
    }
    const puddle = cylinder(
      root,
      0.28,
      0.013,
      [x + 0.32 + r.rangeM, floor + 0.01, 0.24],
      new THREE.MeshStandardMaterial({
        color: "#52bdcc",
        transparent: true,
        opacity: 0.8,
        roughness: 0.1,
      }),
    );
    puddle.scale.z = 0.65;
  }
  // Pressure tap before the open outlet. The free jet itself is at atmospheric pressure.
  rope(
    root,
    [
      [x, floor + s.outletM, 0.24],
      [x, 0.55, 0.65],
      [tankX, 0.55, 0.8],
    ],
    brass,
    0.025,
  );
  const dial = cylinder(
    root,
    0.26,
    0.08,
    [tankX, 0.55, 0.84],
    material("#efead5"),
  );
  dial.rotation.x = Math.PI / 2;
  const a = Math.PI * 0.8 - Math.min(1, r.pressurePa / 30000) * Math.PI * 1.6;
  bar(
    root,
    [tankX, 0.55, 0.9],
    [tankX + Math.cos(a) * 0.2, 0.55 + Math.sin(a) * 0.2, 0.9],
    0.013,
    material("#d35d40"),
  );
  for (let i = 0; i <= 10; i++) {
    const tick = Math.PI * 0.8 - (i / 10) * Math.PI * 1.6;
    bar(
      root,
      [tankX + Math.cos(tick) * 0.21, 0.55 + Math.sin(tick) * 0.21, 0.9],
      [tankX + Math.cos(tick) * 0.24, 0.55 + Math.sin(tick) * 0.24, 0.9],
      0.008,
      brass,
    );
  }
  for (let i = 0; i <= 6; i++)
    box(
      root,
      [0.018, 0.02, i % 2 ? 0.13 : 0.22],
      [x + 0.32 + i * 0.5, floor + 0.01, 1.05],
      material("#dbe6d6"),
    );
  return x + 0.32;
}
export function createPressureScene(
  initial: PressureState,
): ExpansionScene<PressureState> {
  const group = new THREE.Group();
  bench(group, 8.4, 4.4);
  box(
    group,
    [7.6, 0.05, 2.7],
    [0, floor - 0.025, 0],
    material("#536f76", 0.45),
  );
  let dynamic: THREE.Group | undefined,
    labels: ExpansionLabel[] = [];
  function update(input: PressureState) {
    const s = normalizePressure(input),
      r = pressureResult(s);
    dynamic = replaceGroup(group, dynamic);
    tank(dynamic, s);
    const outletX = jet(dynamic, s);
    labels = [
      {
        text: `Surface ${s.depthM.toFixed(1)} m ↕`,
        at: [-2.65, floor + s.depthM + 0.28, 0.8],
      },
      {
        text: `Outlet ${s.outletM.toFixed(1)} m`,
        at: [outletX + 0.3, floor + s.outletM + 0.22, 0.3],
      },
      {
        text: `Head ${r.headM.toFixed(1)} m`,
        at: [
          tankX - 0.1,
          floor + (s.depthM + Math.min(s.outletM, s.depthM)) / 2,
          0.9,
        ],
      },
      {
        text: `Static gauge ${(r.pressurePa / 1000).toFixed(1)} kPa`,
        at: [-1.6, 0.15, 1.1],
      },
      {
        text:
          r.headM > 0
            ? `Ideal jet ${r.jetSpeedMps.toFixed(2)} m/s`
            : "Dry outlet: no jet",
        at: [1.2, 2.8, 0.4],
      },
      {
        text: `Range ${r.rangeM.toFixed(2)} m from nozzle`,
        at: [1.5, 0.1, 1.5],
      },
    ];
  }
  update(initial);
  return {
    group,
    view: {
      position: [7.5, 5.7, 10],
      target: [-0.2, 1.5, 0],
      width: 9.3,
      height: 5.9,
    },
    update,
    labels: () => labels,
    pick(ray) {
      const p = pickPlane(ray, 0.99);
      return p && p.x > -3.4 && p.x < -2.65 && p.y > floor && p.y < floor + 3.15
        ? Math.round(Math.max(0.2, Math.min(3, p.y - floor)) * 10) / 10
        : null;
    },
    dispose: () => disposeTree(group),
  };
}
