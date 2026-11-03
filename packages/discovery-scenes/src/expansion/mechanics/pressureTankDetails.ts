import * as THREE from "three";
import type { pressureResult } from "@family-manager/family-api/discovery-models/pressure-tank";
import { bar, box, cylinder, material, wheel } from "./geometry";

type PressureResult = ReturnType<typeof pressureResult>;

/** Static laboratory context gives the transparent vessel a material, measured setting. */
export function addHydraulicsLabBackdrop(root: THREE.Group) {
  const backdrop = new THREE.Group();
  backdrop.name = "hydraulics-lab-backdrop";
  root.add(backdrop);
  const wall = material("#0b2832", 0.08, 0.84);
  const steel = material("#628994", 0.7, 0.3);
  const darkSteel = material("#294955", 0.72, 0.28);
  const copper = material("#b8774f", 0.62, 0.28);
  box(backdrop, [9.8, 4.7, 0.18], [0, 2.08, -2.72], wall);
  for (const x of [-4.7, 4.7])
    box(backdrop, [0.15, 4.6, 0.24], [x, 2.08, -2.57], darkSteel);
  box(backdrop, [9.45, 0.15, 0.24], [0, 4.33, -2.57], darkSteel);
  box(backdrop, [2.5, 1.45, 0.11], [3.25, 3.15, -2.52], material("#173f4a"));
  for (let column = 0; column < 6; column++)
    for (let row = 0; row < 4; row++)
      cylinder(
        backdrop,
        0.024,
        0.06,
        [2.5 + column * 0.3, 2.68 + row * 0.28, -2.42],
        (column + row) % 3 === 0 ? copper : steel,
        8,
      ).rotation.x = Math.PI / 2;
  bar(backdrop, [-4.15, 3.78, -2.43], [-3.45, 3.78, -2.43], 0.07, steel);
  bar(backdrop, [-3.45, 3.78, -2.43], [-3.45, 2.8, -2.43], 0.07, steel);
  bar(backdrop, [1.55, 4.02, -2.43], [4.15, 4.02, -2.43], 0.055, copper);
  for (const x of [2.2, 3.85]) {
    const valve = wheel(backdrop, 0.25, [x, 3.95, -2.29], "#c39457");
    valve.rotation.x = 0.06;
  }
  const lamp = new THREE.PointLight("#87d8e4", 2.2, 5.5);
  lamp.position.set(-2.1, 3.8, 1.2);
  backdrop.add(lamp);
}

/** Two calibrated dials make gauge-versus-absolute pressure visually explicit. */
export function addPressureGaugePanel(
  root: THREE.Group,
  result: PressureResult,
) {
  const panel = new THREE.Group();
  panel.name = "pressure-gauge-panel";
  panel.position.set(3.15, 2.58, -2.28);
  root.add(panel);
  const caseMaterial = material("#385762", 0.7, 0.3);
  const faceMaterial = material("#e8e5d6", 0.08, 0.56);
  const brass = material("#bf9655", 0.72, 0.28);
  box(panel, [2.35, 1.52, 0.16], [0, 0, 0], caseMaterial);
  for (const [index, value, max] of [
    [0, result.gaugePressurePa, 30_000],
    [1, result.absolutePressurePa, 135_000],
  ] as const) {
    const x = index === 0 ? -0.62 : 0.62;
    const dial = cylinder(panel, 0.43, 0.12, [x, 0.18, 0.16], faceMaterial, 32);
    dial.rotation.x = Math.PI / 2;
    const angle = Math.PI * 0.8 - Math.min(1, value / max) * Math.PI * 1.6;
    bar(
      panel,
      [x, 0.18, 0.24],
      [x + Math.cos(angle) * 0.31, 0.18 + Math.sin(angle) * 0.31, 0.24],
      0.018,
      material(index === 0 ? "#d45f46" : "#2f7d78"),
    );
    for (let tick = 0; tick <= 10; tick++) {
      const tickAngle = Math.PI * 0.8 - (tick / 10) * Math.PI * 1.6;
      bar(
        panel,
        [
          x + Math.cos(tickAngle) * 0.34,
          0.18 + Math.sin(tickAngle) * 0.34,
          0.23,
        ],
        [
          x + Math.cos(tickAngle) * 0.39,
          0.18 + Math.sin(tickAngle) * 0.39,
          0.23,
        ],
        0.009,
        brass,
      );
    }
    box(
      panel,
      [0.82, 0.14, 0.08],
      [x, -0.53, 0.16],
      material(index === 0 ? "#8bdde3" : "#f2c47c", 0.18, 0.4),
    );
  }
  for (const x of [-1.02, 1.02])
    for (const y of [-0.62, 0.62])
      cylinder(panel, 0.035, 0.05, [x, y, 0.13], brass, 8).rotation.x =
        Math.PI / 2;
}
