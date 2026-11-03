import * as THREE from "three";
import {
  GRAVITY_M_PER_S2,
  normalizePressure,
  pressureResult,
  tankWidthAt,
  type PressureState,
} from "@family-manager/family-api/discovery-models/pressure-tank";
import type { ExpansionLabel, ExpansionScene } from "../types";
import {
  arrow,
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
import {
  addHydraulicsLabBackdrop,
  addPressureGaugePanel,
} from "./pressureTankDetails";

const tankX = -1.9;
const floor = 0.22;
const tankTopM = 3.18;
// The 0.10 m square sensor must remain inside the narrowest tapered wall.
const sensorZ = 0.34;

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
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addTank(root: THREE.Group, state: PressureState) {
  const frame = material("#9db5b8", 0.78, 0.26);
  const darkFrame = material("#345662", 0.76, 0.28);
  const bottom = tankWidthAt(state.shape, 0);
  const top = tankWidthAt(state.shape, 3);
  box(
    root,
    [bottom + 0.3, 0.14, bottom + 0.3],
    [tankX, floor - 0.07, 0],
    darkFrame,
    "tank-base",
  );
  for (const signX of [-1, 1])
    for (const signZ of [-1, 1]) {
      bar(
        root,
        [tankX + (signX * bottom) / 2, floor, (signZ * bottom) / 2],
        [tankX + (signX * top) / 2, floor + tankTopM, (signZ * top) / 2],
        0.042,
        frame,
      );
      box(
        root,
        [0.14, 0.12, 0.14],
        [tankX + (signX * bottom) / 2, floor - 0.12, (signZ * bottom) / 2],
        darkFrame,
      );
    }
  for (const height of [0, tankTopM]) {
    const half = tankWidthAt(state.shape, Math.min(3, height)) / 2;
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
      0.05,
    );
  }
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#b9d9de",
    metalness: 0.08,
    roughness: 0.08,
    transmission: 0.28,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  squareVolume(root, bottom, top, tankTopM, glass, "tank-wall", true);
  const water = new THREE.MeshPhysicalMaterial({
    color: "#2d9eb5",
    roughness: 0.18,
    metalness: 0.08,
    transmission: 0.08,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  squareVolume(
    root,
    Math.max(0.1, bottom - 0.04),
    Math.max(0.1, tankWidthAt(state.shape, state.depthM) - 0.04),
    state.depthM,
    water,
    "water-volume",
  );
  const surfaceWidth = tankWidthAt(state.shape, state.depthM) - 0.04;
  for (let index = -3; index <= 3; index++)
    bar(
      root,
      [
        tankX - surfaceWidth * 0.45,
        floor + state.depthM + 0.01,
        (index * surfaceWidth) / 8,
      ],
      [
        tankX + surfaceWidth * 0.45,
        floor + state.depthM + 0.01,
        (index * surfaceWidth) / 8,
      ],
      0.009,
      material("#a7edf1", 0.1, 0.18),
    );

  // One scene unit is one metre. The front ruler and gold handle are the direct level control.
  box(
    root,
    [0.12, 3.35, 0.09],
    [-3.23, floor + 1.58, 1.02],
    material("#d8e0d7", 0.24, 0.42),
    "surface-ruler",
  );
  for (let tick = 0; tick <= 30; tick++)
    box(
      root,
      [tick % 10 === 0 ? 0.34 : tick % 5 === 0 ? 0.24 : 0.15, 0.013, 0.04],
      [-3.08, floor + tick / 10, 1.075],
      darkFrame,
    );
  box(
    root,
    [0.52, 0.12, 0.22],
    [-3.2, floor + state.depthM, 1.1],
    material("#f1c46e", 0.42, 0.3),
    "surface-control-marker",
  );

  const bracketZ = 1.08;
  const bracketX = tankX - Math.max(bottom, top) / 2 - 0.18;
  const lowY = floor + Math.min(state.outletM, state.depthM);
  const highY = floor + state.depthM;
  if (highY > lowY)
    bar(
      root,
      [bracketX, lowY, bracketZ],
      [bracketX, highY, bracketZ],
      0.022,
      material("#f0d092"),
    ).name = "head-bracket";
  for (const y of new Set([lowY, highY]))
    box(root, [0.3, 0.025, 0.06], [bracketX + 0.12, y, bracketZ], frame);
}

function addOutletAndJet(root: THREE.Group, state: PressureState) {
  const result = pressureResult(state);
  const brass = material("#bd9450", 0.75, 0.25);
  const steel = material("#7fa3aa", 0.76, 0.24);
  const cable = material("#243746", 0.08, 0.72);
  const outletWallX = tankX + tankWidthAt(state.shape, state.outletM) / 2;
  const outletY = floor + state.outletM;
  const nozzleZ = 0.2;

  box(
    root,
    [0.035, 0.1, 0.1],
    [outletWallX + 0.02, outletY, sensorZ],
    material("#e7dcc1", 0.25, 0.35),
    "pressure-sensor-face",
  );
  if (result.gaugePressurePa > 0) {
    const forceArrow = arrow(
      root,
      [outletWallX + 0.05, outletY, sensorZ],
      0.18 + Math.min(0.62, result.gaugePressurePa / 30_000),
      "#f2c47c",
      [1, 0, 0],
    );
    forceArrow.name = "sensor-force-arrow";
  }
  // This is an insulated electrical signal cable to the remote display, not
  // a liquid-filled pressure tube. The sensor itself measures at outlet height.
  rope(
    root,
    [
      [outletWallX + 0.02, outletY, sensorZ],
      [outletWallX + 0.2, outletY, sensorZ + 0.16],
      [2.42, 1.82, -1.98],
    ],
    cable,
    0.035,
  ).name = "insulated-sensor-signal-cable";
  box(
    root,
    [0.07, 0.07, 0.07],
    [outletWallX + 0.04, outletY, sensorZ],
    steel,
    "sensor-cable-connector",
  );

  bar(
    root,
    [outletWallX - 0.06, outletY, nozzleZ],
    [outletWallX + 0.42, outletY, nozzleZ],
    0.09,
    brass,
  ).name = "horizontal-outlet";
  const collar = cylinder(
    root,
    0.135,
    0.1,
    [outletWallX + 0.36, outletY, nozzleZ],
    steel,
  );
  collar.rotation.z = Math.PI / 2;
  const nozzleX = outletWallX + 0.47;

  if (result.outletSubmerged) {
    const points: Point[] = Array.from({ length: 49 }, (_, index) => {
      const dx = (result.rangeM * index) / 48;
      return [
        nozzleX + dx,
        floor +
          Math.max(
            0,
            state.outletM -
              (GRAVITY_M_PER_S2 * (dx / result.jetSpeedMps) ** 2) / 2,
          ),
        nozzleZ,
      ];
    });
    rope(root, points, material("#8de6ec", 0.08, 0.15), 0.04).name =
      "water-jet";
    for (let index = 5; index < points.length - 1; index += 6) {
      const droplet = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 10, 8),
        material("#b9f0f2", 0.05, 0.12),
      );
      droplet.position.set(...points[index]);
      droplet.castShadow = true;
      root.add(droplet);
    }
    const impact = cylinder(
      root,
      0.3,
      0.014,
      [nozzleX + result.rangeM, floor + 0.012, nozzleZ],
      new THREE.MeshStandardMaterial({
        color: "#52bdcc",
        transparent: true,
        opacity: 0.82,
        roughness: 0.12,
      }),
      30,
    );
    impact.name = "jet-impact-marker";
    impact.scale.z = 0.62;
  }

  // The range ruler starts at the nozzle and is marked every 0.1 m to 3 m.
  for (let tick = 0; tick <= 30; tick++)
    box(
      root,
      [0.014, 0.018, tick % 5 === 0 ? 0.3 : 0.16],
      [nozzleX + tick / 10, floor + 0.018, 1.15],
      material(tick % 10 === 0 ? "#f0d092" : "#b9cbca"),
    );
  box(
    root,
    [3.03, 0.025, 0.06],
    [nozzleX + 1.5, floor + 0.014, 1.15],
    steel,
    "range-ruler",
  );
  return { nozzleX, outletY };
}

