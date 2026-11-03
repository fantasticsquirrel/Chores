import * as THREE from "three";
import type { MachineState } from "./model";
import { bar, box, cylinder, material } from "./geometry";
import {
  gearKinematics,
  leverKinematics,
  pulleyKinematics,
} from "./machineKinematics";

export function addWorkshopDetails(root: THREE.Group) {
  const backdrop = new THREE.Group();
  backdrop.name = "workshop-backdrop";
  root.add(backdrop);
  const wall = material("#0d252e", 0.15, 0.82);
  const frame = material("#497785", 0.72, 0.34);
  const panel = material("#2f5660", 0.2, 0.76);
  const brass = material("#c99b4f", 0.72, 0.28);
  const tool = material("#8fb0b7", 0.76, 0.25);
  box(backdrop, [7.35, 5.15, 0.18], [0, 2.35, -1.82], wall);
  for (const x of [-3.48, 3.48])
    box(backdrop, [0.14, 5.05, 0.22], [x, 2.35, -1.67], frame);
  box(backdrop, [7.1, 0.16, 0.22], [0, 4.78, -1.67], frame);
  box(backdrop, [2.3, 1.55, 0.08], [-2.12, 3.42, -1.66], panel);
  for (let column = 0; column < 7; column++)
    for (let row = 0; row < 4; row++) {
      const peg = cylinder(
        backdrop,
        0.025,
        0.055,
        [-3.02 + column * 0.3, 2.94 + row * 0.3, -1.58],
        brass,
        8,
      );
      peg.rotation.x = Math.PI / 2;
    }
  box(backdrop, [1.8, 0.12, 0.48], [2.15, 3.68, -1.34], frame);
  for (const x of [1.55, 2.15, 2.75]) {
    const blank = new THREE.Mesh(
      new THREE.TorusGeometry(0.21, 0.045, 8, 28),
      x === 2.15 ? brass : tool,
    );
    blank.position.set(x, 3.96, -1.48);
    blank.castShadow = true;
    backdrop.add(blank);
  }
  const ropeCoil = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.045, 9, 42),
    material("#e3bf70", 0.08, 0.72),
  );
  ropeCoil.position.set(2.7, 2.55, -1.53);
  ropeCoil.castShadow = true;
  backdrop.add(ropeCoil);
  bar(backdrop, [-2.65, 2.65, -1.5], [-2.42, 2.05, -1.45], 0.055, tool);
  bar(backdrop, [-2.42, 2.05, -1.45], [-2.25, 2.2, -1.42], 0.055, tool);
  box(
    backdrop,
    [1.25, 0.38, 0.5],
    [-2.15, 0.27, -1.1],
    material("#a85b3f", 0.28, 0.55),
  );
  box(backdrop, [0.7, 0.08, 0.54], [-2.15, 0.5, -1.08], brass);
}

export function addCrateStartReference(root: THREE.Group, state: MachineState) {
  if (state.liftM <= 0) return;
  const startState = { ...state, liftM: 0 };
  let startX: number;
  let startY: number;
  if (state.mode === "lever") {
    const start = leverKinematics(startState);
    startX = start.loadX;
    startY = start.loadCenterY;
  } else if (state.mode === "gears") {
    const start = gearKinematics(startState);
    startX = start.drivenX + 0.2;
    startY = start.loadCenterY;
  } else {
    const start = pulleyKinematics(startState);
    startX = 0;
    startY = start.loadCenterY;
  }
  const reference = new THREE.Group();
  reference.name = "lift-start-reference";
  reference.position.set(startX, startY, 0.1);
  const geometry = new THREE.EdgesGeometry(
    new THREE.BoxGeometry(0.92, 0.72, 0.76),
  );
  const outline = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: "#ffe5a3",
      transparent: true,
      opacity: 0.94,
      depthWrite: false,
    }),
  );
  outline.name = "lift-start-outline";
  reference.add(outline);
  box(
    reference,
    [1.02, 0.035, 0.82],
    [0, -0.39, 0],
    material("#f4c36d", 0.45, 0.35),
    "lift-start-base",
  );
  root.add(reference);
}
