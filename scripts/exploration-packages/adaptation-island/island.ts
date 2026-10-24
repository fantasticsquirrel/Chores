import * as T from "three";
import type { AdaptationIslandState } from "./model";
import type { ExpansionScene } from "./types";
import { terrain, stone, tree } from "./landscapeGeometry";
import {
  disposeGroup,
  ellipsoid,
  line,
  material,
  mesh,
  rod,
  v,
  rebuild,
} from "./shared";
function beetle(
  group: T.Group,
  x: number,
  z: number,
  dark: boolean,
  rotation: number,
) {
  const body = new T.Group();
  group.add(body);
  body.position.set(x, 0.3, z);
  body.rotation.y = rotation;
  const color = dark ? "#28343f" : "#e1c38f",
    edge = dark ? "#688794" : "#fff0c3";
  ellipsoid(body, [0.19, 0.13, 0.27], color, 0, 0.16, 0);
  ellipsoid(
    body,
    [0.145, 0.1, 0.12],
    dark ? "#394958" : "#a78958",
    0,
    0.14,
    -0.27,
  );
  line(
    body,
    [v(0, 0.27, -0.18), v(0, 0.29, 0.03), v(0, 0.2, 0.25)],
    edge,
    0.009,
  );
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++)
      line(
        body,
        [
          v(side * 0.13, 0.13, -0.14 + i * 0.14),
          v(side * 0.3, 0.1, -0.23 + i * 0.2),
          v(side * 0.34, 0.02, -0.2 + i * 0.2),
        ],
        "#665b48",
        0.014,
      );
    line(
      body,
      [
        v(side * 0.06, 0.2, -0.34),
        v(side * 0.12, 0.24, -0.45),
        v(side * 0.2, 0.24, -0.48),
      ],
      edge,
      0.009,
    );
    ellipsoid(body, [0.025, 0.027, 0.025], "#17242b", side * 0.09, 0.2, -0.32);
  }
}
function bird(group: T.Group, x: number, z: number) {
  const body = new T.Group();
  group.add(body);
  body.position.set(x, 0.8, z);
  body.rotation.y = 1.2;
  ellipsoid(body, [0.31, 0.34, 0.48], "#746b5b", 0, 0.5, 0);
  ellipsoid(body, [0.19, 0.2, 0.23], "#a8997a", 0, 0.88, -0.27);
  for (const side of [-1, 1]) {
    const wing = ellipsoid(
      body,
      [0.08, 0.29, 0.34],
      "#4e514c",
      side * 0.29,
      0.5,
      0.06,
    );
    wing.rotation.x = -0.25;
    ellipsoid(body, [0.03, 0.03, 0.02], "#1c232a", side * 0.16, 0.91, -0.36);
    rod(body, v(side * 0.1, 0.3, 0), v(side * 0.12, 0, 0), 0.02, "#b09568");
  }
  const beak = mesh(
    body,
    new T.ConeGeometry(0.07, 0.24, 5),
    material("#d7b45d"),
    0,
    0.84,
    -0.55,
  );
  beak.rotation.x = -Math.PI / 2;
  const tail = ellipsoid(body, [0.15, 0.05, 0.4], "#4c514d", 0, 0.4, 0.53);
  tail.rotation.x = 0.3;
}
export function createAdaptationIslandScene(
  initial: AdaptationIslandState,
): ExpansionScene<AdaptationIslandState> {
  const group = new T.Group();
  let state = initial;
  const draw = () =>
    rebuild(group, () => {
      const dark = state.habitat === "dark";
      mesh(
        group,
        new T.CylinderGeometry(5.55, 5.65, 0.18, 80),
        material("#355c6c"),
        0,
        -0.36,
      );
      terrain(
        group,
        9.1,
        7.2,
        (x, z) =>
          0.08 +
          0.08 * Math.sin(x * 1.8) * Math.cos(z * 2.1) +
          (Math.abs(x) > 3.7 || Math.abs(z) > 2.7 ? 0.08 : 0),
        (x, z, y) =>
          new T.Color(dark ? "#555b57" : "#c5ad81").multiplyScalar(
            0.9 + Math.sin(x * 5 + z * 2) * 0.08 + y * 0.3,
          ),
        56,
      );
      for (let i = 0; i < 58; i++) {
        const x = Math.sin(i * 12.7) * 4.3,
          z = Math.cos(i * 6.3) * 3.3;
        const pebble = mesh(
          group,
          new T.DodecahedronGeometry(0.045 + (i % 4) * 0.025),
          material(
            dark
              ? i % 3
                ? "#686c60"
                : "#383f42"
              : i % 3
                ? "#e0c698"
                : "#9c8c6c",
          ),
          x,
          0.13,
          z,
        );
        pebble.scale.set(1.6, 0.6, 1);
        pebble.rotation.set(i, 0, i * 0.5);
      }
      const darkSymbols = Math.round(state.darkCount / 5);
      for (let i = 0; i < 20; i++) {
        const column = i % 5,
          row = Math.floor(i / 5),
          x =
            -3.2 +
            column * 1.47 +
            (row % 2) * 0.12 +
            Math.sin(i * 1.3 + state.generation) * 0.11,
          z = -1.95 + row * 1.27 + Math.cos(i * 1.7 + state.generation) * 0.12;
        beetle(group, x, z, i < darkSymbols, Math.sin(i * 2.3) * 1.8);
      }
      for (let i = 0; i < 9; i++) {
        const angle = i * 0.6;
        stone(
          group,
          Math.cos(angle) * 4.2,
          0.13,
          Math.sin(angle) * 3,
          0.12 + (i % 3) * 0.05,
        );
      }
      tree(group, -3.7, 0.15, -2.7, 0.65, true);
      tree(group, 3.9, 0.15, 2.6, 0.58, true);
      for (let i = 0; i < 10; i++) {
        const x = -4.2 + (i % 2) * 8.3,
          z = -2.7 + Math.floor(i / 2) * 1.25;
        for (let j = 0; j < 3; j++)
          rod(
            group,
            v(x, 0.1, z),
            v(x + Math.sin(j) * 0.14, 0.37 + j * 0.04, z + Math.cos(j) * 0.12),
            0.014,
            "#979263",
          );
      }
      if (state.predators) {
        stone(group, 3.55, 0.22, -2.65, 0.72);
        bird(group, 3.55, -2.65);
      }
    });
  draw();
  return {
    group,
    view: { position: [8, 13, 12], target: [0, 0, 0], width: 12.3, height: 9 },
    update(next) {
      state = next;
      draw();
    },
    labels: () => [
      { text: `Generation ${state.generation}`, at: [-2.8, 0.3, -3.7] },
      {
        text: state.habitat === "dark" ? "Dark ground" : "Pale ground",
        at: [0, 0, 3.6],
      },
      {
        text: state.predators ? "Predation included" : "Predation excluded",
        at: [3.5, 1.8, -2.8],
      },
    ],
    dispose() {
      disposeGroup(group);
    },
  };
}
