import * as THREE from "three";
import { box, cylinder, roof } from "./castleGeometry";
import type { CastleMaterials } from "./castleMaterials";

function curtain(
  group: THREE.Group,
  length: number,
  x: number,
  z: number,
  rotation: number,
  m: CastleMaterials,
  height = 7,
) {
  const wall = new THREE.Group();
  wall.position.set(x, 0, z);
  wall.rotation.y = rotation;
  box(wall, length, height, 1.65, 0, height / 2 + 0.55, 0, m.stone);
  box(wall, length, 0.4, 2.15, 0, height + 0.55, 0, m.trim);
  box(wall, length, 0.7, 0.45, 0, height + 1, 0.8, m.stone);
  for (let i = 0.5; i < length; i += 1.55)
    box(wall, 0.8, 1.2, 0.6, i - length / 2, height + 1.65, 0.8, m.trim);
  for (let i = 3; i < length - 1; i += 4.8) {
    box(wall, 0.12, 1.3, 0.02, i - length / 2, height - 1.2, 0.84, m.dark);
    box(wall, 0.5, 0.12, 0.03, i - length / 2, height - 1.1, 0.85, m.dark);
  }
  group.add(wall);
}
function tower(
  group: THREE.Group,
  x: number,
  z: number,
  m: CastleMaterials,
  height = 10.4,
  radius = 2.9,
) {
  cylinder(group, radius + 0.5, 1.8, x, 1.25, z, m.darkStone, radius);
  cylinder(group, radius, height, x, height / 2 + 0.55, z, m.stone);
  cylinder(group, radius + 0.16, 0.3, x, height + 0.5, z, m.trim);
  cylinder(group, radius - 0.34, 0.08, x, height + 0.69, z, m.darkStone);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius - 0.15, 0.31, 4, 40),
    m.trim,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, height + 0.9, z);
  ring.castShadow = true;
  group.add(ring);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const merlon = box(
      group,
      0.9,
      1.15,
      0.65,
      x + Math.sin(a) * (radius - 0.2),
      height + 1.38,
      z + Math.cos(a) * (radius - 0.2),
      m.trim,
    );
    merlon.rotation.y = a;
    if (i % 2 === 0) {
      const slot = box(
        group,
        0.14,
        1.55,
        0.03,
        x + Math.sin(a) * (radius + 0.015),
        height - 2.2,
        z + Math.cos(a) * (radius + 0.015),
        m.dark,
      );
      slot.rotation.y = a;
    }
  }
}
function gatehouse(group: THREE.Group, m: CastleMaterials) {
  tower(group, -4.5, 13, m, 11.1, 2.65);
  tower(group, 4.5, 13, m, 11.1, 2.65);
  const arch = new THREE.Shape();
  arch.moveTo(-2.8, 3.3);
  arch.lineTo(-2.8, 9.1);
  arch.lineTo(2.8, 9.1);
  arch.lineTo(2.8, 3.3);
  arch.lineTo(1.8, 3.3);
  arch.absarc(0, 3.3, 1.8, 0, Math.PI, false);
  arch.lineTo(-2.8, 3.3);
  const archMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(arch, { depth: 3.2, bevelEnabled: false }),
    m.stone,
  );
  archMesh.position.set(0, 0.55, 11.3);
  archMesh.castShadow = true;
  archMesh.receiveShadow = true;
  group.add(archMesh);
  box(group, 1.05, 3.3, 3.2, -2.32, 2.2, 12.9, m.stone);
  box(group, 1.05, 3.3, 3.2, 2.32, 2.2, 12.9, m.stone);
  box(group, 5.8, 0.35, 3.5, 0, 9.85, 12.9, m.trim);
  for (let x = -2.4; x <= 2.4; x += 1.2)
    box(group, 0.65, 1.1, 0.6, x, 10.55, 14.3, m.trim);
  // Wedge-shaped arch stones make the entrance legible at human scale.
  for (let i = 0; i <= 10; i++) {
    const a = (Math.PI * i) / 10;
    const voussoir = box(
      group,
      0.45,
      0.58,
      0.18,
      Math.cos(a) * 2.05,
      3.85 + Math.sin(a) * 2.05,
      14.59,
      m.trim,
    );
    voussoir.rotation.z = a - Math.PI / 2;
  }
  const gate = new THREE.Group();
  for (let x = -1.55; x <= 1.6; x += 0.39)
    box(gate, 0.1, 4.5, 0.12, x, 2.9, 14.5, m.iron);
  [1.1, 2.1, 3.1, 4.1].forEach((y) =>
    box(gate, 3.35, 0.12, 0.12, 0, y, 14.52, m.iron),
  );
  group.add(gate);
  return gate;
}
function buildings(group: THREE.Group, m: CastleMaterials) {
  box(group, 8, 10.2, 7, -3.4, 5.65, -3.3, m.stone);
  box(group, 8.45, 0.4, 7.45, -3.4, 10.95, -3.3, m.trim);
  roof(group, 9.1, 8.2, 4.4, -3.4, 11.2, -3.3, m.roof);
  box(group, 0.25, 0.2, 8.5, -3.4, 15.65, -3.3, m.ridge);
  for (let j = 0; j < 8; j++) {
    const level = j / 8;
    const left = box(
      group,
      0.06,
      0.06,
      8.3,
      -7.95 + level * 4.55,
      11.28 + level * 4.4,
      -3.3,
      m.ridge,
    );
    left.rotation.z = Math.PI / 4;
    box(
      group,
      0.06,
      0.06,
      8.3,
      1.15 - level * 4.55,
      11.28 + level * 4.4,
      -3.3,
      m.ridge,
    );
  }
  [-5.8, -3.3, -0.8].forEach((x) => {
    [5.3, 8.4].forEach((y) => {
      box(group, 0.8, 1.65, 0.08, x, y, 0.24, m.trim);
      box(group, 0.48, 1.3, 0.1, x, y, 0.3, m.dark);
    });
  });
  box(group, 1.5, 2.8, 0.1, -3.4, 1.95, 0.29, m.timber);
  box(group, 5.5, 4.1, 9.5, 7.7, 2.6, -1.6, m.stone);
  roof(group, 6.4, 10.3, 2.7, 7.7, 4.7, -1.6, m.roof);
  box(group, 1.1, 3.5, 1, 8.5, 7, -4.4, m.stone);
  box(group, 1.2, 0.3, 1.2, 8.5, 8.85, -4.4, m.trim);
  for (let z = -5; z <= 2; z += 2.2)
    box(group, 0.08, 0.85, 0.45, 10.49, 3.1, z, m.dark);
  box(group, 4.4, 2.6, 6, -10.3, 1.9, 5.1, m.stone);
  roof(group, 5.1, 6.8, 1.8, -10.3, 3.3, 5.1, m.roof);
  // A well, carts and figures establish that the courtyard is also a home.
  cylinder(group, 1, 0.7, 3, 0.9, 4.7, m.stone);
  cylinder(group, 0.65, 0.02, 3, 1.26, 4.7, m.dark);
  [-0.9, 0.9].forEach((x) =>
    box(group, 0.15, 1.5, 0.15, 3 + x, 1.8, 4.7, m.timber),
  );
  roof(group, 2.5, 1.8, 0.8, 3, 2.6, 4.7, m.roof);
  [
    [-1, 7],
    [5.6, 6.9],
    [-8, -8],
    [1.2, 10],
  ].forEach(([x, z], i) => {
    cylinder(group, 0.18, 0.6, x, 1, z, i % 2 ? m.roof : m.timber, 0.13);
    cylinder(group, 0.12, 0.23, x, 1.43, z, m.trim);
  });
}
export function createFortress(m: CastleMaterials) {
  const group = new THREE.Group(),
    curtains = new THREE.Group(),
    towers = new THREE.Group(),
    inner = new THREE.Group();
  curtain(curtains, 30, 0, -12, Math.PI, m);
  curtain(curtains, 24, -15, 0, -Math.PI / 2, m);
  curtain(curtains, 24, 15, 0, Math.PI / 2, m);
  curtain(curtains, 11, -9.5, 12, 0, m);
  curtain(curtains, 11, 9.5, 12, 0, m);
  [
    [-15, -12],
    [15, -12],
    [-15, 12],
    [15, 12],
  ].forEach(([x, z]) => tower(towers, x, z, m));
  curtain(inner, 22, 0, -9, Math.PI, m, 4.2);
  curtain(inner, 14, -11, -2, -Math.PI / 2, m, 4.2);
  curtain(inner, 14, 11, -2, Math.PI / 2, m, 4.2);
  curtain(inner, 8.5, -6.75, 5, 0, m, 4.2);
  curtain(inner, 8.5, 6.75, 5, 0, m, 4.2);
  const gate = gatehouse(group, m);
  buildings(group, m);
  group.add(curtains, towers, inner);
  return { group, curtains, towers, inner, gate };
}
