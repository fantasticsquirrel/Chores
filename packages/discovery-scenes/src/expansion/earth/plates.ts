import * as T from "three";
import {
  defaultPlateState,
  FAULT_SLIP_LIMIT,
  normalizePlate,
  plateResult,
  type PlateState,
} from "@family-manager/family-api/discovery-models/moving-plates";
import type { ExpansionLabel } from "../types";
import {
  arrow,
  box,
  earthScene,
  material,
  mesh,
  rock,
  terrain,
  tube,
} from "./geometry";

const FRONT_Z = 3.72;

function named<TObject extends T.Object3D>(object: TObject, name: string) {
  object.name = name;
  return object;
}

function addAsthenosphere(group: T.Group) {
  named(
    box(group, [13.6, 1.35, 8.2], [0, -2.5, 0], 0xb94e32),
    "solid-asthenosphere",
  );
  box(group, [13.7, 0.12, 8.25], [0, -1.79, 0], 0xe77a46);
  for (let row = 0; row < 4; row += 1) {
    const y = -2.2 - row * 0.22;
    tube(
      group,
      Array.from({ length: 25 }, (_, index) => {
        const x = -6.2 + index * 0.52;
        return new T.Vector3(
          x,
          y + Math.sin(x * 0.9 + row) * 0.07,
          FRONT_Z + 0.36,
        );
      }),
      row % 2 ? 0xf1a266 : 0x7f3027,
      0.025,
    );
  }
  for (let index = 0; index < 18; index += 1)
    rock(
      group,
      [
        -5.8 + ((index * 47) % 116) / 10,
        -2.35 + (index % 4) * 0.17,
        -3.3 + ((index * 31) % 66) / 10,
      ],
      0.08 + (index % 3) * 0.025,
      index % 2 ? 0x8d382c : 0xd5623d,
    );
}

function addOceanicPlate(
  root: T.Group,
  side: -1 | 1,
  centerX: number,
  width: number,
  surfaceHeight: (x: number, z: number) => number,
  shiftZ = 0,
) {
  const plate = new T.Group();
  plate.position.set(centerX, 0, shiftZ);
  plate.userData.select = side < 0 ? 0 : 1;
  named(
    plate,
    side < 0 ? "left-oceanic-lithosphere" : "right-oceanic-lithosphere",
  );
  root.add(plate);
  box(plate, [width, 0.75, 7.35], [0, -1.3, 0], 0x3f4c50);
  box(plate, [width, 0.2, 7.38], [0, -0.81, 0], 0x78837e);
  box(plate, [width, 0.18, 7.4], [0, -0.61, 0], 0xa68c67);
  for (let layer = 0; layer < 4; layer += 1)
    tube(
      plate,
      [
        new T.Vector3(-width / 2 + 0.04, -0.94 - layer * 0.14, FRONT_Z),
        new T.Vector3(0, -0.91 - layer * 0.14, FRONT_Z),
        new T.Vector3(width / 2 - 0.04, -0.95 - layer * 0.14, FRONT_Z),
      ],
      layer % 2 ? 0x6f6759 : 0x9b7555,
      0.018,
    );
  named(
    terrain(plate, width, 7.35, surfaceHeight, 0x5d746c),
    side < 0 ? "left-oceanic-surface" : "right-oceanic-surface",
  );
  for (let index = 0; index < 22; index += 1) {
    const x = -width / 2 + 0.25 + ((index * 79) % 100) * ((width - 0.5) / 100);
    const z = -3.35 + ((index * 43) % 67) / 10;
    rock(
      plate,
      [x, surfaceHeight(x, z) + 0.055, z],
      0.06 + (index % 4) * 0.018,
      index % 3 ? 0x7d8275 : 0x9c8d72,
    );
  }
  return plate;
}

