import { describe, expect, it } from "vitest";
import {
  Box3,
  Group,
  Mesh,
  OrthographicCamera,
  Raycaster,
  Spherical,
  Vector3,
} from "three";
import {
  defaultMachineState,
  defaultHeatState,
  defaultPressureState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import { createMachineScene } from "./machineScene";
import {
  gearKinematics,
  leverKinematics,
  pulleyKinematics,
} from "./machineKinematics";
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
function expectSceneInsideView(
  scene: ReturnType<typeof createMachineScene>,
  aspect: number,
  yawOffset = 0,
) {
  scene.group.updateMatrixWorld(true);
  const target = new Vector3(...scene.view.target);
  const initial = new Vector3(...scene.view.position).sub(target);
  const spherical = new Spherical().setFromVector3(initial);
  spherical.theta += yawOffset;
  const width = Math.max(scene.view.width, scene.view.height * aspect);
  const height = width / aspect;
  const camera = new OrthographicCamera(
    -width / 2,
    width / 2,
    height / 2,
    -height / 2,
    0.1,
    150,
  );
  camera.position.setFromSpherical(spherical).add(target);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene.group);
  const corners = [
    [bounds.min.x, bounds.min.y, bounds.min.z],
    [bounds.min.x, bounds.min.y, bounds.max.z],
    [bounds.min.x, bounds.max.y, bounds.min.z],
    [bounds.min.x, bounds.max.y, bounds.max.z],
    [bounds.max.x, bounds.min.y, bounds.min.z],
    [bounds.max.x, bounds.min.y, bounds.max.z],
    [bounds.max.x, bounds.max.y, bounds.min.z],
    [bounds.max.x, bounds.max.y, bounds.max.z],
  ];
  for (const corner of corners) {
    const projected = new Vector3(...corner).project(camera);
    expect(
      Math.abs(projected.x),
      `x at aspect ${aspect.toFixed(3)}, yaw ${yawOffset}, corner ${corner.join(",")}`,
    ).toBeLessThan(0.94);
    expect(
      Math.abs(projected.y),
      `y at aspect ${aspect.toFixed(3)}, yaw ${yawOffset}, corner ${corner.join(",")}`,
    ).toBeLessThan(0.94);
  }
}
describe("native-reusable mechanics scenes", () => {
  it("rebuilds all machine arrangements without invalid geometry and preserves a direct lift control", () => {
    const scene = createMachineScene(defaultMachineState);
    expect(scene.group.getObjectByName("workshop-backdrop")).toBeDefined();
    expect(scene.group.getObjectByName("lift-start-reference")).toBeDefined();
    for (const mode of ["pulley", "lever", "gears"] as const)
      for (const advantage of [1, 2, 3, 4])
        for (const liftM of [0, 1]) {
          scene.update({ ...defaultMachineState, mode, advantage, liftM });
          finiteGeometry(scene.group);
          expect(scene.group.getObjectByName("lifted-load")).toBeDefined();
        }
    scene.update({ ...defaultMachineState, mode: "lever" });
    expect(
      scene.group.getObjectByName("lift-start-reference")?.position.y,
    ).toBeCloseTo(3.39);
    expect(scene.pick?.(ray(-2.8, 0.9))).toBe(0.5);
    expect(scene.pick?.(ray(0, 0.9))).toBeNull();
    scene.update({
      ...defaultMachineState,
      mode: "pulley",
      advantage: 4,
      liftM: 1,
    });
    const forceArrow = scene.group.getObjectByName("direction-arrow");
    expect(forceArrow).toBeDefined();
    expect(new Box3().setFromObject(forceArrow!).min.y).toBeGreaterThan(0.1);
    scene.update({ ...defaultMachineState, liftM: 0 });
    expect(scene.group.getObjectByName("lift-start-reference")).toBeUndefined();
    scene.dispose();
  });
  it("uses one common scene metre for every load and the full lever effort ratio", () => {
    for (const advantage of [1, 2, 3, 4]) {
      const start = leverKinematics({
        ...defaultMachineState,
        mode: "lever",
        advantage,
        liftM: 0,
      });
      const raised = leverKinematics({
        ...defaultMachineState,
        mode: "lever",
        advantage,
        liftM: 1,
      });
      expect(raised.loadCenterY - start.loadCenterY).toBeCloseTo(1);
      expect(raised.effortY - start.effortY).toBeCloseTo(-advantage);
      expect(raised.effortY).toBeGreaterThanOrEqual(0);
      expect(raised.loadCenterY).toBeLessThan(4.75);
    }
    const scene = createMachineScene(defaultMachineState);
    for (const mode of ["pulley", "lever", "gears"] as const) {
      scene.update({ ...defaultMachineState, mode, liftM: 0 });
      const startY = scene.group.getObjectByName("lifted-load")!.position.y;
      scene.update({ ...defaultMachineState, mode, liftM: 1 });
      const raisedY = scene.group.getObjectByName("lifted-load")!.position.y;
      expect(raisedY - startY).toBeCloseTo(1);
    }
    scene.dispose();
  });
  it("protects pulley topology, fixed anchors and free-end travel", () => {
    const scene = createMachineScene(defaultMachineState);
    for (const advantage of [1, 2, 3, 4]) {
      const start = pulleyKinematics({
        ...defaultMachineState,
        advantage,
        liftM: 0,
      });
      const raised = pulleyKinematics({
        ...defaultMachineState,
        advantage,
        liftM: 1,
      });
      expect(start.supportingSectionCount).toBe(advantage);
      expect(raised.freeEndY - start.freeEndY).toBeCloseTo(-advantage);
      expect(raised.loadCenterY - start.loadCenterY).toBeCloseTo(1);
      scene.update({ ...defaultMachineState, advantage, liftM: 1 });
      expect(Boolean(scene.group.getObjectByName("fixed-rope-anchor"))).toBe(
        advantage % 2 === 0,
      );
    }
    scene.dispose();
  });
  it("protects gear radii, teeth, opposite rotation and drum/load correspondence", () => {
    const scene = createMachineScene(defaultMachineState);
    for (const advantage of [1, 2, 3, 4]) {
      const start = gearKinematics({
        ...defaultMachineState,
        mode: "gears",
        advantage,
        liftM: 0,
      });
      const raised = gearKinematics({
        ...defaultMachineState,
        mode: "gears",
        advantage,
        liftM: 1,
      });
      const inputDelta = raised.inputAngle - start.inputAngle;
      const outputDelta = raised.outputAngle - start.outputAngle;
      expect(Math.sign(inputDelta)).toBe(-Math.sign(outputDelta));
      expect(Math.abs(inputDelta / outputDelta)).toBeCloseTo(advantage);
      expect(raised.drivenTeeth).toBe(12 * advantage);
      expect(raised.drivenRadius / raised.driverRadius).toBeCloseTo(advantage);
      expect(raised.crankRadiusM).toBe(0.2);
      expect(raised.drumRadiusM).toBe(0.2);
      expect(raised.drumTurns - start.drumTurns).toBeCloseTo(
        1 / (2 * Math.PI * 0.2),
      );
      expect(raised.loadCenterY - start.loadCenterY).toBeCloseTo(1);
      scene.update({
        ...defaultMachineState,
        mode: "gears",
        advantage,
        liftM: 1,
      });
      expect(scene.group.getObjectByName("driver-gear")).toBeDefined();
      expect(scene.group.getObjectByName("driven-gear")).toBeDefined();
      expect(scene.group.getObjectByName("rope-drum")).toBeDefined();
      expect(scene.group.getObjectByName("input-crank")).toBeDefined();
    }
    scene.dispose();
  });
  it("frames the full workshop with margin on desktop, mobile and rotated views", () => {
    const scene = createMachineScene(defaultMachineState);
    for (const mode of ["pulley", "lever", "gears"] as const)
      for (const advantage of [1, 4])
        for (const liftM of [0, 1]) {
          scene.update({ ...defaultMachineState, mode, advantage, liftM });
          for (const aspect of [1116 / 520, 336 / 380])
            for (const yaw of [-0.55, 0, 0.55])
              expectSceneInsideView(scene, aspect, yaw);
        }
    scene.dispose();
  });
  it("keeps machine callouts in screen gutters with leaders anchored to real parts", () => {
    const scene = createMachineScene(defaultMachineState);
    for (const mode of ["pulley", "lever", "gears"] as const) {
      scene.update({
        ...defaultMachineState,
        mode,
        advantage: 4,
        liftM: 1,
      });
      const labels = scene.labels();
      expect(labels.every((label) => label.left !== undefined)).toBe(true);
      expect(labels.every((label) => label.top !== undefined)).toBe(true);
      for (const label of labels) {
        expect(label.left).toBeGreaterThanOrEqual(9);
        expect(label.left).toBeLessThanOrEqual(91);
        expect(label.top).toBeGreaterThanOrEqual(9);
        expect(label.top).toBeLessThanOrEqual(91);
      }
      const load = scene.group.getObjectByName("lifted-load")!;
      const loadLabel = labels.find((label) => label.text.startsWith("Load "))!;
      expect(loadLabel.at[0]).toBeCloseTo(load.position.x);
      expect(loadLabel.at[1]).toBeCloseTo(load.position.y);
      const start = scene.group.getObjectByName("lift-start-reference")!;
      const startLabel = labels.find((label) => label.text === "Start · 0 m")!;
      expect(startLabel.at[0]).toBeCloseTo(start.position.x);
      expect(startLabel.at[1]).toBeCloseTo(start.position.y);
    }
    scene.update({
      ...defaultMachineState,
      mode: "gears",
      advantage: 4,
    });
    expect(scene.labels().map((label) => label.text)).toEqual(
      expect.arrayContaining([
        "Driver · 12 teeth",
        "Driven · 48 teeth",
        "Crank + drum radii · 0.20 m",
      ]),
    );
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
  it("keeps Heat House evidence callouts in authored gutters and shows elapsed energy", () => {
    const scene = createHeatScene({
      ...defaultHeatState,
      elapsedHours: 24,
      insulationCm: 20,
      windowM2: 18,
    });
    const labels = scene.labels();
    expect(labels.every((label) => label.left !== undefined)).toBe(true);
    expect(labels.every((label) => label.top !== undefined)).toBe(true);
    expect(labels.map((label) => label.text)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Walls"),
        expect.stringContaining("Windows"),
        expect.stringContaining("24 h"),
        "Use thickness control",
      ]),
    );
    expect(scene.group.getObjectByName("heat-house-backdrop")).toBeDefined();
    expect(scene.group.getObjectByName("elapsed-energy-marker")).toBeDefined();
    for (const label of labels) {
      expect(label.left).toBeGreaterThanOrEqual(9);
      expect(label.left).toBeLessThanOrEqual(91);
      expect(label.top).toBeGreaterThanOrEqual(8);
      expect(label.top).toBeLessThanOrEqual(92);
    }
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
