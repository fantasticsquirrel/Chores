import * as T from "three";
import {
  MAGNETIC_BAR_DEPTH,
  MAGNETIC_BAR_HALF_DEPTH,
  MAGNETIC_BAR_HALF_LENGTH,
  MAGNETIC_BAR_LENGTH,
  defaultMagneticState,
  isInsideMagneticBar,
  magneticBarCenter,
  magneticFieldAt,
  magneticPoles,
  magneticResult,
  normalizeMagnetic,
  type MagneticState,
} from "@family-manager/family-api/discovery-models/magnetic-fields";
import type { ExpansionLabel } from "../types";
import { arrow, box, earthScene, tube } from "./geometry";

export type MagneticVisualState = MagneticState & {
  /** Web-only opt-in replay progress; model evidence always uses the final state. */
  alignmentProgress?: number;
};

function physicalMesh(
  group: T.Group,
  geometry: T.BufferGeometry,
  color: T.ColorRepresentation,
  at: [number, number, number],
  options: {
    metalness?: number;
    roughness?: number;
    clearcoat?: number;
    opacity?: number;
  } = {},
) {
  const material = new T.MeshPhysicalMaterial({
    color,
    metalness: options.metalness ?? 0.08,
    roughness: options.roughness ?? 0.58,
    clearcoat: options.clearcoat ?? 0,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
  });
  const object = new T.Mesh(geometry, material);
  object.position.set(...at);
  object.castShadow = (options.opacity ?? 1) === 1;
  object.receiveShadow = true;
  group.add(object);
  return object;
}

function compass(
  group: T.Group,
  state: MagneticVisualState,
  x: number,
  z: number,
  large = false,
  select?: number,
) {
  const root = new T.Group();
  root.position.set(x, large ? 0.24 : 0.18, z);
  root.name = large ? "probe-compass" : `sample-compass-${select ?? "fixed"}`;
  if (select !== undefined) root.userData.select = select;
  group.add(root);
  const radius = large ? 0.53 : 0.2;
  physicalMesh(
    root,
    new T.CylinderGeometry(radius, radius * 1.02, 0.11, 40),
    0x9b743d,
    [0, 0, 0],
    { metalness: 0.5, roughness: 0.3, clearcoat: 0.4 },
  );
  physicalMesh(
    root,
    new T.CylinderGeometry(radius * 0.88, radius * 0.88, 0.12, 40),
    0xe8e0c5,
    [0, 0.025, 0],
    { roughness: 0.48, clearcoat: 0.25 },
  );
  const ring = physicalMesh(
    root,
    new T.TorusGeometry(radius * 0.9, radius * 0.045, 8, 48),
    0xe2bd6e,
    [0, 0.1, 0],
    { metalness: 0.64, roughness: 0.24, clearcoat: 0.5 },
  );
  ring.rotation.x = Math.PI / 2;
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const tick = physicalMesh(
      root,
      new T.BoxGeometry(
        index % 3 === 0 ? radius * 0.08 : radius * 0.045,
        0.018,
        radius * 0.18,
      ),
      index === 0 ? 0x9e433c : 0x415157,
      [Math.cos(angle) * radius * 0.69, 0.1, Math.sin(angle) * radius * 0.69],
      { metalness: 0.12, roughness: 0.52 },
    );
    tick.rotation.y = Math.PI / 2 - angle;
  }
  const field = magneticFieldAt(state, x, z);
  if (field.strength > 0.00001) {
    const needle = new T.Group();
    const finalRotation = -Math.atan2(field.z, field.x);
    const progress = Math.min(1, Math.max(0, state.alignmentProgress ?? 1));
    needle.rotation.y = finalRotation * progress;
    needle.name = large ? "probe-needle" : "sample-needle";
    root.add(needle);
    for (const direction of [-1, 1] as const) {
      const tip = physicalMesh(
        needle,
        new T.ConeGeometry(radius * 0.21, radius * 0.78, 4),
        direction === 1 ? 0xb8453e : 0x536b75,
        [direction * radius * 0.34, 0.145, 0],
        { metalness: 0.2, roughness: 0.35, clearcoat: 0.5 },
      );
      tip.rotation.z = (-direction * Math.PI) / 2;
    }
    physicalMesh(
      needle,
      new T.SphereGeometry(radius * 0.11, 16, 10),
      0xe6c574,
      [0, 0.16, 0],
      { metalness: 0.48, roughness: 0.3, clearcoat: 0.45 },
    );
  } else {
    box(
      root,
      [radius * 0.85, 0.025, radius * 0.075],
      [0, 0.14, 0],
      0xe5c679,
    ).rotation.y = Math.PI / 4;
    box(
      root,
      [radius * 0.85, 0.025, radius * 0.075],
      [0, 0.14, 0],
      0xe5c679,
    ).rotation.y = -Math.PI / 4;
  }
  physicalMesh(
    root,
    new T.CylinderGeometry(radius * 0.83, radius * 0.83, 0.018, 40),
    0xb8d8d8,
    [0, 0.18, 0],
    { roughness: 0.12, clearcoat: 0.8, opacity: 0.18 },
  );
  return root;
}

