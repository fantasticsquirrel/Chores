import * as THREE from "three";
import {
  machineResult,
  normalizeMachine,
  type MachineState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import type { ExpansionLabel, ExpansionScene } from "../types";
import {
  arrow,
  bar,
  bench,
  box,
  cylinder,
  disposeTree,
  gear,
  material,
  pickPlane,
  replaceGroup,
  rope,
  wheel,
  type Point,
} from "./geometry";
import {
  addCrateStartReference,
  addWorkshopDetails,
} from "./machineWorkshopDetails";
import {
  gearKinematics,
  leverKinematics,
  MACHINE_LIFT_SCALE,
  pulleyKinematics,
} from "./machineKinematics";
function crate(root: THREE.Group, y: number, x = 0) {
  const wood = material("#bd8d4b"),
    band = material("#4b6165", 0.6);
  const group = new THREE.Group();
  group.position.set(x, y, 0.1);
  group.name = "lifted-load";
  root.add(group);
  box(group, [0.85, 0.65, 0.7], [0, 0, 0], wood);
  for (const z of [-0.365, 0.365]) {
    for (const a of [-0.28, 0.28])
      box(group, [0.055, 0.68, 0.025], [a, 0, z], band);
    for (let row = 0; row < 4; row++)
      box(
        group,
        [0.84, 0.015, 0.012],
        [0, -0.24 + row * 0.16, z],
        material("#805f37"),
      );
  }
  bar(group, [-0.3, 0.33, 0], [0, 0.62, 0], 0.02, band);
  bar(group, [0.3, 0.33, 0], [0, 0.62, 0], 0.02, band);
}
function pulley(root: THREE.Group, s: MachineState): ExpansionLabel[] {
  const steel = material("#6795a2", 0.65),
    cord = material("#f1ca71"),
    layout = pulleyKinematics(s),
    top = layout.topY,
    bottom = layout.movingPulleyY;
  for (const x of [-1.8, 1.8]) {
    box(root, [0.2, 4.65, 0.22], [x, 2.3, -0.2], steel);
    box(root, [0.7, 0.12, 1.1], [x, 0.12, -0.2], steel);
    bar(root, [x, 3.8, -0.2], [x * 0.65, 4.6, -0.2], 0.06, steel);
  }
  box(root, [3.8, 0.23, 0.34], [0, 4.65, -0.2], steel);
  const points: Point[] = layout.ropePoints;
  const end = layout.freeEndY;
  if (s.advantage === 1) {
    wheel(root, 0.3, [0, top, 0.24]);
    bar(
      root,
      [-0.3, bottom, 0.24],
      [0, 0.5 + s.liftM + 0.62, 0.1],
      0.025,
      steel,
    );
  } else if (s.advantage === 2) {
    wheel(root, 0.25, [0, bottom, 0.24]);
    wheel(root, 0.25, [0.5, top, 0.24]);
  } else if (s.advantage === 3) {
    wheel(root, 0.2, [0, bottom, 0.24]);
    wheel(root, 0.2, [-0.4, top, 0.24]);
    wheel(root, 0.2, [0.4, top, 0.24]);
    bar(root, [-0.6, bottom, 0.24], [0, bottom, 0.24], 0.045, steel);
  } else {
    for (const x of [-0.4, 0.4]) wheel(root, 0.2, [x, bottom, 0.24]);
    for (const x of [0, 0.8]) wheel(root, 0.2, [x, top, 0.24]);
    bar(root, [-0.4, bottom, 0.24], [0.4, bottom, 0.24], 0.045, steel);
  }
  if (layout.fixedAnchor) {
    const anchor = new THREE.Group();
    anchor.name = "fixed-rope-anchor";
    anchor.position.set(
      layout.fixedAnchor[0],
      layout.fixedAnchor[1] + 0.14,
      layout.fixedAnchor[2],
    );
    root.add(anchor);
    box(anchor, [0.3, 0.12, 0.22], [0, 0.05, 0], material("#d7b766", 0.7));
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.035, 7, 20),
      material("#e5cf8a", 0.7),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.08;
    anchor.add(ring);
  }
  rope(root, points, cord);
  if (s.advantage > 1)
    bar(root, [0, bottom, 0.24], [0, 1.12 + s.liftM, 0.1], 0.04, steel);
  const endPoint = points[points.length - 1];
  const forceArrowLength = 0.65 / s.advantage + 0.1;
  box(root, [0.34, 0.12, 0.18], endPoint, material("#e2754d"));
  arrow(
    root,
    [endPoint[0] + 0.28, end + forceArrowLength + 0.15, 0.24],
    forceArrowLength,
    "#ec9b64",
    [0, -1, 0],
  );
  crate(root, layout.loadCenterY);
  return [
    {
      text: `${s.advantage} support ${s.advantage === 1 ? "section" : "sections"}`,
      at: [0.25, (top + bottom) / 2, 0.3],
      left: 76,
      top: 10,
    },
    {
      text: "Free end ↓",
      at: [endPoint[0], endPoint[1], 0.3],
      left: 76,
      top: 24,
    },
  ];
}
function lever(root: THREE.Group, s: MachineState): ExpansionLabel[] {
  const layout = leverKinematics(s);
  const { pivotX, pivotY, outputArmM: outputArm, angle } = layout;
  const base = material("#6795a2", 0.58),
    beam = material("#ca9f55", 0.3);
  box(
    root,
    [0.22, pivotY - 0.25, 0.34],
    [pivotX, (pivotY - 0.25) / 2, -0.18],
    base,
  );
  box(root, [0.85, 0.15, 0.75], [pivotX, 0.08, -0.18], base);
  const fulcrum = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.7, 3), base);
  fulcrum.position.set(pivotX, pivotY - 0.38, 0);
  root.add(fulcrum);
  const arm = new THREE.Group();
  arm.position.set(pivotX, pivotY, 0);
  arm.rotation.z = angle;
  root.add(arm);
  box(
    arm,
    [outputArm * (1 + s.advantage), 0.12, 0.28],
    [(outputArm * (s.advantage - 1)) / 2, 0, 0],
    beam,
  );
  for (let i = -1; i <= s.advantage; i++)
    box(arm, [0.025, 0.025, 0.3], [i * outputArm, 0.075, 0], base);
  const axle = cylinder(root, 0.12, 0.55, [pivotX, pivotY, 0], base);
  axle.rotation.x = Math.PI / 2;
  crate(root, layout.loadCenterY, layout.loadX);
  const effort = new THREE.Group();
  effort.name = "lever-effort-point";
  effort.position.set(layout.effortX, layout.effortY, 0);
  root.add(effort);
  arrow(effort, [0, 0.78, 0], 0.55, "#e6a067", [0, -1, 0]);
  return [
    {
      text: `Arms · 1:${s.advantage}`,
      at: [pivotX + outputArm, pivotY, 0],
      left: 80,
      top: 9,
    },
    {
      text: "Fulcrum",
      at: [pivotX, pivotY - 0.15, 0.5],
      left: 50,
      top: 77,
    },
    {
      text: `Effort ↓ ${(s.advantage * s.liftM).toFixed(1)} m`,
      at: [layout.effortX, layout.effortY, 0.1],
      left: 80,
      top: 91,
    },
  ];
}
function gears(root: THREE.Group, s: MachineState): ExpansionLabel[] {
  const steel = material("#6795a2", 0.68),
    layout = gearKinematics(s),
    r = layout.driverRadius,
    outputR = layout.drivenRadius,
    outputX = layout.drivenX,
    y = layout.gearY,
    inputX = layout.driverX;
  for (const x of [-2.4, 2.3])
    box(root, [0.2, 3.7, 0.25], [x, 1.85, -0.3], steel);
  box(root, [4.9, 0.2, 0.35], [0, y, -0.3], steel);
  const driver = gear(
    root,
    r,
    layout.driverTeeth,
    [inputX, y, 0.1],
    "#b7d4d7",
    layout.inputAngle,
  );
  driver.name = "driver-gear";
  const driven = gear(
    root,
    outputR,
    layout.drivenTeeth,
    [outputX, y, 0.1],
    "#bb995a",
    layout.outputAngle,
  );
  driven.name = "driven-gear";
  const drum = cylinder(
    root,
    0.2,
    0.5,
    [outputX, y, 0.5],
    material("#7e9aa4", 0.8),
  );
  drum.name = "rope-drum";
  drum.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.205, 0.014, 6, 28),
      material("#efcf7a"),
    );
    ring.position.set(outputX, y, 0.28 + i * 0.055);
    root.add(ring);
  }
  const crank = new THREE.Group();
  crank.name = "input-crank";
  crank.position.set(inputX, y, 0.4);
  crank.rotation.z = layout.inputAngle;
  root.add(crank);
  bar(crank, [0, 0, 0], [0.2, 0, 0], 0.045, steel);
  bar(crank, [0.2, 0, 0], [0.2, 0, 0.35], 0.065, material("#df8e58"));
  rope(
    root,
    [
      [outputX + 0.2, y, 0.5],
      [outputX + 0.2, 1.12 + s.liftM, 0.1],
    ],
    material("#f0d083"),
  );
  crate(root, layout.loadCenterY, outputX + 0.2);
  return [
    {
      text: "Driver · 12 teeth",
      at: [inputX, y, 0.1],
      left: 20,
      top: 9,
    },
    {
      text: `Driven · ${layout.drivenTeeth} teeth`,
      at: [outputX, y, 0.1],
      left: 80,
      top: 9,
    },
    {
      text: "Crank + drum radii · 0.20 m",
      at: [(inputX + outputX) / 2, y, 0.5],
      left: 50,
      top: 23,
    },
  ];
}
export function createMachineScene(
  initial: MachineState,
): ExpansionScene<MachineState> {
  const group = new THREE.Group();
  bench(group, 7.3, 3.8);
  addWorkshopDetails(group);
  let dynamic: THREE.Group | undefined,
    labels: ExpansionLabel[] = [],
    state = normalizeMachine(initial);
  function update(input: MachineState) {
    state = normalizeMachine(input);
    dynamic = replaceGroup(group, dynamic);
    labels =
      state.mode === "pulley"
        ? pulley(dynamic, state)
        : state.mode === "lever"
          ? lever(dynamic, state)
          : gears(dynamic, state);
    addCrateStartReference(dynamic, state);
    const m = machineResult(state);
    const load = dynamic.getObjectByName("lifted-load");
    labels.push({
      text: `Load ${state.loadKg} kg · ${m.loadForceN.toFixed(0)} N`,
      at: [load?.position.x ?? 0, load?.position.y ?? 0.5, 0.6],
      left: 20,
      top: state.mode === "lever" ? 9 : 91,
    });
    if (state.liftM > 0) {
      const start = dynamic.getObjectByName("lift-start-reference");
      labels.push({
        text: "Start · 0 m",
        at: [
          start?.position.x ?? 0,
          start?.position.y ?? 0.5,
          0.7,
        ],
        left: state.mode === "lever" ? 20 : 80,
        top: 91,
      });
    }
    const rail = material("#95b8bd", 0.5);
    box(
      dynamic,
      [0.12, 1.12, 0.12],
      [-3.25, 0.86, 0.45],
      rail,
      "lift-height-scale",
    );
    for (let i = 0; i <= 10; i++)
      box(
        dynamic,
        [i % 5 ? 0.12 : 0.22, 0.012, 0.02],
        [-3.1, 0.36 + i * 0.1, 0.55],
        rail,
      );
    box(
      dynamic,
      [0.4, 0.09, 0.2],
      [-3.25, 0.36 + state.liftM * MACHINE_LIFT_SCALE, 0.55],
      material("#f4c36d"),
      "lift-height-marker",
    );
    labels.push({
      text: `Load rise · ${state.liftM.toFixed(1)} m`,
      at: [-3.1, 1.75, 0.6],
      left: 18,
      top: 55,
    });
  }
  update(initial);
  return {
    group,
    view: {
      position: [7, 5.5, 10],
      target: [0, 2.3, 0],
      width: 9.8,
      height: 8.2,
    },
    update,
    labels: () => labels,
    pick(ray) {
      const p = pickPlane(ray, 0.55);
      return p && p.x > -3.65 && p.x < -2.75 && p.y > 0.2 && p.y < 1.55
        ? Math.round(Math.max(0, Math.min(1, p.y - 0.36)) * 10) / 10
        : null;
    },
    dispose: () => disposeTree(group),
  };
}
