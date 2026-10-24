import * as T from "three";
import {
  box,
  ellipsoid,
  line,
  material,
  mesh,
  noise,
  ribbon,
  rod,
  terrain,
  tree,
  v,
  type BuiltLandscape,
} from "./geometry";
import type { CaravanSceneState } from "./state";
const routePoints = {
  ridge: [
    [-5.9, 1.7],
    [-4.5, -1.7],
    [-2.5, -2.1],
    [0, -2.2],
    [2.4, -1.7],
    [5.8, 1.4],
  ],
  river: [
    [-5.9, 1.7],
    [-3.1, 1.2],
    [-0.7, 0.6],
    [1.7, 0.4],
    [3.8, 0.8],
    [5.8, 1.4],
  ],
  oasis: [
    [-5.9, 1.7],
    [-3.8, 3.2],
    [-1, 3.3],
    [1.5, 3.1],
    [4, 2.5],
    [5.8, 1.4],
  ],
};
function village(group: T.Object3D, x: number, z: number) {
  for (let i = 0; i < 8; i++) {
    const xx = x + (i % 3) * 0.38 - 0.4,
      zz = z + Math.floor(i / 3) * 0.33 - 0.3,
      h = 0.35 + (i % 2) * 0.2;
    box(group, [0.32, h, 0.3], "#d0b481", xx, 0.25 + h / 2, zz);
    const roof = mesh(
      group,
      new T.ConeGeometry(0.25, 0.18, 4),
      material("#9c6145"),
      xx,
      0.25 + h + 0.08,
      zz,
    );
    roof.rotation.y = Math.PI / 4;
    box(group, [0.08, 0.17, 0.02], "#534737", xx, 0.34, zz + 0.155);
  }
  box(group, [1.7, 0.1, 1.5], "#bd9b67", x, 0.17, z);
}
function camel(
  group: T.Object3D,
  x: number,
  y: number,
  z: number,
  color: string,
  packs: number,
) {
  const animal = new T.Group();
  animal.position.set(x, y, z);
  animal.rotation.y = -0.4;
  group.add(animal);
  ellipsoid(animal, [0.36, 0.17, 0.17], "#bd976a", 0, 0.4, 0);
  ellipsoid(animal, [0.14, 0.18, 0.15], "#c5a275", -0.12, 0.55, 0);
  for (const xx of [-0.22, 0.22])
    for (const zz of [-0.1, 0.1])
      rod(animal, v(xx, 0.38, zz), v(xx - 0.06, 0.02, zz), 0.026, "#ab8357");
  rod(animal, v(0.24, 0.4, 0), v(0.38, 0.78, 0), 0.065, "#bd976a");
  ellipsoid(animal, [0.14, 0.08, 0.07], "#c9aa7f", 0.46, 0.78, 0);
  box(animal, [0.42, 0.05, 0.36], color, -0.08, 0.54, 0);
  for (let i = 0; i < Math.min(5, packs); i++)
    box(animal, [0.075, 0.17, 0.15], color, -0.24 + i * 0.08, 0.65, 0);
}
export function buildCaravan(state: CaravanSceneState): BuiltLandscape {
  const group = new T.Group();
  const elevation = (x: number, z: number) => {
    const ridge = Math.exp(-Math.pow((z + 2.9) / 1.13, 2));
    return (
      0.18 +
      ridge * (1.1 + Math.pow(Math.sin(x * 1.18), 2) * 1.2) +
      Math.max(0, z - 1.8) * 0.05 +
      noise(x, z) * 0.035
    );
  };
  box(group, [14, 0.5, 9], "#9c7952", 0, -0.12, 0);
  box(group, [14.05, 0.06, 9.05], "#cfb583", 0, -0.31, 0);
  terrain(group, 14, 9, elevation, (x, z, y) =>
    new T.Color(
      y > 1.65
        ? state.season === "wet"
          ? "#c1c1ae"
          : "#aaa18a"
        : z < -1
          ? "#968c68"
          : "#cfb27d",
    ).multiplyScalar(0.93 + noise(x, z) * 0.08),
  );
  const waterPath = Array.from({ length: 80 }, (_, i) => {
    const x = -7 + (i * 14) / 79;
    return v(x, 0.24, Math.sin(x * 0.54) * 0.48 - 0.1);
  });
  ribbon(
    group,
    waterPath,
    state.season === "wet" ? 0.62 : 0.23,
    new T.MeshStandardMaterial({
      color: "#4f929b",
      roughness: 0.22,
      metalness: 0.18,
    }),
  );
  for (const [key, coords] of Object.entries(routePoints)) {
    const curve = new T.CatmullRomCurve3(
      coords.map(([x, z]) => v(x, elevation(x, z) + 0.12, z)),
    );
    const points = curve
      .getPoints(100)
      .map((p) => v(p.x, elevation(p.x, p.z) + 0.09, p.z));
    line(
      group,
      points,
      key === state.route ? "#fae6a2" : "#aa8459",
      key === state.route ? 0.064 : 0.027,
    ).name = key === state.route ? `selected-${key}` : `route-${key}`;
    if (key === state.route)
      for (let i = 4; i < 98; i += 5)
        mesh(
          group,
          new T.SphereGeometry(0.045, 6, 4),
          material("#fff1c4"),
          points[i].x,
          points[i].y + 0.04,
          points[i].z,
        );
  }
  village(group, -5.9, 1.5);
  village(group, 5.8, 1.35);
  ellipsoid(group, [1.02, 0.06, 0.54], "#78956a", -0.5, 0.3, 3.2);
  ellipsoid(group, [0.57, 0.035, 0.28], "#579ca0", -0.5, 0.37, 3.15);
  for (let i = 0; i < 6; i++)
    tree(
      group,
      -1.3 + (i % 3) * 0.65,
      0.28,
      2.8 + Math.floor(i / 3) * 0.8,
      0.42,
    );
  for (let i = 0; i < 8; i++)
    tree(
      group,
      -4.6 + i * 1.1,
      0.24,
      Math.sin((-4.6 + i * 1.1) * 0.54) * 0.48 - 0.6,
      0.23,
    );
  const pos = routePoints[state.route][2],
    color =
      state.cargo === "cloth"
        ? "#885d9c"
        : state.cargo === "pottery"
          ? "#bd704a"
          : "#d5ab54";
  for (let i = 0; i < 3; i++) {
    const x = pos[0] - i * 0.85,
      z = pos[1] + i * 0.12;
    camel(
      group,
      x,
      elevation(x, z) + 0.12,
      z,
      color,
      Math.ceil(state.units / 3),
    );
  }
  if (state.route === "river") {
    const boat = box(
      group,
      [0.9, 0.12, 0.3],
      "#6c4e37",
      2.6,
      0.34,
      Math.sin(2.6 * 0.54) * 0.48 - 0.1,
    );
    boat.rotation.y = -0.1;
    rod(group, v(2.6, 0.4, 0.35), v(2.6, 1.1, 0.35), 0.022, "#776047");
  }
  return {
    group,
    labels: [
      { text: "Willow market", x: -5.7, y: 1.15, z: 1.9 },
      { text: "Harbor town", x: 5.7, y: 1.15, z: 1.8 },
      {
        text: "Mountain pass",
        x: 0.4,
        y: elevation(0.4, -2.2) + 0.55,
        z: -2.2,
      },
      { text: "Oasis", x: -0.5, y: 0.9, z: 3.3 },
    ],
  };
}