function addContinentalPlate(
  root: T.Group,
  centerX: number,
  width: number,
  surfaceHeight: (x: number, z: number) => number,
  shiftZ = 0,
) {
  const plate = new T.Group();
  plate.position.set(centerX, 0, shiftZ);
  root.add(plate);
  box(plate, [width, 0.85, 7.35], [0, -1.22, 0], 0x5a4b3e);
  box(plate, [width, 0.38, 7.38], [0, -0.58, 0], 0xa48863);
  box(plate, [width, 0.22, 7.4], [0, -0.27, 0], 0xc6aa75);
  for (let layer = 0; layer < 5; layer += 1)
    tube(
      plate,
      [
        new T.Vector3(-width / 2 + 0.04, -0.68 - layer * 0.14, FRONT_Z),
        new T.Vector3(-0.4, -0.65 - layer * 0.14, FRONT_Z),
        new T.Vector3(width / 2 - 0.04, -0.7 - layer * 0.14, FRONT_Z),
      ],
      layer % 2 ? 0x725844 : 0xa47752,
      0.018,
    );
  terrain(plate, width, 7.35, surfaceHeight, 0x71835b);
  for (let index = 0; index < 26; index += 1) {
    const x = -width / 2 + 0.25 + ((index * 73) % 100) * ((width - 0.5) / 100);
    const z = -3.3 + ((index * 37) % 66) / 10;
    rock(
      plate,
      [x, surfaceHeight(x, z) + 0.07, z],
      0.07 + (index % 4) * 0.025,
      index % 3 ? 0x8b876c : 0xaaa07b,
    );
  }
  return plate;
}

