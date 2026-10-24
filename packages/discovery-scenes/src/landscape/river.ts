import * as T from "three";
import {
  box,
  line,
  material,
  mesh,
  noise,
  ribbon,
  stone,
  terrain,
  tree,
  v,
  type BuiltLandscape,
} from "./geometry";
import type { RiverSceneState } from "./state";
export const riverCenter = (x: number) =>
  Math.sin(x * 0.6) * 1.3 + Math.sin(x * 1.3) * 0.32;
export function buildRiver(state: RiverSceneState): BuiltLandscape {
  const group = new T.Group();
  const grade = state.slope / 90,
    loss = (5000 - state.soil) / 5000;
  const bed = (x: number) => 0.05 + (6 - x) * grade;
  const surface = (x: number, z: number) => {
    const distance = Math.abs(z - riverCenter(x));
    const valley = Math.min(1, Math.max(0, distance - 0.6) / 3);
    return (
      bed(x) +
      valley * (1.2 + Math.cos(x * 0.3) * 0.6) +
      noise(x, z) * 0.08 * valley -
      (distance < 0.8 ? loss * 0.23 : 0)
    );
  };
  box(group, [14, 0.5, 9], "#6d5340", 0, -0.26, 0);
  for (let i = 0; i < 3; i++)
    box(
      group,
      [14.02, 0.035, 9.02],
      i % 2 ? "#c19b6b" : "#936f4c",
      0,
      -0.1 - i * 0.13,
      0,
    );
  terrain(group, 14, 9, surface, (x, z) => {
    const distance = Math.abs(z - riverCenter(x));
    const soil = new T.Color("#aa8e61"),
      grass = new T.Color("#72814b");
    return soil
      .lerp(grass, distance > 1 ? (state.vegetation / 100) * 0.9 : 0.1)
      .multiplyScalar(0.93 + noise(x, z) * 0.1);
  });
  const points = Array.from({ length: 101 }, (_, i) => {
    const x = -7 + i * 0.14;
    return v(x, bed(x) + 0.045, riverCenter(x));
  });
  ribbon(group, points, 0.85 + loss * 0.3, material("#c8af77"));
  const waterPoints = points.map((p) => p.clone().add(v(0, 0.035, 0)));
  if (state.runoff > 0) {
    const water = ribbon(
      group,
      waterPoints,
      0.28 + Math.min(0.63, state.runoff / 900),
      new T.MeshStandardMaterial({
        color: state.eroded > 200 ? "#638c88" : "#4e9ca1",
        roughness: 0.22,
        metalness: 0.2,
      }),
    );
    water.name = "channel-water";
    for (let i = 6; i < 94; i += 7) {
      const p = waterPoints[i],
        d = waterPoints[i + 2].clone().sub(p).normalize();
      line(
        group,
        [
          p.clone().add(v(-0.1, 0.025, -0.12)),
          p.clone().add(v(0.13, 0.025, 0)),
          p.clone().add(v(-0.1, 0.025, 0.12)),
        ].map((q) => q.addScaledVector(d, 0.03)),
        "#c9e7da",
        0.014,
      );
    }
  }
  if (state.flood > 0) {
    const flood = ribbon(
      group,
      points.map((p) => p.clone().add(v(0, 0.12, 0))),
      1.15 + state.flood / 320,
      new T.MeshStandardMaterial({
        color: "#6fb5ba",
        transparent: true,
        opacity: 0.37,
        roughness: 0.28,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    flood.name = "floodwater";
    for (const side of [-1, 1])
      line(
        group,
        points
          .filter((_, i) => i > 2 && i < 97)
          .map((p) =>
            v(p.x, bed(p.x) + 0.14, p.z + side * (0.58 + state.flood / 640)),
          ),
        "#b5d6c4",
        0.015,
      );
  }
  const deposition = new T.Group();
  deposition.name = "deposited-sediment";
  group.add(deposition);
  for (let i = 0; i < Math.min(70, Math.ceil(state.deposited / 9)); i++) {
    const x = 2 + (i % 13) * 0.29,
      z = riverCenter(x) + 0.48 + Math.sin(i * 7) * 0.14;
    const grain = mesh(
      deposition,
      new T.DodecahedronGeometry(0.06 + (i % 3) * 0.025),
      material("#d9bf83"),
      x,
      surface(x, z) + 0.07,
      z,
    );
    grain.scale.y = 0.55;
  }
  for (let i = 0; i < Math.floor(state.vegetation * 0.65); i++) {
    const x = -6.5 + ((i * 2.137) % 13),
      z = -4.1 + ((i * 1.729) % 8.2);
    if (Math.abs(z - riverCenter(x)) < 1.6) continue;
    tree(group, x, surface(x, z), z, 0.4 + (i % 4) * 0.07, i % 3 === 0);
  }
  for (let i = 0; i < 25; i++) {
    const x = -6.8 + i * 0.55,
      z = riverCenter(x) - 0.8 - (i % 2) * 0.17;
    stone(group, x, surface(x, z) + 0.03, z, 0.09);
  }
  for (let i = 0; i < Math.floor(state.rain / 2); i++) {
    const x = -5.8 + ((i * 1.71) % 11.8),
      z = -3.7 + ((i * 1.3) % 7.2),
      y = surface(x, z) + 1 + (i % 4) * 0.32;
    line(group, [v(x, y, z), v(x + 0.1, y - 0.3, z)], "#9dc8d1", 0.012);
  }
  return {
    group,
    labels: [
      { text: "Upstream", x: -5, y: bed(-5) + 0.5, z: riverCenter(-5) },
      {
        text: "Sediment deposits",
        x: 3.5,
        y: bed(3.5) + 0.5,
        z: riverCenter(3.5) + 0.9,
      },
      {
        text: "Downstream outlet",
        x: 6.1,
        y: bed(6.1) + 0.35,
        z: riverCenter(6.1),
      },
    ],
  };
}
