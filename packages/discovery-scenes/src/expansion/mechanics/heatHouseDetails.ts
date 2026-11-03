import * as THREE from "three";
import type { HeatState } from "@family-manager/family-api/discovery-models/heat-house";
import { bar, box, cylinder, material } from "./geometry";

/** Static workshop context keeps the cutaway legible and gives the house material depth. */
export function addHeatHouseBackdrop(root: THREE.Group) {
  const backdrop = new THREE.Group();
  backdrop.name = "heat-house-backdrop";
  root.add(backdrop);
  const wall = material("#0c2730", 0.08, 0.82);
  const frame = material("#436f77", 0.6, 0.34);
  const copper = material("#c47f54", 0.58, 0.3);
  const steel = material("#8fb1b8", 0.64, 0.28);
  box(backdrop, [9.55, 4.75, 0.18], [0, 2.05, -2.72], wall);
  for (const x of [-4.55, 4.55])
    box(backdrop, [0.15, 4.65, 0.25], [x, 2.05, -2.56], frame);
  box(backdrop, [9.2, 0.15, 0.25], [0, 4.34, -2.56], frame);
  box(backdrop, [2.05, 1.28, 0.1], [3.23, 3.34, -2.5], material("#183f49"));
  for (let column = 0; column < 5; column++)
    for (let row = 0; row < 3; row++) {
      const fastener = cylinder(
        backdrop,
        0.025,
        0.06,
        [2.62 + column * 0.3, 2.98 + row * 0.3, -2.39],
        column % 2 ? steel : copper,
        8,
      );
      fastener.rotation.x = Math.PI / 2;
    }
  bar(backdrop, [-4.05, 3.7, -2.43], [-3.6, 2.72, -2.36], 0.05, steel);
  bar(backdrop, [-3.6, 2.72, -2.36], [-3.2, 3.25, -2.34], 0.05, copper);
}

export function addTemperatureThermometers(
  root: THREE.Group,
  state: HeatState,
) {
  const glass = new THREE.MeshStandardMaterial({
    color: "#d8ebea",
    transparent: true,
    opacity: 0.42,
    roughness: 0.16,
    metalness: 0.18,
  });
  const scale = (temperatureC: number) =>
    0.22 + ((temperatureC + 5) / 30) * 0.88;
  for (const [name, x, z, temperatureC, color] of [
    ["inside-thermometer", 1.82, -0.92, state.insideC, "#f1a55f"],
    ["outside-thermometer", 3.65, 1.74, state.outsideC, "#70cbd8"],
  ] as const) {
    const thermometer = new THREE.Group();
    thermometer.name = name;
    thermometer.position.set(x, 0.45, z);
    root.add(thermometer);
    cylinder(thermometer, 0.09, 1.22, [0, 0.6, 0], glass, 16);
    const height = scale(temperatureC);
    cylinder(
      thermometer,
      0.045,
      height,
      [0, height / 2 + 0.04, 0],
      material(color, 0.18, 0.3),
      14,
    );
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 18, 12),
      material(color, 0.18, 0.3),
    );
    bulb.position.y = 0.02;
    bulb.castShadow = true;
    thermometer.add(bulb);
    for (let tick = 0; tick < 5; tick++)
      box(
        thermometer,
        [0.12, 0.018, 0.035],
        [0.13, 0.2 + tick * 0.22, 0.06],
        material("#d6e8e4", 0.34, 0.36),
      );
  }
}

/** A 0–24 h rail visualizes energy accumulation while power remains fixed. */
export function addElapsedEnergyRail(root: THREE.Group, state: HeatState) {
  const rail = new THREE.Group();
  rail.name = "elapsed-energy-rail";
  rail.position.set(3.73, 0.28, 0.62);
  root.add(rail);
  const metal = material("#7fa9b1", 0.62, 0.34);
  const energy = material("#f2bd70", 0.25, 0.28);
  box(rail, [0.13, 1.85, 0.13], [0, 0.93, 0], metal);
  for (let hour = 0; hour <= 24; hour += 4)
    box(
      rail,
      [hour % 12 === 0 ? 0.42 : 0.27, 0.025, 0.08],
      [-0.08, 0.08 + (hour / 24) * 1.7, 0.08],
      metal,
    );
  const marker = box(
    rail,
    [0.48, 0.1, 0.22],
    [-0.03, 0.08 + (state.elapsedHours / 24) * 1.7, 0.11],
    energy,
    "elapsed-energy-marker",
  );
  marker.castShadow = true;
}