function addTabletop(group: T.Group) {
  box(group, [14.4, 0.22, 10.1], [0, -0.55, 0], 0x3f2d22).name =
    "walnut-table-base";
  box(group, [14.15, 0.42, 9.85], [0, -0.34, 0], 0x8a6444).name =
    "wood-tabletop";
  physicalMesh(
    group,
    new T.BoxGeometry(13.7, 0.12, 9.4),
    0x183f43,
    [0, -0.06, 0],
    { roughness: 0.78, clearcoat: 0.12 },
  ).name = "marked-felt-surface";
  for (let index = 0; index < 27; index += 1)
    box(
      group,
      [0.012, 0.013, 8.95],
      [-6.25 + index * 0.48, 0.015, 0],
      index % 5 === 0 ? 0x6f9290 : 0x315a5e,
    );
  for (let index = 0; index < 19; index += 1)
    box(
      group,
      [13.2, 0.013, 0.012],
      [0, 0.016, -4.25 + index * 0.47],
      index % 5 === 0 ? 0x6f9290 : 0x315a5e,
    );
  box(group, [13, 0.07, 0.34], [0, 0.02, 4.55], 0xb69052).name = "brass-ruler";
  for (let index = 0; index < 53; index += 1)
    box(
      group,
      [0.018, 0.025, index % 5 === 0 ? 0.24 : 0.13],
      [-6.25 + index * 0.24, 0.075, 4.5],
      0x3f3a31,
    );
  for (const x of [-6.72, 6.72])
    for (const z of [-4.57, 4.57])
      physicalMesh(
        group,
        new T.CylinderGeometry(0.1, 0.1, 0.05, 20),
        0xc5a462,
        [x, 0.03, z],
        { metalness: 0.72, roughness: 0.28 },
      );
}

function addCoordinateKey(group: T.Group) {
  const origin = new T.Vector3(-5.75, 0.15, -3.65);
  physicalMesh(
    group,
    new T.CylinderGeometry(0.1, 0.1, 0.05, 20),
    0xf2dfaa,
    [origin.x, origin.y, origin.z],
    { metalness: 0.5, roughness: 0.3 },
  ).name = "tabletop-axis-origin";
  const positiveX = arrow(
    group,
    origin,
    origin.clone().add(new T.Vector3(1.25, 0, 0)),
    0xffd37c,
    0.85,
  );
  positiveX.name = "tabletop-positive-x-axis";
  const positiveZ = arrow(
    group,
    origin,
    origin.clone().add(new T.Vector3(0, 0, 1.25)),
    0x8ce0de,
    0.85,
  );
  positiveZ.name = "tabletop-positive-z-axis";
}

function addBarMagnet(
  group: T.Group,
  side: -1 | 1,
  center: number,
  flipped: boolean,
) {
  const magnet = new T.Group();
  magnet.position.set(side * center, 0.42, 0);
  magnet.name = side === -1 ? "left-bar-magnet" : "right-bar-magnet";
  group.add(magnet);
  const northRight = side === -1 || !flipped;
  for (const half of [-1, 1] as const) {
    const north = (half === 1) === northRight;
    const body = physicalMesh(
      magnet,
      new T.BoxGeometry(MAGNETIC_BAR_LENGTH / 2, 0.62, MAGNETIC_BAR_DEPTH),
      north ? 0xb54a40 : 0x355f78,
      [half * (MAGNETIC_BAR_LENGTH / 4), 0, 0],
      { metalness: 0.34, roughness: 0.28, clearcoat: 0.62 },
    );
    body.name = `${side === -1 ? "left" : "right"}-${north ? "north" : "south"}-half`;
    if (side === 1) body.userData.select = half === -1 ? 1 : 2;
    physicalMesh(
      magnet,
      new T.BoxGeometry(0.88, 0.035, MAGNETIC_BAR_DEPTH - 0.08),
      north ? 0xd56b5c : 0x5a8fa6,
      [half * (MAGNETIC_BAR_LENGTH / 4), 0.325, 0],
      { metalness: 0.22, roughness: 0.22, clearcoat: 0.75 },
    );
  }
  physicalMesh(
    magnet,
    new T.BoxGeometry(0.08, 0.7, MAGNETIC_BAR_DEPTH),
    0xd1c190,
    [0, 0, 0],
    { metalness: 0.68, roughness: 0.24, clearcoat: 0.5 },
  );
  for (const z of [-0.31, 0.31])
    physicalMesh(
      magnet,
      new T.BoxGeometry(MAGNETIC_BAR_LENGTH - 0.16, 0.035, 0.03),
      0xf0dca1,
      [0, 0.34, z],
      { metalness: 0.58, roughness: 0.22 },
    );
  for (const x of [-0.82, 0.82])
    physicalMesh(
      magnet,
      new T.CylinderGeometry(0.055, 0.055, 0.035, 16),
      0xe7cf92,
      [x, 0.36, -0.31],
      { metalness: 0.7, roughness: 0.22 },
    );
}

