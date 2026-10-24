import * as THREE from "three";
import {
  box,
  bar,
  cylinder,
  tube,
  material,
  disposeObject,
  screw,
} from "./sceneGeometry";
import type { CircuitSceneState, PhysicalSceneModel } from "./sceneTypes";
export function createCircuitScene(
  initial: CircuitSceneState,
): PhysicalSceneModel {
  const group = new THREE.Group();
  const board = material("#b69e77", 0, 0.8),
    edge = material("#614c38"),
    brass = material("#c2ab79", 0.75, 0.3),
    porcelain = material("#d5d2b7", 0.05, 0.5),
    dark = material("#25323a", 0.1, 0.65);
  box(group, [14, 0.23, 8.2], [0, -0.53, 0], material("#122931"));
  box(group, [13, 0.35, 6.8], [0, -0.2, 0], edge);
  box(group, [13.05, 0.08, 6.85], [0, 0.01, 0], board);
  for (let i = 0; i < 46; i++)
    box(
      group,
      [12.9, 0.002, 0.006],
      [0, 0.053, -3.3 + i * 0.145],
      material(i % 2 ? "#c3ad86" : "#9c875f"),
    );
  for (const x of [-6.1, 6.1])
    for (const z of [-3.1, 3.1]) screw(group, [x, 0.08, z], brass, 0.1);
  const battery = new THREE.Group();
  battery.position.set(-5.5, 0.1, 2.4);
  group.add(battery);
  box(battery, [1.2, 1.1, 0.85], [0, 0.55, 0], dark);
  box(battery, [1.23, 0.1, 0.88], [0, 1.14, 0], material("#536d78", 0.4, 0.4));
  for (const [x, color] of [
    [-0.32, "#d87155"],
    [0.32, "#a4b8bc"],
  ] as const) {
    cylinder(battery, 0.11, 0.17, [x, 1.26, 0], material(color, 0.65, 0.3));
  }
  box(battery, [0.23, 0.025, 0.045], [-0.32, 1.36, 0], porcelain);
  box(battery, [0.045, 0.025, 0.23], [-0.32, 1.36, 0], porcelain);
  box(battery, [0.23, 0.025, 0.045], [0.32, 1.36, 0], porcelain);
  box(battery, [0.85, 0.5, 0.012], [0, 0.58, 0.432], material("#c0c8b5"));
  // Three load modules share the same position; only their electrical paths change.
  const levers: THREE.Group[] = [];
  const windowMats: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 3; i++) {
    const x = -3.65 + i * 3.65;
    const house = new THREE.Group();
    house.position.set(x, 0.08, -0.65);
    group.add(house);
    const wall = material(["#c3c6b0", "#94abb1", "#b5a48e"][i]);
    box(house, [2.0, 0.14, 2.05], [0, 0.1, 0], porcelain, `switch-${i}`);
    box(house, [1.65, 1.32, 1.45], [0, 0.83, 0], wall, `switch-${i}`);
    // Gabled roof: extruded pentagonal silhouette with lit front, side and roof surfaces.
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-1, 0);
    roofShape.lineTo(0, 0.78);
    roofShape.lineTo(1, 0);
    roofShape.lineTo(-1, 0);
    const roof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roofShape, {
        depth: 1.75,
        bevelEnabled: false,
      }),
      material(["#5e7372", "#697580", "#8e6856"][i], 0.1, 0.7),
    );
    roof.position.set(0, 1.47, -0.875);
    roof.castShadow = true;
    roof.name = `switch-${i}`;
    house.add(roof);
    for (let row = 0; row < 5; row++)
      for (const side of [-1, 1]) {
        const xRoof = side * (0.12 + row * 0.18);
        const yRoof = 2.25 - Math.abs(xRoof) * 0.78;
        bar(house, [xRoof, yRoof, -0.9], [xRoof, yRoof, 0.9], 0.018, dark);
      }
    box(house, [0.28, 0.65, 0.32], [0.52, 2.0, -0.35], wall);
    const winMat = new THREE.MeshStandardMaterial({
      color: "#172d35",
      emissive: "#ffbc52",
      emissiveIntensity: 0,
      roughness: 0.3,
    });
    windowMats.push(winMat);
    for (const wx of [-0.47, 0.47]) {
      box(house, [0.5, 0.58, 0.07], [wx, 0.96, 0.76], dark);
      box(house, [0.4, 0.47, 0.075], [wx, 0.96, 0.8], winMat);
      box(house, [0.025, 0.5, 0.08], [wx, 0.96, 0.85], porcelain);
      box(house, [0.43, 0.025, 0.08], [wx, 0.96, 0.85], porcelain);
    }
    box(house, [0.27, 0.63, 0.08], [0, 0.56, 0.79], material("#526662"));
    for (const side of [-1, 1]) {
      cylinder(group, 0.11, 0.19, [x + side * 1.04, 0.16, 0.35], brass, 16);
      tube(
        group,
        [
          [x + side * 1.04, 0.2, 0.35],
          [x + side * 0.78, 0.2, 0.35],
          [x + side * 0.78, 0.46, 0.1],
        ],
        0.035,
        brass,
      );
    }
    const base = box(
      group,
      [1.12, 0.15, 0.66],
      [x, 0.13, 1.73],
      porcelain,
      `switch-${i}`,
    );
    base.name = `switch-${i}`;
    for (const side of [-1, 1])
      cylinder(group, 0.09, 0.2, [x + side * 0.4, 0.3, 1.73], brass, 16).name =
        `switch-${i}`;
    const lever = new THREE.Group();
    lever.position.set(x - 0.4, 0.42, 1.73);
    group.add(lever);
    bar(lever, [0, 0, 0], [0.8, 0, 0], 0.075, brass).name = `switch-${i}`;
    box(lever, [0.26, 0.14, 0.26], [0.35, 0.04, 0], dark, `switch-${i}`);
    levers.push(lever);
    for (const z of [1.51, 1.96]) screw(group, [x, 0.23, z], brass, 0.045);
  }
  const wires = new THREE.Group();
  group.add(wires);
  let previous = "";
  const update = (s: CircuitSceneState) => {
    levers.forEach((lever, i) => (lever.rotation.z = s.switches[i] ? 0 : 0.75));
    windowMats.forEach((m, i) => {
      const brightness = Math.min(1, s.power[i] / 27);
      m.color.set(s.power[i] > 0 ? "#fbd18a" : "#1b3038");
      m.emissiveIntensity = brightness * 1.9;
    });
    const key = `${s.mode}:${s.current.join()}`;
    if (key === previous) return;
    previous = key;
    disposeObject(wires);
    wires.clear();
    const active = (value: number) =>
      new THREE.MeshStandardMaterial({
        color: value > 0 ? "#c98551" : "#586d71",
        metalness: 0.42,
        roughness: 0.42,
        emissive: value > 0 ? "#9c5129" : "#000000",
        emissiveIntensity: 0.18,
      });
    const positive = new THREE.Vector3(-5.82, 1.44, 2.4),
      negative = new THREE.Vector3(-5.18, 1.44, 2.4);
    const first = -3.65,
      last = 3.65;
    const path = (pts: [number, number, number][], current: number) =>
      tube(wires, pts, 0.052, active(current));
    const marker = (x: number, z: number, current: number, angle: number) => {
      if (current <= 0) return;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.28, 12),
        material("#ffe0a1", 0.3, 0.4),
      );
      cone.rotation.z = -Math.PI / 2;
      cone.rotation.y = angle;
      cone.position.set(x, 0.18, z);
      wires.add(cone);
    };
    const total = s.current.reduce((a, b) => a + b, 0);
    if (s.mode === "series") {
      path(
        [
          [positive.x, positive.y, positive.z],
          [-6.28, 1.44, 2.4],
          [-6.28, 0.15, 2.4],
          [-6.28, 0.15, 1.73],
          [first - 0.4, 0.15, 1.73],
        ],
        total,
      );
      for (let i = 0; i < 3; i++) {
        const x = -3.65 + i * 3.65;
        path(
          [
            [x + 0.4, 0.31, 1.73],
            [x + 0.67, 0.15, 1.73],
            [x + 0.67, 0.15, 0.85],
            [x - 1.04, 0.15, 0.85],
            [x - 1.04, 0.2, 0.35],
          ],
          s.current[i],
        );
        if (i < 2) {
          path(
            [
              [x + 1.04, 0.2, 0.35],
              [x + 1.47, 0.15, 0.35],
              [x + 1.47, 0.15, 1.73],
              [x + 3.65 - 0.4, 0.31, 1.73],
            ],
            s.current[i],
          );
          marker(x + 2, 1.73, s.current[i], 0);
        }
      }
      path(
        [
          [last + 1.04, 0.2, 0.35],
          [5.65, 0.15, 0.35],
          [5.65, 0.15, 2.95],
          [-5.18, 0.15, 2.95],
          [-5.18, 0.15, 3.05],
          [-5.18, 1.44, 3.05],
          [negative.x, negative.y, negative.z],
        ],
        total,
      );
      marker(2.7, 2.95, total, Math.PI);
      marker(-1, 2.95, total, Math.PI);
    } else {
      path(
        [
          [positive.x, positive.y, positive.z],
          [-6.28, 1.44, 2.4],
          [-6.28, 0.15, 2.4],
          [-6.28, 0.15, 2.55],
          [5.65, 0.15, 2.55],
        ],
        total,
      );
      path(
        [
          [negative.x, negative.y, negative.z],
          [-5.18, 1.44, 1.65],
          [-6.0, 1.44, 1.65],
          [-6.0, 0.15, 1.65],
          [-6.0, 0.15, -2.45],
          [5.65, 0.15, -2.45],
        ],
        total,
      );
      for (let i = 0; i < 3; i++) {
        const x = -3.65 + i * 3.65;
        path(
          [
            [x - 0.4, 0.15, 2.55],
            [x - 0.4, 0.31, 1.73],
          ],
          s.current[i],
        );
        path(
          [
            [x + 0.4, 0.31, 1.73],
            [x + 0.64, 0.15, 1.73],
            [x + 0.64, 0.15, 0.85],
            [x - 1.04, 0.15, 0.85],
            [x - 1.04, 0.2, 0.35],
          ],
          s.current[i],
        );
        path(
          [
            [x + 1.04, 0.2, 0.35],
            [x + 1.3, 0.15, 0.35],
            [x + 1.3, 0.15, -2.45],
          ],
          s.current[i],
        );
        marker(x + 1.3, -1.6, s.current[i], Math.PI / 2);
        for (const [xx, z] of [
          [x - 0.4, 2.55],
          [x + 1.3, -2.45],
        ])
          cylinder(wires, 0.09, 0.05, [xx, 0.16, z], brass);
      }
    }
  };
  update(initial);
  return {
    group,
    view: {
      position: [6.8, 11, 15],
      target: [0, 0.35, 0],
      width: 15.4,
      height: 8.4,
    },
    update: (s) => {
      if (s.kind === "circuit") update(s);
    },
    interact: (name) =>
      name.startsWith("switch-")
        ? { type: "switch", index: Number(name.slice(7)) }
        : undefined,
    dispose: () => disposeObject(group),
  };
}
