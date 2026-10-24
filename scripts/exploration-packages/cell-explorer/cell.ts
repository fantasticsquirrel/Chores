import { drawCellTransport } from "./cellTransport";
import * as T from "three";
import { cellParts, type CellExplorerState, type CellPart } from "./model";
import type { ExpansionScene, ExpansionLabel } from "./types";
import {
  disposeGroup,
  ellipsoid,
  line,
  material,
  mesh,
  rod,
  v,
  ring,
  roundedPlate,
  rebuild,
} from "./shared";
export const cellPartOrder: CellPart[] = [
  "membrane",
  "nucleus",
  "mitochondrion",
  "chloroplast",
  "vacuole",
  "wall",
];
const locations: Record<CellPart, [number, number, number]> = {
  membrane: [-4.8, 0.6, 1.6],
  nucleus: [-3.1, 1.3, -0.2],
  mitochondrion: [-2.6, 0.75, 1.5],
  chloroplast: [-0.4, 0.65, -1.35],
  vacuole: [-0.6, 0.85, 0.6],
  wall: [-5.2, 0.1, -1.7],
};
function organelle(
  group: T.Group,
  part: CellPart,
  position: [number, number, number],
  draw: (target: T.Group) => void,
) {
  const target = new T.Group();
  target.position.set(...position);
  target.userData.part = cellPartOrder.indexOf(part);
  group.add(target);
  draw(target);
  target.traverse((item) => {
    item.userData.part = cellPartOrder.indexOf(part);
  });
  return target;
}
function mitochondrion(group: T.Group) {
  ellipsoid(group, [0.68, 0.28, 0.33], "#dc8e47");
  const points = Array.from({ length: 36 }, (_, i) => {
    const x = -0.54 + (i / 35) * 1.08;
    return v(x, 0.22, Math.sin((i / 35) * Math.PI * 8) * 0.16);
  });
  line(group, points, "#763b43", 0.033);
  ring(group, 0, 0.15, 0, 0.55, 0.25, "#f8c96b", 0.025);
}
function chloroplast(group: T.Group) {
  ellipsoid(group, [0.65, 0.24, 0.35], "#398c53");
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 3; j++)
      mesh(
        group,
        new T.CylinderGeometry(0.09, 0.09, 0.035, 12),
        material(j % 2 ? "#94bc5a" : "#b8d67a"),
        -0.4 + i * 0.2,
        0.15 + j * 0.05,
        Math.sin(i * 2) * 0.08,
      );
  line(
    group,
    Array.from({ length: 15 }, (_, i) =>
      v(-0.5 + i / 14, 0.19, 0.14 + Math.sin(i) * 0.02),
    ),
    "#d0e291",
    0.018,
  );
}
function nucleus(group: T.Group) {
  const surface = new T.MeshPhysicalMaterial({
    color: "#9c7fc5",
    roughness: 0.42,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const shell = mesh(group, new T.SphereGeometry(0.8, 32, 24), surface);
  shell.scale.set(1, 0.8, 1);
  ellipsoid(group, [0.23, 0.19, 0.24], "#663f85", 0.15, 0.09, 0.15);
  for (let i = 0; i < 5; i++)
    line(
      group,
      Array.from({ length: 20 }, (_, j) =>
        v(
          Math.sin(j * 0.6 + i) * 0.48,
          (i - 2) * 0.13,
          Math.cos(j * 0.36 + i) * 0.45,
        ),
      ),
      "#d9badf",
      0.024,
    );
  for (let i = 0; i < 12; i++)
    ellipsoid(
      group,
      [0.07, 0.035, 0.07],
      "#d8c6ec",
      Math.cos((i * Math.PI) / 6) * 0.68,
      0.3,
      Math.sin((i * Math.PI) / 6) * 0.68,
    );
}
export function createCellExplorerScene(
  initial: CellExplorerState,
): ExpansionScene<CellExplorerState> {
  const group = new T.Group();
  let state = initial;
  const draw = () =>
    rebuild(group, () => {
      const plant = state.cellType === "plant",
        body = new T.Group();
      group.add(body);
      body.position.x = -2.1;
      if (plant) {
        const wall = roundedPlate(body, 6.1, 4.6, 0.35, "#668260", 0, -0.4);
        wall.userData.part = 5;
        const membrane = roundedPlate(
          body,
          5.82,
          4.32,
          0.12,
          "#c2bd81",
          0,
          -0.03,
        );
        membrane.userData.part = 0;
        roundedPlate(body, 5.55, 4.06, 0.08, "#629a91", 0, 0.08);
        for (let i = 0; i < 28; i++) {
          const x = -2.5 + (i % 14) * 0.39,
            z = i < 14 ? -2.22 : 2.22;
          rod(body, v(x, -0.35, z), v(x, 0.02, z), 0.025, "#9cb27d");
        }
      } else {
        const bowl = mesh(
          body,
          new T.SphereGeometry(
            1,
            48,
            24,
            0,
            Math.PI * 2,
            Math.PI / 2,
            Math.PI / 2,
          ),
          material("#749c9b"),
          0,
          0.15,
        );
        bowl.scale.set(3, 0.7, 2.15);
        bowl.userData.part = 0;
        const border = ring(body, 0, 0.15, 0, 3, 2.15, "#d2bc97", 0.1);
        border.userData.part = 0;
        ellipsoid(body, [2.8, 0.16, 2], "#618d89", 0, -0.3);
      }
      organelle(group, "nucleus", [-3.2, 0.6, -0.25], nucleus);
      organelle(group, "mitochondrion", [-2.6, 0.35, 1.45], mitochondrion);
      const other = organelle(
        group,
        "mitochondrion",
        [-4.3, 0.3, -1.15],
        mitochondrion,
      );
      other.rotation.y = 0.75;
      if (plant) {
        organelle(group, "chloroplast", [-0.5, 0.35, -1.25], chloroplast);
        const second = organelle(
          group,
          "chloroplast",
          [-3.2, 0.35, -1.55],
          chloroplast,
        );
        second.scale.setScalar(0.7);
        organelle(group, "vacuole", [-0.85, 0.45, 0.45], (target) => {
          const vac = mesh(
            target,
            new T.SphereGeometry(1, 40, 24),
            new T.MeshPhysicalMaterial({
              color: "#80c5d4",
              roughness: 0.27,
              transparent: true,
              opacity: 0.72,
            }),
          );
          vac.scale.set(1.15, 0.52, 1.05);
          ring(target, 0, 0.35, 0, 0.84, 0.74, "#c6f0ed", 0.025);
        });
      } else
        for (let i = 0; i < 3; i++)
          ellipsoid(
            group,
            [0.18, 0.16, 0.2],
            "#89bfcd",
            -0.5 + i * 0.42,
            0.12,
            0.6 - i * 0.4,
          );
      for (let i = 0; i < 5; i++)
        line(
          group,
          Array.from({ length: 24 }, (_, j) =>
            v(
              -3.1 + Math.cos((j / 23) * Math.PI) * 1.1,
              0.18 + i * 0.045,
              -0.2 + Math.sin((j / 23) * Math.PI) * (0.75 + i * 0.1),
            ),
          ),
          "#797eb6",
          0.055,
        );
      for (let i = 0; i < 4; i++)
        line(
          group,
          Array.from({ length: 16 }, (_, j) =>
            v(
              -1.9 + j * 0.06,
              0.25 + i * 0.08,
              -1.25 + Math.sin((j / 15) * Math.PI) * 0.18,
            ),
          ),
          "#d1a4ab",
          0.05,
        );
      for (let i = 0; i < 45; i++) {
        const angle = i * 2.4,
          radius = 1.2 + (i % 7) * 0.18;
        const x = -2.1 + Math.cos(angle) * radius,
          z = Math.sin(angle) * radius * 0.73;
        ellipsoid(group, [0.035, 0.035, 0.035], "#dfd6bd", x, 0.22, z);
      }
      if (plant || !cellParts[state.selected].plantOnly) {
        const p = locations[state.selected];
        ring(group, p[0], p[1] - 0.1, p[2], 0.4, 0.4, "#ffde8b", 0.025);
      }
      drawCellTransport(group, state);
    });
  draw();
  return {
    group,
    view: {
      position: [9, 13, 15],
      target: [0, 0, 0],
      width: 13.5,
      height: 7.5,
    },
    update(next) {
      state = next;
      draw();
    },
    labels() {
      const labels: ExpansionLabel[] = [
        {
          text:
            state.cellType === "plant"
              ? "Photosynthetic plant cell"
              : "Animal cell",
          at: [-2.2, 0, -2.7],
        },
        { text: `Outside ${state.outside.toFixed(1)}`, at: [3.2, 0, 2.5] },
        { text: `Inside ${state.inside.toFixed(1)}`, at: [5.1, 0, 2.5] },
        {
          text: state.carrier ? "Membrane + carrier" : "Cell membrane",
          at: [4.1, 0.4, -2.4],
        },
      ];
      if (state.cellType === "plant" || !cellParts[state.selected].plantOnly)
        labels.push({
          text: cellParts[state.selected].name,
          at: locations[state.selected],
        });
      return labels;
    },
    pick(ray) {
      const hit = ray
        .intersectObject(group, true)
        .find((item) => typeof item.object.userData.part === "number");
      return hit ? Number(hit.object.userData.part) : null;
    },
    dispose() {
      disposeGroup(group);
    },
  };
}