function build(input: MagneticVisualState) {
  const state = {
    ...normalizeMagnetic(input),
    alignmentProgress: Number.isFinite(input.alignmentProgress)
      ? Math.min(1, Math.max(0, input.alignmentProgress ?? 1))
      : 1,
  };
  const result = magneticResult(state);
  const group = new T.Group();
  const center = magneticBarCenter(state);
  addTabletop(group);
  addCoordinateKey(group);
  addBarMagnet(group, -1, center, state.flipped);
  addBarMagnet(group, 1, center, state.flipped);

  // Exterior streamlines leave N surrogates and terminate before entering a bar.
  for (const pole of magneticPoles(state).filter((item) => item.sign > 0))
    for (let lineIndex = 0; lineIndex < 13; lineIndex += 1) {
      const angle = (lineIndex / 12) * Math.PI * 2;
      let x = pole.x + Math.cos(angle) * (MAGNETIC_BAR_HALF_DEPTH + 0.09);
      let z = Math.sin(angle) * (MAGNETIC_BAR_HALF_DEPTH + 0.11);
      const points: T.Vector3[] = [];
      for (let step = 0; step < 118; step += 1) {
        if (Math.abs(x) > 6.65 || Math.abs(z) > 4.38) break;
        if (isInsideMagneticBar(state, x, z)) break;
        points.push(new T.Vector3(x, 0.115, z));
        const field = magneticFieldAt(state, x, z);
        if (field.strength < 0.00001) break;
        x += (field.x / field.strength) * 0.11;
        z += (field.z / field.strength) * 0.11;
        if (
          magneticPoles(state).some(
            (item) => item.sign < 0 && Math.hypot(x - item.x, z) < 0.39,
          )
        )
          break;
      }
      if (points.length > 5) {
        const path = tube(group, points, 0x75c9c0, 0.014);
        path.name = "exterior-field-direction-line";
        const arrowIndex = Math.floor(points.length * 0.56);
        if (points[arrowIndex + 2])
          arrow(
            group,
            points[arrowIndex],
            points[arrowIndex + 2],
            0xbce8d5,
            0.34,
          );
      }
    }

  for (let row = 0; row < 3; row += 1)
    for (let column = 0; column < 7; column += 1) {
      const x = -5.4 + column * 1.8;
      const z = -2.9 + row * 2.9;
      if (isInsideMagneticBar(state, x, z)) continue;
      compass(group, state, x, z, false, 10 + row * 7 + column);
    }
  if (!result.insideMagnet)
    compass(group, state, state.probeX, state.probeZ, true);

  const forceDirection = result.interaction === "attract" ? -1 : 1;
  arrow(
    group,
    new T.Vector3(center, 1.4, 0),
    new T.Vector3(center + forceDirection * 0.95, 1.4, 0),
    0xffd37c,
  );
  arrow(
    group,
    new T.Vector3(-center, 1.4, 0),
    new T.Vector3(-center - forceDirection * 0.95, 1.4, 0),
    0xffd37c,
  );

  const labels: ExpansionLabel[] = [
    {
      text: "S pole",
      at: [-center - MAGNETIC_BAR_HALF_LENGTH / 2, 0.85, 0],
      left: 9,
      top: 41,
    },
    {
      text: "N pole",
      at: [-center + MAGNETIC_BAR_HALF_LENGTH / 2, 0.85, 0],
      left: 31,
      top: 28,
    },
    {
      text: state.flipped ? "N pole" : "S pole",
      at: [center - MAGNETIC_BAR_HALF_LENGTH / 2, 0.85, 0],
      left: 69,
      top: 28,
    },
    {
      text: state.flipped ? "S pole" : "N pole",
      at: [center + MAGNETIC_BAR_HALF_LENGTH / 2, 0.85, 0],
      left: 91,
      top: 41,
    },
    {
      text: `${result.facingPoles} facing · ${result.interaction}`,
      at: [0, 1.42, 0],
      left: 50,
      top: 21,
    },
    {
      text: result.insideMagnet
        ? "Probe outside model domain"
        : result.directionDegrees === null
          ? "Probe · index 0 · no preferred direction"
          : `Probe north end · index ${result.relativeFieldIndex}`,
      at: [state.probeX, 0.5, state.probeZ],
      left: 18,
      top: 78,
    },
    {
      text: "Exterior arrows: N → S",
      at: [3.9, 0.12, 2.65],
      left: 82,
      top: 77,
    },
    {
      text: "+x axis",
      at: [-4.5, 0.18, -3.65],
      left: 23,
      top: 66,
    },
    {
      text: "+z axis",
      at: [-5.75, 0.18, -2.4],
      left: 8,
      top: 65,
    },
  ];
  return { group, labels };
}

export function createMagneticFieldsScene(
  state: MagneticVisualState = defaultMagneticState,
) {
  return earthScene(state, build, {
    position: [7.4, 16.8, 15.4],
    target: [0, 0.05, 0],
    width: 17.5,
    height: 11,
  });
}