function addWater(
  group: T.Group,
  width: number,
  centerX: number,
  y: number,
  z = 0,
  name = "ocean-water",
) {
  const water = new T.Mesh(
    new T.PlaneGeometry(width, 7.15),
    material(0x2d91ad, 0.25, 0.58),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(centerX, y, z);
  water.receiveShadow = true;
  water.name = name;
  group.add(water);
  for (let index = 0; index < 7; index += 1)
    tube(
      group,
      [
        new T.Vector3(centerX - width / 2 + 0.2, y + 0.012, -3 + index),
        new T.Vector3(centerX, y + 0.02, -2.94 + index),
        new T.Vector3(centerX + width / 2 - 0.2, y + 0.012, -3 + index),
      ],
      0x8bcbd2,
      0.012,
    );
  return water;
}

function addMotionArrow(
  group: T.Group,
  name: string,
  start: T.Vector3,
  end: T.Vector3,
) {
  const motion = arrow(group, start, end, 0xffd17d, 1.3);
  motion.name = name;
  return motion;
}

function buildDivergent(group: T.Group, progress: number) {
  const gap = 0.38 + progress * 1.55;
  const width = (12.45 - gap) / 2;
  for (const side of [-1, 1] as const) {
    const centerX = side * (gap / 2 + width / 2);
    const surface = (x: number, z: number) => {
      const boundaryX = side < 0 ? width / 2 : -width / 2;
      const ridge = Math.exp(-((x - boundaryX) ** 2) / 0.42);
      return -0.4 + ridge * 0.38 + Math.sin(x * 2.8 + z * 1.7) * 0.03;
    };
    addOceanicPlate(group, side, centerX, width, surface);
    addWater(group, width - 0.15, centerX, 0.17);
    addMotionArrow(
      group,
      side < 0 ? "boundary-motion-left" : "boundary-motion-right",
      new T.Vector3(centerX - side * 0.2, 1.28, -2.05),
      new T.Vector3(centerX + side * 1.45, 1.28, -2.05),
    );
  }
  addWater(group, gap + 0.24, 0, 0.17, 0, "ridge-ocean-water");
  named(
    box(group, [gap + 0.1, 0.32, 7.45], [0, -0.43, 0], 0x30383a),
    "new-oceanic-crust",
  );
  const melt = mesh(
    group,
    new T.CylinderGeometry(0.18 + gap * 0.12, 0.7, 1.72, 18),
    0xf18b45,
    [0, -1.2, 0],
    0.88,
  );
  melt.name = "localized-ridge-melt";
  for (let index = 0; index < 11; index += 1)
    rock(
      group,
      [Math.sin(index * 2.1) * gap * 0.22, -0.08, -3.1 + index * 0.62],
      0.12 + (index % 3) * 0.035,
      index % 2 ? 0x2f3636 : 0x754032,
    );
  arrow(
    group,
    new T.Vector3(0, -1.75, FRONT_Z + 0.32),
    new T.Vector3(0, -0.55, FRONT_Z + 0.32),
    0xffa45d,
    1.15,
  ).name = "localized-melt-rise";
}

function addVolcano(group: T.Group, x: number, z: number, scale: number) {
  const cone = mesh(
    group,
    new T.ConeGeometry(0.42 * scale, 1.1 * scale, 18),
    0x705348,
    [x, 0.73 * scale, z],
  );
  cone.name = "volcanic-arc-cone";
  mesh(
    group,
    new T.ConeGeometry(0.13 * scale, 0.2 * scale, 16, 1, true),
    0xd47d4d,
    [x, 1.29 * scale, z],
  );
}

const SUBDUCTING_SLAB_PATH: readonly [number, number][] = [
  [-0.18, -1.06],
  [0.32, -1.28],
  [0.95, -1.78],
  [1.75, -2.28],
  [2.85, -2.62],
];

function addSubductingSlab(
  group: T.Group,
  depth: number,
  z: number,
  exposed: boolean,
) {
  for (let index = 0; index < SUBDUCTING_SLAB_PATH.length - 1; index += 1) {
    const [x1, y1] = SUBDUCTING_SLAB_PATH[index];
    const [x2, y2] = SUBDUCTING_SLAB_PATH[index + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) + 0.06;
    const angle = Math.atan2(dy, dx);
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const prefix = exposed ? "exposed-subducting" : "subducting";
    const mantle = named(
      box(group, [length, 0.62, depth], [centerX, centerY, z], 0x35474e),
      index === 0
        ? `${prefix}-oceanic-lithosphere`
        : `${prefix}-oceanic-lithosphere-${index + 1}`,
    );
    mantle.rotation.z = angle;
    const crustOffset = 0.38;
    const crust = named(
      box(
        group,
        [length + 0.03, 0.13, depth + 0.03],
        [
          centerX - Math.sin(angle) * crustOffset,
          centerY + Math.cos(angle) * crustOffset,
          z + 0.01,
        ],
        0x91a09a,
      ),
      index === 0
        ? `${prefix}-oceanic-crust`
        : `${prefix}-oceanic-crust-${index + 1}`,
    );
    crust.rotation.z = angle;
  }
}

function buildConvergent(group: T.Group, progress: number) {
  const oceanWidth = 6.25;
  const continentWidth = 6.25;
  const oceanCenter = -3.25;
  const continentCenter = 3.25;
  const oceanSurface = (x: number, z: number) =>
    -0.32 -
    Math.exp(-((x - oceanWidth / 2) ** 2) / 0.18) * 0.32 +
    Math.sin(x * 2.5 + z * 1.4) * 0.025;
  addOceanicPlate(group, -1, oceanCenter, oceanWidth, oceanSurface);
  addWater(group, oceanWidth - 0.12, oceanCenter, 0.18);
  const mountainGain = 0.62 + progress * 1.35;
  const continentSurface = (x: number, z: number) => {
    const arc = Math.exp(-((x + continentWidth / 2 - 1.35) ** 2) / 0.65);
    return (
      0.02 +
      arc * mountainGain * (0.78 + Math.cos(z * 1.8) * 0.22) +
      Math.sin(x * 2.2 - z * 1.6) * 0.04
    );
  };
  addContinentalPlate(
    group,
    continentCenter,
    continentWidth,
    continentSurface,
  ).name = "continental-lithosphere";

  addSubductingSlab(group, 7.28, 0, false);
  // This narrow front cutaway repeats the same curved path so the plate ->
  // trench -> descending slab relationship remains visible in the default view.
  addSubductingSlab(group, 0.54, 3.98, true);
  tube(
    group,
    [
      new T.Vector3(-0.45, -0.02, FRONT_Z + 0.08),
      new T.Vector3(-0.28, -0.37, FRONT_Z + 0.08),
      new T.Vector3(0.22, -0.68, FRONT_Z + 0.08),
    ],
    0x142a31,
    0.095,
  ).name = "ocean-trench";
  for (const [index, z] of [-2.25, 0, 2.25].entries())
    addVolcano(group, 1.6 + index * 0.08, z, 0.72 + index * 0.08);
  for (let index = 0; index < 7; index += 1)
    mesh(
      group,
      new T.SphereGeometry(0.09 + (index % 3) * 0.035, 12, 8),
      0xf38c4b,
      [
        0.58 + index * 0.17,
        -1.25 + index * 0.1,
        index < 4 ? FRONT_Z + 0.58 : -0.6 + (index % 3) * 0.6,
      ],
      0.75,
    ).name = "localized-mantle-wedge-melt";
  addMotionArrow(
    group,
    "boundary-motion-left",
    new T.Vector3(-4.1, 1.35, -2.1),
    new T.Vector3(-2.45, 1.35, -2.1),
  );
  addMotionArrow(
    group,
    "boundary-motion-right",
    new T.Vector3(4.15, 1.35, -2.1),
    new T.Vector3(2.5, 1.35, -2.1),
  );
}

function buildTransform(state: PlateState, group: T.Group) {
  const result = plateResult(state);
  const loading = result.elasticLoadingPercent / 100;
  const slipOffset =
    result.markerOffsetSteps === 0
      ? 0
      : 0.24 + ((result.markerOffsetSteps - 1) / (FAULT_SLIP_LIMIT - 1)) * 0.91;
  for (const side of [-1, 1] as const) {
    const centerX = side * 3.18;
    const shiftZ = side * slipOffset;
    const surface = (x: number, z: number) =>
      0.02 + Math.sin(x * 2.2 + z * 1.7) * 0.045;
    const plate = addContinentalPlate(group, centerX, 6.15, surface, shiftZ);
    plate.name =
      side < 0 ? "left-transform-lithosphere" : "right-transform-lithosphere";
    plate.userData.select = side < 0 ? 0 : 1;
    const roadZ = (x: number) => {
      const distanceToFault = side < 0 ? x - 3.05 : x + 3.05;
      return (
        1.58 - side * loading * 0.48 * Math.exp(-(distanceToFault ** 2) / 1.1)
      );
    };
    tube(
      plate,
      Array.from({ length: 28 }, (_, index) => {
        const x = -2.95 + (index * 5.9) / 27;
        return new T.Vector3(x, surface(x, roadZ(x)) + 0.08, roadZ(x));
      }),
      0xd9c59e,
      0.15,
    ).name = side < 0 ? "marker-road-left" : "marker-road-right";
    for (let index = 0; index < 9; index += 1) {
      const x = -2.6 + index * 0.65;
      box(
        plate,
        [0.28, 0.035, 0.035],
        [x, surface(x, roadZ(x)) + 0.14, roadZ(x)],
        0xffedb2,
      );
    }
    addMotionArrow(
      group,
      side < 0 ? "boundary-motion-left" : "boundary-motion-right",
      new T.Vector3(centerX, 1.35, side < 0 ? 0.75 : -0.75),
      new T.Vector3(centerX, 1.35, side < 0 ? -1.15 : 1.15),
    );
  }
  tube(
    group,
    [
      new T.Vector3(0, 0.03, -3.62),
      new T.Vector3(0.06, 0.04, -1.4),
      new T.Vector3(-0.05, 0.03, 1.1),
      new T.Vector3(0, 0.03, 3.62),
    ],
    0x17242a,
    0.075,
  ).name = "transform-fault";
  for (let index = 0; index < 6; index += 1)
    box(
      group,
      [0.12, 0.08 + loading * 0.36, 0.12],
      [0.22, 0.1, -2.5 + index],
      0xf3b75f,
    );
  for (let index = 0; index < state.slips; index += 1) {
    const column = index % 10;
    const row = Math.floor(index / 10);
    named(
      box(
        group,
        [0.1, 0.08, 0.22],
        [-0.62 + column * 0.14, 0.18 + row * 0.12, FRONT_Z + 0.28],
        row === 0 ? 0xffd17d : 0xf29a62,
      ),
      `illustrated-slip-tally-${index + 1}`,
    );
  }
  if (state.slips > 0 && state.loadingStep === 0)
    for (let radius = 0.45; radius <= 1.25; radius += 0.4) {
      const ring = mesh(
        group,
        new T.TorusGeometry(radius, 0.024, 7, 56),
        0xffdfa0,
        [0, 0.18, 0],
      );
      ring.rotation.x = -Math.PI / 2;
      ring.name = "illustrated-slip-wave";
    }
}

function build(input: PlateState) {
  const state = normalizePlate(input);
  const result = plateResult(state);
  const group = new T.Group();
  const progress = Math.min(1, result.relativeMotionKm / 500);
  addAsthenosphere(group);
  if (state.boundary === "divergent") buildDivergent(group, progress);
  else if (state.boundary === "convergent") buildConvergent(group, progress);
  else buildTransform(state, group);

  const common: ExpansionLabel = {
    text: "Asthenosphere · solid rock, slow flow",
    at: [-1.4, -2.35, FRONT_Z + 0.36],
    left: 50,
    top: 91,
  };
  const labels: ExpansionLabel[] =
    state.boundary === "divergent"
      ? [
          {
            text: "Oceanic lithosphere",
            at: [-3.35, -0.95, FRONT_Z],
            left: 16,
            top: 77,
          },
          {
            text: "New oceanic crust",
            at: [0, -0.28, 2.8],
            left: 50,
            top: 17,
          },
          {
            text: "Plates move apart",
            at: [3.8, 1.25, -2.05],
            left: 82,
            top: 13,
          },
          {
            text: "Localized melt",
            at: [0, -1.05, FRONT_Z + 0.25],
            left: 82,
            top: 69,
          },
          common,
        ]
      : state.boundary === "convergent"
        ? [
            {
              text: "Oceanic lithosphere",
              at: [-3.4, -0.95, FRONT_Z],
              left: 15,
              top: 77,
            },
            {
              text: "Trench",
              at: [-0.3, -0.18, 2.9],
              left: 27,
              top: 16,
            },
            {
              text: "Subducting oceanic lithosphere",
              at: [0.8, -1.25, FRONT_Z],
              left: 50,
              top: 75,
            },
            {
              text: "Continental lithosphere",
              at: [3.45, -0.7, FRONT_Z],
              left: 82,
              top: 73,
            },
            {
              text: "Volcanic arc · mantle-wedge melt",
              at: [1.65, 1.15, 0],
              left: 77,
              top: 15,
            },
            common,
          ]
        : [
            {
              text: "Lithosphere",
              at: [-3.2, -0.85, FRONT_Z],
              left: 16,
              top: 77,
            },
            {
              text: "Locked transform fault",
              at: [0, 0.05, 2.6],
              left: 50,
              top: 15,
            },
            {
              text: `${result.elasticLoadingPercent}% invented loading index`,
              at: [0.22, 0.55, -1.2],
              left: 82,
              top: 18,
            },
            {
              text:
                state.slips > 0 && state.loadingStep === 0
                  ? "Marker offset after illustrated slip"
                  : "Surface marker bends while locked",
              at: [0, 0.22, 1.6],
              left: 82,
              top: 68,
            },
            common,
          ];
  return { group, labels };
}

export function createMovingPlatesScene(state: PlateState = defaultPlateState) {
  return earthScene(state, build, {
    position: [12.5, 9.3, 15.2],
    target: [0, -0.45, 0],
    width: 14.2,
    height: 9.1,
  });
}
