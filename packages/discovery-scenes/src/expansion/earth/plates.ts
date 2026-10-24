import * as T from "three";
import {
  initialPlate,
  normalizePlate,
  type PlateState,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import type { ExpansionLabel } from "../types";
import { arrow, box, earthScene, mesh, rock, terrain, tube } from "./geometry";
function build(input: PlateState) {
  const state = normalizePlate(input),
    g = new T.Group(),
    progress = state.movement / 100;
  const divergent = state.boundary === "divergent",
    convergent = state.boundary === "convergent";
  const gap = divergent ? 0.22 + progress * 1.25 : 0.12;
  box(g, [13, 0.7, 8], [0, -2.25, 0], 0x9b3f25);
  box(g, [13, 0.14, 8], [0, -1.83, 0], 0xe27c3f);
  for (const side of [-1, 1]) {
    const plate = new T.Group(),
      cx = side * (3 + gap / 2),
      shift = !divergent && !convergent ? side * state.slips * 0.12 : 0;
    plate.position.set(cx, 0, shift);
    plate.userData.select = side < 0 ? 0 : 1;
    g.add(plate);
    box(plate, [5.8, 0.8, 7.4], [0, -1.28, 0], side < 0 ? 0x554c40 : 0x635442);
    box(plate, [5.8, 0.24, 7.4], [0, -0.76, 0], 0xb69b70);
    box(plate, [5.8, 0.35, 7.4], [0, -0.47, 0], 0x8b7957);
    for (let layer = 0; layer < 5; layer++) {
      const y = -0.9 - layer * 0.15;
      tube(
        plate,
        [
          new T.Vector3(-2.87, y, 3.71),
          new T.Vector3(-1, y + 0.03, 3.71),
          new T.Vector3(1, y - 0.04, 3.71),
          new T.Vector3(2.87, y, 3.71),
        ],
        0x927254,
        0.016,
      );
    }
    const height = (x: number, z: number) => {
      const edge = Math.exp(-((x + side * 2.6) ** 2) / 0.75);
      const base = -0.2 + 0.04 * Math.sin(x * 3.1) * Math.cos(z * 2.3);
      return (
        base +
        (convergent && side === 1
          ? edge * (1.2 + progress * 1.9) * (0.7 + 0.3 * Math.cos(z * 2))
          : divergent
            ? edge * 0.35
            : 0)
      );
    };
    terrain(
      plate,
      5.8,
      7.4,
      height,
      side < 0 && convergent ? 0x7a8d8d : 0x80916a,
    );
    for (let i = 0; i < 38; i++) {
      const x = ((Math.sin(i * 91.7 + 2) * 437.3) % 1) * 2.75,
        z = ((Math.sin(i * 53.1 + 7) * 137.9) % 1) * 3.5;
      rock(
        plate,
        [x, height(x, z) + 0.08, z],
        0.07 + (i % 4) * 0.025,
        0x9a9279,
      );
    }
    if (convergent && side === -1)
      mesh(
        plate,
        new T.PlaneGeometry(5.7, 7.3),
        0x478fa4,
        [0, 0.05, 0],
        0.55,
      ).rotation.x = -Math.PI / 2;
    if (!divergent && !convergent) {
      const roadHeight = -0.06;
      const roadZ = (x: number) =>
        1.7 + side * (state.stress / 60) * 0.45 * ((x + side * 2.9) / 5.8) ** 2;
      const road = tube(
        plate,
        Array.from({ length: 24 }, (_, i) => {
          const x = -2.85 + (i * 5.7) / 23;
          return new T.Vector3(x, roadHeight, roadZ(x));
        }),
        0xc8b18a,
        0.11,
      );
      road.scale.y = 0.2;
      road.position.y = -0.04;
      for (let k = 0; k < 8; k++) {
        const x = -2.5 + k * 0.7;
        box(plate, [0.28, 0.025, 0.025], [x, -0.032, roadZ(x)], 0xf3dfa5);
      }
    }
    const y = 1.4;
    if (divergent || convergent) {
      const direction = divergent ? side : -side;
      arrow(
        g,
        new T.Vector3(cx - direction * 0.6, y, -2),
        new T.Vector3(cx + direction * 0.9, y, -2),
      );
    } else
      arrow(
        g,
        new T.Vector3(cx, y, -side * 0.8),
        new T.Vector3(cx, y, side * 0.9),
      );
  }
  if (divergent) {
    mesh(g, new T.BoxGeometry(gap, 0.25, 7.5), 0xf0a359, [0, -0.23, 0]);
    for (let i = 0; i < 9; i++) {
      const z = -3.2 + i * 0.8;
      rock(g, [Math.sin(i) * gap * 0.25, -0.02, z], 0.16, 0x373d3c);
    }
    arrow(
      g,
      new T.Vector3(0, -1.75, 3.95),
      new T.Vector3(0, -0.4, 3.95),
      0xffc877,
    );
  } else if (convergent) {
    const slab = box(g, [3.4, 0.45, 7.2], [0.8, -1.1, 0], 0x667c80);
    slab.rotation.z = -0.48;
    const exposedSlab = box(g, [3.4, 0.45, 0.18], [0.8, -1.1, 3.86], 0x667c80);
    exposedSlab.rotation.z = -0.48;
    tube(
      g,
      [
        new T.Vector3(-0.15, 0.05, -3.4),
        new T.Vector3(-0.25, -0.25, 0),
        new T.Vector3(-0.15, 0.05, 3.4),
      ],
      0x213b48,
      0.08,
    );
  } else {
    tube(
      g,
      [
        new T.Vector3(0, -0.1, -3.6),
        new T.Vector3(0.08, -0.08, -1),
        new T.Vector3(-0.06, -0.08, 1.5),
        new T.Vector3(0, -0.1, 3.6),
      ],
      0x382b24,
      0.05,
    );
    const stress = state.stress / 60;
    for (let i = 0; i < 6; i++)
      box(
        g,
        [0.1, 0.08 + stress * 0.45, 0.1],
        [0.2, -0.05, i * 0.9 - 2.2],
        0xf2bd63,
      );
    if (state.slips > 0)
      for (let r = 0; r < 3; r++) {
        const ring = mesh(
          g,
          new T.TorusGeometry(0.55 + r * 0.35, 0.025, 6, 56),
          0xffe2a2,
          [0, 0.06, 0],
        );
        ring.rotation.x = -Math.PI / 2;
      }
  }
  const labels: ExpansionLabel[] = [
    { text: "Crust and uppermost mantle", at: [-3, -1.4, 4.05] },
    {
      text: divergent
        ? "New crust at the ridge"
        : convergent
          ? "Trench and subducting slab"
          : "Fault: sideways motion",
      at: [0, 0.3, 3.3],
    },
    {
      text: divergent
        ? "Plates move apart"
        : convergent
          ? "Plates move together"
          : "Stored strain before slip",
      at: [2, 2.8, -2],
    },
    { text: "Hot, slowly deforming mantle", at: [-1, -2.5, 3.8] },
  ];
  return { group: g, labels };
}
export function createMovingPlatesScene(state: PlateState = initialPlate) {
  return earthScene(state, build, {
    position: [13, 11, 17],
    target: [0, 0.1, 0],
    width: 16,
    height: 10,
  });
}