export function createPressureScene(
  initial: PressureState,
): ExpansionScene<PressureState> {
  const group = new THREE.Group();
  bench(group, 10, 5.8);
  box(
    group,
    [9.1, 0.06, 3.85],
    [0, floor - 0.03, 0.18],
    material("#4c6b73", 0.48, 0.42),
    "spill-tray",
  );
  addHydraulicsLabBackdrop(group);
  let dynamic: THREE.Group | undefined;
  let labels: ExpansionLabel[] = [];
  function update(input: PressureState) {
    const state = normalizePressure(input);
    const result = pressureResult(state);
    dynamic = replaceGroup(group, dynamic);
    addTank(dynamic, state);
    const { nozzleX, outletY } = addOutletAndJet(dynamic, state);
    addPressureGaugePanel(dynamic, result);
    labels = [
      {
        text: `Surface ${state.depthM.toFixed(1)} m`,
        at: [-3.2, floor + state.depthM, 1.1],
        left: 14,
        top: 9,
      },
      {
        text: `Head ${result.headM.toFixed(1)} m`,
        at: [
          tankX - 0.72,
          floor + (state.depthM + Math.min(state.outletM, state.depthM)) / 2,
          1.08,
        ],
        left: 14,
        top: 37,
      },
      {
        text: `${formatVolume(result.volumeLiters)} L`,
        at: [tankX, floor + state.depthM * 0.55, 0.5],
        left: 45,
        top: 9,
      },
      {
        text: `Gauge ${(result.gaugePressurePa / 1_000).toFixed(3)} kPa`,
        at: [2.53, 2.76, -2.08],
        left: 79,
        top: 13,
      },
      {
        text: `Absolute ${(result.absolutePressurePa / 1_000).toFixed(3)} kPa`,
        at: [3.77, 2.76, -2.08],
        left: 79,
        top: 31,
      },
      {
        text: `Net ${result.sensorNetForceN.toFixed(0)} N · 100 cm²`,
        at: [
          tankX + tankWidthAt(state.shape, state.outletM) / 2,
          outletY,
          sensorZ,
        ],
        left: 74,
        top: 49,
      },
      {
        text: result.outletSubmerged
          ? `Ideal jet ${result.jetSpeedMps.toFixed(2)} m/s`
          : "Dry outlet · no jet",
        at: [nozzleX + Math.min(0.7, result.rangeM / 3), outletY, 0.2],
        left: 79,
        top: 68,
      },
      {
        text: `Range ${result.rangeM.toFixed(2)} m`,
        at: [nozzleX + result.rangeM, floor + 0.02, 0.2],
        left: 50,
        top: 91,
      },
      {
        text: `Outlet ${state.outletM.toFixed(1)} m`,
        at: [nozzleX, outletY, 0.2],
        left: 15,
        top: 80,
      },
    ];
  }
  update(initial);
  return {
    group,
    view: {
      position: [9.4, 6.8, 12.5],
      target: [-0.25, 1.62, 0],
      // Desktop remains height-constrained. Portrait becomes pressure-focused,
      // cropping only outer bench/backdrop while retaining tank, jet and impact.
      width: 6.5,
      height: 6.7,
    },
    update,
    labels: () => labels,
    pick(ray) {
      const point = pickPlane(ray, 1.1);
      return point &&
        point.x > -3.48 &&
        point.x < -2.85 &&
        point.y > floor &&
        point.y < floor + 3.12
        ? Math.round(Math.max(0.2, Math.min(3, point.y - floor)) * 10) / 10
        : null;
    },
    dispose: () => disposeTree(group),
  };
}

function formatVolume(liters: number) {
  return liters.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
