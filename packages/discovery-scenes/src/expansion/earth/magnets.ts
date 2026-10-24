import * as T from "three";
import {
  initialMagnetic,
  magneticFieldAt,
  magneticPoles,
  magneticResult,
  normalizeMagnetic,
  type MagneticState,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import type { ExpansionLabel } from "../types";
import { arrow, box, earthScene, mesh, tube } from "./geometry";
function compass(
  g: T.Group,
  s: MagneticState,
  x: number,
  z: number,
  large = false,
  select?: number,
) {
  const root = new T.Group();
  root.position.set(x, 0.18, z);
  if (select !== undefined) root.userData.select = select;
  g.add(root);
  const r = large ? 0.46 : 0.19,
    field = magneticFieldAt(s, x, z);
  mesh(root, new T.CylinderGeometry(r, r, 0.07, 36), 0xc8aa6d, [0, 0, 0]);
  mesh(
    root,
    new T.CylinderGeometry(r * 0.85, r * 0.85, 0.075, 36),
    0x18383d,
    [0, 0.012, 0],
  );
  const ring = mesh(
    root,
    new T.TorusGeometry(r * 0.88, 0.01, 6, 40),
    0xe5d49b,
    [0, 0.06, 0],
  );
  ring.rotation.x = Math.PI / 2;
  if (field.strength > 0.00001) {
    const needle = new T.Group();
    needle.rotation.y = -Math.atan2(field.z, field.x);
    root.add(needle);
    for (const dir of [-1, 1]) {
      const n = mesh(
        needle,
        new T.ConeGeometry(r * 0.19, r * 0.75, 4),
        dir === 1 ? 0xe86c5b : 0xb9d7dd,
        [dir * r * 0.32, 0.09, 0],
      );
      n.rotation.z = (-dir * Math.PI) / 2;
    }
    mesh(root, new T.SphereGeometry(r * 0.1, 10, 8), 0xf6dca1, [0, 0.12, 0]);
  }
  return root;
}
function build(input: MagneticState) {
  const s = normalizeMagnetic(input),
    result = magneticResult(s),
    g = new T.Group(),
    c = 1 + s.gap / 2;
  box(g, [14, 0.5, 9.7], [0, -0.3, 0], 0x786043);
  box(g, [13.6, 0.1, 9.3], [0, 0, 0], 0x183d43);
  for (let i = 0; i < 25; i++)
    box(
      g,
      [0.012, 0.012, 8.8],
      [-6 + i * 0.5, 0.06, 0],
      i % 2 ? 0x275158 : 0x376269,
    );
  for (let i = 0; i < 17; i++)
    box(
      g,
      [12.8, 0.012, 0.012],
      [0, 0.06, -4 + i * 0.5],
      i % 2 ? 0x275158 : 0x376269,
    );
  for (let i = 0; i < 45; i++)
    box(
      g,
      [0.02, 0.02, i % 5 === 0 ? 0.22 : 0.1],
      [-6 + i * 0.27, 0.08, 4.45],
      0xbfa976,
    );
  for (const side of [-1, 1]) {
    const m = new T.Group();
    m.position.set(side * c, 0.35, 0);
    g.add(m);
    const northRight = side === -1 || !s.flipped;
    for (const half of [-1, 1]) {
      const cap = box(
        m,
        [1, 0.5, 0.8],
        [half * 0.5, 0, 0],
        (half === 1) === northRight ? 0xb84e43 : 0x3f7b9a,
      );
      if (side === 1) cap.userData.select = half === -1 ? 1 : 2;
    }
    box(m, [0.045, 0.51, 0.82], [0, 0, 0], 0xc8b982);
    box(m, [1.8, 0.015, 0.025], [0, 0.26, -0.26], 0xe1cf9a);
    box(m, [1.8, 0.015, 0.025], [0, 0.26, 0.26], 0xe1cf9a);
  }
  // Integrate exterior streamlines from the north poles. No paths are drawn through bars.
  for (const pole of magneticPoles(s).filter((p) => p.sign > 0))
    for (let k = 0; k < 13; k++) {
      const angle = (k / 12) * Math.PI * 2;
      let x = pole.x + Math.cos(angle) * 0.48,
        z = Math.sin(angle) * 0.5;
      const points: T.Vector3[] = [];
      for (let step = 0; step < 115; step++) {
        if (Math.abs(x) > 6.6 || Math.abs(z) > 4.4) break;
        if (Math.abs(z) < 0.46 && Math.abs(Math.abs(x) - c) < 0.98) break;
        points.push(new T.Vector3(x, 0.12, z));
        const f = magneticFieldAt(s, x, z);
        if (f.strength < 0.00001) break;
        x += (f.x / f.strength) * 0.11;
        z += (f.z / f.strength) * 0.11;
        if (
          magneticPoles(s).some(
            (p) => p.sign < 0 && Math.hypot(x - p.x, z) < 0.4,
          )
        )
          break;
      }
      if (points.length > 5) {
        tube(g, points, 0x70bbb9, 0.012);
        const i = Math.floor(points.length * 0.55);
        if (points[i + 2]) arrow(g, points[i], points[i + 2], 0x8fd8cb, 0.35);
      }
    }
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 7; col++) {
      const x = -5.4 + col * 1.8,
        z = -2.9 + row * 2.9;
      if (Math.abs(z) < 0.48 && Math.abs(Math.abs(x) - c) < 1.1) continue;
      compass(g, s, x, z, false, 10 + row * 7 + col);
    }
  if (!result.insideMagnet) compass(g, s, s.probeX, s.probeZ, true, 2);
  const direction = result.interaction === "attract" ? -1 : 1;
  arrow(
    g,
    new T.Vector3(c, 1.35, 0),
    new T.Vector3(c + direction * 0.9, 1.35, 0),
    0xffdb9b,
  );
  arrow(
    g,
    new T.Vector3(-c, 1.35, 0),
    new T.Vector3(-c - direction * 0.9, 1.35, 0),
    0xffdb9b,
  );
  const labels: ExpansionLabel[] = [
    { text: "S", at: [-c - 0.55, 0.85, 0] },
    { text: "N", at: [-c + 0.55, 0.85, 0] },
    { text: s.flipped ? "N" : "S", at: [c - 0.55, 0.85, 0] },
    { text: s.flipped ? "S" : "N", at: [c + 0.55, 0.85, 0] },
    {
      text: result.insideMagnet
        ? "Move the probe outside the bar"
        : result.direction === null
          ? "Probe: no preferred direction"
          : "Probe north tip follows field",
      at: [-3.7, 0.6, 3.5],
    },
    { text: `Facing poles ${result.interaction}`, at: [0, 1.9, -1.8] },
  ];
  return { group: g, labels };
}
export function createMagneticFieldsScene(
  state: MagneticState = initialMagnetic,
) {
  return earthScene(state, build, {
    position: [7, 17, 15],
    target: [0, 0, 0],
    width: 17.5,
    height: 11,
  });
}
