import * as T from "three";
import type { CellExplorerState } from "@family-manager/family-api/discovery-models/expansion-life-geometry";
import {
  ellipsoid,
  material,
  mesh,
  rod,
  v,
  ring,
  roundedPlate,
} from "./shared";
export function drawCellTransport(group: T.Group, state: CellExplorerState) {
  roundedPlate(group, 3.1, 4.4, 0.1, "#283e4b", 4.1, -0.23, 0);
  for (let side = -1; side <= 1; side += 2)
    for (let i = 0; i < 20; i++) {
      if (state.carrier && i > 8 && i < 12) continue;
      const z = -1.8 + i * 0.19;
      ellipsoid(
        group,
        [0.09, 0.1, 0.09],
        "#afc7a5",
        4.1 + side * 0.16,
        0.14,
        z,
      );
      rod(
        group,
        v(4.1 + side * 0.13, 0.13, z),
        v(4.1, 0.02, z + 0.035),
        0.023,
        "#d9a972",
      );
    }
  if (state.carrier) {
    for (const side of [-1, 1])
      ellipsoid(
        group,
        [0.18, 0.25, 0.22],
        "#a586c6",
        4.1 + side * 0.19,
        0.18,
        0,
      );
    ring(group, 4.1, 0.42, 0, 0.17, 0.14, "#d1bee3", 0.025);
  }
  for (const [count, side] of [
    [state.outside, -1],
    [state.inside, 1],
  ])
    for (let i = 0; i < Math.ceil(count); i++) {
      const x = 4.1 + side * (0.46 + (i % 3) * 0.29),
        z = -1.5 + Math.floor(i / 3) * 0.47;
      if (state.molecule === "oxygen") {
        ellipsoid(group, [0.075, 0.075, 0.075], "#f6d6b4", x, 0.22, z);
        ellipsoid(group, [0.075, 0.075, 0.075], "#ed936d", x + 0.08, 0.22, z);
      } else {
        const sugar = mesh(
          group,
          new T.IcosahedronGeometry(0.12),
          material("#e8c65c"),
          x,
          0.24,
          z,
        );
        sugar.rotation.set(i, i * 0.4, 0);
      }
    }
  if (
    (state.molecule === "oxygen" || state.carrier) &&
    state.outside !== state.inside
  ) {
    const direction = state.outside > state.inside ? 1 : -1;
    const arrow = new T.ArrowHelper(
      v(direction, 0, 0),
      v(4.1 - direction * 0.7, 0.6, 0),
      1.4,
      "#f5dda2",
      0.22,
      0.14,
    );
    group.add(arrow);
  }
}
