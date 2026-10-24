import * as THREE from "three";
import { machineResult, normalizeMachine, type MachineState } from "./model";
import type { ExpansionLabel, ExpansionScene } from "./types";
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
function arc(
  cx: number,
  cy: number,
  radius: number,
  start: number,
  end: number,
): Point[] {
  return Array.from({ length: 17 }, (_, i) => {
    const a = start + ((end - start) * i) / 16;
    return [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 0.24];
  });
}
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
  const steel = material("#547e8b", 0.65),
    cord = material("#f1ca71"),
    top = 4.45,
    bottom = 1.38 + s.liftM;
  for (const x of [-1.8, 1.8]) {
    box(root, [0.2, 4.65, 0.22], [x, 2.3, -0.2], steel);
    box(root, [0.7, 0.12, 1.1], [x, 0.12, -0.2], steel);
    bar(root, [x, 3.8, -0.2], [x * 0.65, 4.6, -0.2], 0.06, steel);
  }
  box(root, [3.8, 0.23, 0.34], [0, 4.65, -0.2], steel);
  let points: Point[];
  const end = 4.2 - s.liftM * s.advantage;
  if (s.advantage === 1) {
    wheel(root, 0.3, [0, top, 0.24]);
    points = [
      [-0.3, bottom, 0.24],
      ...arc(0, top, 0.3, Math.PI, 0),
      [0.3, end, 0.24],
    ];
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
    points = [
      [-0.25, top, 0.24],
      ...arc(0, bottom, 0.25, Math.PI, Math.PI * 2),
      ...arc(0.5, top, 0.25, Math.PI, 0),
      [0.75, end, 0.24],
    ];
  } else if (s.advantage === 3) {
    wheel(root, 0.2, [0, bottom, 0.24]);
    wheel(root, 0.2, [-0.4, top, 0.24]);
    wheel(root, 0.2, [0.4, top, 0.24]);
    points = [
      [-0.6, bottom, 0.24],
      ...arc(-0.4, top, 0.2, Math.PI, 0),
      ...arc(0, bottom, 0.2, Math.PI, Math.PI * 2),
      ...arc(0.4, top, 0.2, Math.PI, 0),
      [0.6, end, 0.24],
    ];
    bar(root, [-0.6, bottom, 0.24], [0, bottom, 0.24], 0.045, steel);
  } else {
    for (const x of [-0.4, 0.4]) wheel(root, 0.2, [x, bottom, 0.24]);
    for (const x of [0, 0.8]) wheel(root, 0.2, [x, top, 0.24]);
    points = [
      [-0.6, top, 0.24],
      ...arc(-0.4, bottom, 0.2, Math.PI, Math.PI * 2),
      ...arc(0, top, 0.2, Math.PI, 0),
      ...arc(0.4, bottom, 0.2, Math.PI, Math.PI * 2),
      ...arc(0.8, top, 0.2, Math.PI, 0),
      [1, end, 0.24],
    ];
    bar(root, [-0.4, bottom, 0.24], [0.4, bottom, 0.24], 0.045, steel);
  }
  rope(root, points, cord);
  if (s.advantage > 1)
    bar(root, [0, bottom, 0.24], [0, 1.12 + s.liftM, 0.1], 0.04, steel);
  const endPoint = points[points.length - 1];
  box(root, [0.34, 0.12, 0.18], endPoint, material("#e2754d"));
  arrow(
    root,
    [endPoint[0] + 0.28, end, 0.24],
    0.65 / s.advantage + 0.1,
    "#ec9b64",
    [0, -1, 0],
  );
  crate(root, 0.5 + s.liftM);
  return [
    {
      text: `${s.advantage} supporting rope ${s.advantage === 1 ? "section" : "sections"}`,
      at: [-0.75, 3.1, 0.3],
    },
    { text: "Pull ↓", at: [endPoint[0] + 0.4, end + 0.3, 0.3] },
  ];
}
function lever(root: THREE.Group, s: MachineState): ExpansionLabel[] {
  const pivotX = -1,
    pivotY = 2.2,
    outputArm = 0.65,
    angle = -Math.asin((s.liftM * 0.5) / outputArm);
  const base = material("#537d8d", 0.5),
    beam = material("#ca9f55", 0.3);
  const fulcrum = new THREE.Mesh(new THREE.ConeGeometry(0.45, pivotY, 3), base);
  fulcrum.position.set(pivotX, pivotY / 2, 0);
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
  const loadX = pivotX - outputArm * Math.cos(angle),
    loadY = pivotY - outputArm * Math.sin(angle);
  crate(root, loadY - 0.66, loadX);
  const inputX = pivotX + outputArm * s.advantage * Math.cos(angle),
    inputY = pivotY + outputArm * s.advantage * Math.sin(angle);
  arrow(root, [inputX, inputY + 0.9, 0], 0.6, "#e6a067", [0, -1, 0]);
  return [
    { text: `Load arm : effort arm = 1 : ${s.advantage}`, at: [0.2, 3.3, 0] },
    { text: "Fulcrum", at: [pivotX, 0.4, 0.5] },
    { text: "Push down", at: [inputX, inputY + 1.15, 0.1] },
  ];
}
function gears(root: THREE.Group, s: MachineState): ExpansionLabel[] {
  const steel = material("#567888", 0.65),
    r = 0.22,
    outputR = r * s.advantage,
    outputX = 0.55,
    y = 3;
  const turns = machineResult(s).crankTurns,
    inputX = outputX - r - outputR - 0.04;
  for (const x of [-2.4, 2.3])
    box(root, [0.2, 3.7, 0.25], [x, 1.85, -0.3], steel);
  box(root, [4.9, 0.2, 0.35], [0, y, -0.3], steel);
  gear(root, r, 12, [inputX, y, 0.1], "#a4c0c3", -turns * Math.PI * 2);
  gear(
    root,
    outputR,
    12 * s.advantage,
    [outputX, y, 0.1],
    "#bb995a",
    (turns * Math.PI * 2) / s.advantage + Math.PI / (12 * s.advantage),
  );
  const drum = cylinder(
    root,
    0.2,
    0.5,
    [outputX, y, 0.5],
    material("#7e9aa4", 0.8),
  );
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
  crank.position.set(inputX, y, 0.4);
  crank.rotation.z = -turns * Math.PI * 2;
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
  crate(root, 0.5 + s.liftM, outputX + 0.2);
  return [
    { text: `12 → ${12 * s.advantage} teeth`, at: [-0.6, 4.15, 0.1] },
    { text: "0.2 m crank", at: [inputX - 0.2, 2.45, 0.6] },
    { text: "0.2 m drum", at: [1.4, 3.55, 0.5] },
  ];
}
export function createMachineScene(
  initial: MachineState,
): ExpansionScene<MachineState> {
  const group = new THREE.Group();
  bench(group, 7.3, 3.8);
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
    const m = machineResult(state);
    labels.push({
      text: `${state.loadKg} kg · ${m.loadForceN.toFixed(0)} N`,
      at: [
        state.mode === "gears" ? 0.75 : state.mode === "lever" ? -1.6 : 0,
        state.mode === "lever" ? 1.05 : 0.2 + state.liftM,
        0.6,
      ],
    });
    const rail = material("#95b8bd", 0.5);
    box(dynamic, [0.12, 1.3, 0.12], [-2.8, 0.9, 0.45], rail);
    for (let i = 0; i <= 10; i++)
      box(
        dynamic,
        [i % 5 ? 0.12 : 0.22, 0.012, 0.02],
        [-2.65, 0.3 + i * 0.12, 0.55],
        rail,
      );
    box(
      dynamic,
      [0.4, 0.09, 0.2],
      [-2.8, 0.3 + state.liftM * 1.2, 0.55],
      material("#f4c36d"),
    );
    labels.push({
      text: `Lift ${state.liftM.toFixed(1)} m ↕`,
      at: [-2.8, 1.9, 0.6],
    });
  }
  update(initial);
  return {
    group,
    view: {
      position: [7, 5.5, 10],
      target: [0, 2.2, 0],
      width: 7.8,
      height: 6.1,
    },
    update,
    labels: () => labels,
    pick(ray) {
      const p = pickPlane(ray, 0.55);
      return p && p.x > -3.2 && p.x < -2.35 && p.y > 0.15 && p.y < 1.65
        ? Math.round(Math.max(0, Math.min(1, (p.y - 0.3) / 1.2)) * 10) / 10
        : null;
    },
    dispose: () => disposeTree(group),
  };
}
