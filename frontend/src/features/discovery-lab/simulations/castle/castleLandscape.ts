import * as THREE from "three";
import { box, cylinder, line } from "./castleGeometry";
import type { CastleMaterials } from "./castleMaterials";
import {
  ditchSpan,
  routeEnd,
  wallHeightScale,
  type CastleState,
} from "./castleState";

export function createLandscape(m: CastleMaterials) {
  const group = new THREE.Group(),
    ditch = new THREE.Group(),
    bridge = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(40, 39, 1.8, 80),
    m.earth,
  );
  base.scale.z = 0.86;
  base.position.y = -1.2;
  base.receiveShadow = true;
  group.add(base);
  const top = new THREE.Mesh(new THREE.CircleGeometry(40, 80), m.grass);
  top.rotation.x = -Math.PI / 2;
  top.scale.y = 0.86;
  top.position.y = -0.27;
  top.receiveShadow = true;
  group.add(top);
  box(group, 34.8, 0.85, 28.8, 0, 0.03, 0, m.bank);
  box(group, 28, 0.08, 22, 0, 0.5, 0, m.paving);
  // Courtyard paving joints are sparse enough to read without a noisy tiled grid.
  const joint = new THREE.LineBasicMaterial({
    color: 0x776f5a,
    transparent: true,
    opacity: 0.24,
  });
  for (let x = -13; x < 14; x += 2)
    line(
      group,
      [
        [x, 0.55, -10.7],
        [x, 0.55, 10.7],
      ],
      joint,
    );
  for (let z = -10; z < 11; z += 2)
    line(
      group,
      [
        [-13.7, 0.55, z],
        [13.7, 0.55, z],
      ],
      joint,
    );
  box(group, 3.8, 0.05, 20, 0, -0.19, 25, m.path);
  box(group, 2.9, 0.05, 20, 0, -0.19, -25, m.path);
  for (let i = 0; i < 37; i++) {
    const a = i * 2.3999,
      radius = 29 + (i % 4) * 1.9;
    const x = Math.sin(a) * radius,
      z = Math.cos(a) * radius * 0.84;
    if (Math.abs(x) < 5 || (Math.abs(x) < 25 && Math.abs(z) < 25)) continue;
    const height = 2 + (i % 5) * 0.45;
    cylinder(group, 0.17, height * 0.8, x, height * 0.3, z, m.timber);
    for (let j = 0; j < 3; j++) {
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(height * 0.52, 1),
        m.leaves[(i + j) % 3],
      );
      crown.position.set(
        x + Math.sin(j * 2) * 0.65,
        height * 0.75 + j * 0.3,
        z + Math.cos(j * 2) * 0.5,
      );
      crown.scale.y = 1.25;
      crown.castShadow = true;
      group.add(crown);
    }
  }
  // Low bridge deck, individual planks, parapet ropes and lifting chains.
  box(bridge, 3.5, 0.32, 1, 0, 0.76, 0.5, m.timber);
  for (let i = 0; i < 22; i++)
    box(bridge, 3.6, 0.08, 0.018, 0, 0.97, (i + 0.5) / 22, m.path);
  [-1.7, 1.7].forEach((x) => {
    box(bridge, 0.12, 0.18, 1, x, 1.14, 0.5, m.timber);
    [0, 0.25, 0.5, 0.75, 1].forEach((z) =>
      box(bridge, 0.13, 0.75, 0.02, x, 1.23, z, m.timber),
    );
  });
  bridge.position.z = 14.7;
  group.add(ditch, bridge);
  return { group, ditch, bridge, joint };
}
export function updateLandscape(
  ditch: THREE.Group,
  bridge: THREE.Group,
  state: CastleState,
  m: CastleMaterials,
) {
  const span = ditchSpan(state.moat);
  if (span > 0) {
    const outerX = 17.4 + span,
      outerZ = 14.4 + span;
    box(ditch, outerX * 2, 0.1, span, 0, -0.12, -14.4 - span / 2, m.water);
    box(ditch, outerX * 2, 0.1, span, 0, -0.12, 14.4 + span / 2, m.water);
    box(ditch, span, 0.1, 28.8, -17.4 - span / 2, -0.12, 0, m.water);
    box(ditch, span, 0.1, 28.8, 17.4 + span / 2, -0.12, 0, m.water);
    [
      [outerX * 2 + 1, 0.55, 0, outerZ],
      [outerX * 2 + 1, 0.55, 0, -outerZ],
      [0.55, outerZ * 2, outerX, 0],
      [0.55, outerZ * 2, -outerX, 0],
    ].forEach(([width, depth, x, z]) =>
      box(ditch, width, 0.25, depth, x, -0.02, z, m.bank),
    );
    // Static, discontinuous highlights communicate water without an idle render loop.
    for (let i = 0; i < 26; i++) {
      const x = -outerX + 1 + ((i * 3.73) % (outerX * 2 - 2));
      const z = (i % 2 ? 1 : -1) * (14.8 + ((i % 4) * span) / 5);
      box(ditch, 0.8 + (i % 3), 0.015, 0.025, x, -0.05, z, m.ridge);
    }
  }
  bridge.scale.z = Math.max(4.2, span + 2);
  [-1.65, 1.65].forEach((x) =>
    line(
      ditch,
      [
        [x, 5.5, 14.5],
        [x, 1.12, 14.7 + bridge.scale.z * 0.65],
      ],
      m.ray,
    ),
  );
}
export function createEvidence(state: CastleState, m: CastleMaterials) {
  const group = new THREE.Group(),
    end = routeEnd(state),
    start = state.approach === "bridge" ? 32 : -31;
  const direction = Math.sign(end - start);
  for (let z = start; direction > 0 ? z < end : z > end; z += direction * 0.9) {
    box(
      group,
      0.1,
      0.05,
      0.45,
      0,
      state.approach === "bridge" ? 1.04 : 0.48,
      z,
      m.gold,
    );
  }
  const marker = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.065, 8, 32),
    m.gold,
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(0, state.approach === "bridge" ? 1.09 : 0.49, end);
  group.add(marker);
  if (state.sight) {
    const height = (y: number) => 0.55 + (y - 0.55) * wallHeightScale(state);
    // One front corner only. Every segment stays outside the curtain walls;
    // these are illustrative viewing directions, never structural bracing.
    const rays = state.towers
      ? [
          [
            [18, height(10.4), 12],
            [18, height(2.8), -6],
          ],
          [
            [15, height(10.4), 15],
            [7, height(2.8), 15],
          ],
        ]
      : [
          [
            [16, height(8.1), 10],
            [24, 1, 10],
          ],
        ];
    rays.forEach((points) =>
      line(group, points, m.sightOverlay).computeLineDistances(),
    );
  }
  return group;
}
