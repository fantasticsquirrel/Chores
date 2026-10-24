import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  disk,
  material,
  mesh,
  numberTexture,
  PALETTE,
  pipsTexture,
  sector,
} from "./tableGeometry";

export function buildChanceScene(
  chances: number[],
  die: boolean,
  last: number | null,
  selected: number,
) {
  const group = new THREE.Group();
  const brass = material("#c49b52", 0.27, 0.74);
  const darkWood = material("#473728", 0.55);
  if (die) {
    // An actual six-faced object. The displayed top face is the last sampled outcome.
    const tray = mesh(
      group,
      new THREE.BoxGeometry(3.9, 3.7, 0.22),
      darkWood,
      0,
      0,
      0.04,
    );
    tray.rotation.z = -0.07;
    mesh(
      tray,
      new THREE.BoxGeometry(3.55, 3.35, 0.03),
      material("#244f4a", 0.95),
      0,
      0,
      0.13,
    );
    for (const x of [-1.88, 1.88])
      mesh(tray, new THREE.BoxGeometry(0.13, 3.7, 0.25), brass, x, 0, 0.14);
    for (const y of [-1.78, 1.78])
      mesh(tray, new THREE.BoxGeometry(3.75, 0.13, 0.25), brass, 0, y, 0.14);
    const value = last === null ? 1 : last + 1;
    const faces = [3, 4, 2, 5, 1, 6];
    // Opposite face numbers sum to seven; rotate the sampled face upward.
    const surfaces = faces.map(
      (face) =>
        new THREE.MeshStandardMaterial({
          map: pipsTexture(face),
          roughness: 0.28,
          color: "#f5eedc",
        }),
    );
    const cube = mesh(
      group,
      new RoundedBoxGeometry(1.5, 1.5, 1.5, 3, 0.1),
      surfaces,
      0,
      0,
      1.01,
    );
    const normals = [
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, -1),
    ];
    cube.quaternion.setFromUnitVectors(
      normals[value - 1],
      new THREE.Vector3(0, 0, 1),
    );
    cube.quaternion.premultiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.28),
    );
    return group;
  }
  disk(group, 1.94, 0.23, darkWood, 0, 0, 0.08);
  disk(group, 1.9, 0.09, brass, 0, 0, 0.225);
  disk(group, 1.77, 0.045, material("#314345", 0.7), 0, 0, 0.285);
  let angle = Math.PI / 2;
  chances.forEach((chance, index) => {
    const start = angle - chance * Math.PI * 2,
      span = chance * Math.PI * 2;
    if (chance > 0) {
      mesh(
        group,
        sector(1.72, start, span, 0.038),
        material(PALETTE[index], 0.38),
        0,
        0,
        0.32,
      );
      const mid = start + span / 2;
      const label = mesh(
        group,
        new THREE.PlaneGeometry(0.35, 0.35),
        new THREE.MeshBasicMaterial({
          map: numberTexture(index + 1, "#273f38"),
          transparent: true,
          depthWrite: false,
        }),
        Math.cos(mid) * 1.27,
        Math.sin(mid) * 1.27,
        0.365,
      );
      label.rotation.z = mid - Math.PI / 2;
      label.castShadow = label.receiveShadow = false;
      const seam = mesh(
        group,
        new THREE.BoxGeometry(1.7, 0.012, 0.02),
        brass,
        Math.cos(start) * 0.86,
        Math.sin(start) * 0.86,
        0.37,
      );
      seam.rotation.z = start;
      if (index === selected)
        mesh(
          group,
          new THREE.TorusGeometry(1.67, 0.016, 6, 32, span),
          material("#fff5c7", 0.3, 0.45),
          0,
          0,
          0.38,
        ).rotation.z = start;
    }
    angle = start;
  });
  mesh(group, new THREE.TorusGeometry(1.8, 0.035, 10, 100), brass, 0, 0, 0.32);
  for (let i = 0; i < 48; i++) {
    const radians = (i * Math.PI) / 24;
    disk(
      group,
      i % 4 === 0 ? 0.022 : 0.013,
      0.012,
      material("#f3e0af", 0.3, 0.5),
      Math.cos(radians) * 1.845,
      Math.sin(radians) * 1.845,
      0.28,
    );
  }
  const pointer = new THREE.Group();
  const selectedMid =
    last === null
      ? Math.PI / 2
      : Math.PI / 2 -
        (chances.slice(0, last).reduce((a, b) => a + b, 0) +
          chances[last] / 2) *
          Math.PI *
          2;
  pointer.rotation.z = selectedMid - Math.PI / 2;
  group.add(pointer);
  const shape = new THREE.Shape();
  shape.moveTo(-0.065, -0.43);
  shape.lineTo(0.065, -0.43);
  shape.lineTo(0.04, 1.15);
  shape.lineTo(0.14, 1.15);
  shape.lineTo(0, 1.52);
  shape.lineTo(-0.14, 1.15);
  shape.lineTo(-0.04, 1.15);
  shape.closePath();
  mesh(
    pointer,
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
    }),
    material("#efe2bd", 0.25, 0.7),
    0,
    0,
    0.5,
  );
  disk(group, 0.18, 0.14, brass, 0, 0, 0.53);
  disk(group, 0.09, 0.025, material("#344b4e", 0.18, 0.65), 0, 0, 0.61);
  return group;
}
