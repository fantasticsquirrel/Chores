import { describe, expect, it } from "vitest";
import { Raycaster, Vector3, Mesh, Group } from "three";
import {
  defaultMachineState,
  defaultHeatState,
  defaultPressureState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import { createMachineScene } from "./machineScene";
import { createHeatScene } from "./heatScene";
import { createPressureScene } from "./pressureScene";
const ray = (x: number, y: number) =>
  new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1));
function finiteGeometry(group: Group) {
  group.traverse((child) => {
    if (child instanceof Mesh) {
      expect(child.position.toArray().every(Number.isFinite)).toBe(true);
      const points = child.geometry.getAttribute("position");
      expect(Array.from(points.array).every(Number.isFinite)).toBe(true);
    }
  });
}
describe("native-reusable mechanics scenes", () => {
  it("rebuilds all machine arrangements without invalid geometry and preserves a direct lift control", () => {
    const scene = createMachineScene(defaultMachineState);
    for (const mode of ["pulley", "lever", "gears"] as const)
      for (const advantage of [1, 2, 3, 4])
        for (const liftM of [0, 1]) {
          scene.update({ ...defaultMachineState, mode, advantage, liftM });
          finiteGeometry(scene.group);
          expect(scene.group.getObjectByName("lifted-load")).toBeDefined();
        }
    expect(scene.pick?.(ray(-2.8, 0.9))).toBe(0.5);
    expect(scene.pick?.(ray(0, 0.9))).toBeNull();
    scene.dispose();
  });
  it("uses no heat-flow arrow at equal temperatures and reverses arrows for heat gain", () => {
    const scene = createHeatScene({ ...defaultHeatState, outsideC: 20 });
    let arrows = 0;
    scene.group.traverse((child) => {
      if (child.name === "direction-arrow") arrows++;
    });
    expect(arrows).toBe(0);
    scene.update({
      ...defaultHeatState,
      outsideC: 25,
      insulationCm: 20,
      windowM2: 18,
    });
    finiteGeometry(scene.group);
    const arrow = scene.group.getObjectByName("direction-arrow");
    expect(arrow).toBeDefined();
    expect(
      new Vector3(0, 1, 0).applyQuaternion(arrow!.quaternion).z,
    ).toBeCloseTo(-1);
    expect(scene.pick?.(ray(-3.1, 0.4))).toBe(10);
    scene.dispose();
  });
  it("updates tank geometry and removes the jet when the outlet is dry", () => {
    const scene = createPressureScene(defaultPressureState);
    expect(scene.group.getObjectByName("water-jet")).toBeDefined();
    for (const shape of ["narrow", "wide", "tapered"] as const) {
      scene.update({ ...defaultPressureState, shape, depthM: 3 });
      finiteGeometry(scene.group);
    }
    scene.update({ ...defaultPressureState, depthM: 0.2, outletM: 2.5 });
    expect(scene.group.getObjectByName("water-jet")).toBeUndefined();
    expect(
      scene.labels().some((label) => label.text.includes("Dry outlet")),
    ).toBe(true);
    expect(scene.pick?.(ray(-3, 2.18))).toBe(2);
    scene.dispose();
  });
});
