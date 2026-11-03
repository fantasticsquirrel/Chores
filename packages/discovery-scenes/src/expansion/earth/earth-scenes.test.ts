import { describe, expect, it } from "vitest";
import * as T from "three";
import {
  initialCloud,
  initialMagnetic,
  initialPlate,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import { FAULT_SLIP_LIMIT } from "@family-manager/family-api/discovery-models/moving-plates";
import { createMovingPlatesScene } from "./plates";
import { createCloudRainScene } from "./clouds";
import { createMagneticFieldsScene } from "./magnets";
describe("rich reusable earth scenes", () => {
  it("builds detailed geometry with labels and releases all geometry on replacement/disposal", () => {
    const scenes = [
      createMovingPlatesScene(),
      createCloudRainScene(),
      createMagneticFieldsScene(),
    ];
    for (const scene of scenes) {
      let meshes = 0;
      scene.group.traverse((object) => {
        if (object instanceof T.Mesh) {
          meshes++;
          const box =
            object.geometry.boundingBox ??
            (object.geometry.computeBoundingBox(), object.geometry.boundingBox);
          expect(Number.isFinite(box?.max.x)).toBe(true);
        }
      });
      expect(meshes).toBeGreaterThan(50);
      expect(scene.labels().length).toBeGreaterThanOrEqual(3);
      const disposed: T.BufferGeometry[] = [];
      scene.group.traverse((object) => {
        if (object instanceof T.Mesh)
          object.geometry.addEventListener("dispose", () =>
            disposed.push(object.geometry),
          );
      });
      scene.dispose();
      expect(scene.group.children).toHaveLength(0);
      expect(disposed.length).toBeGreaterThan(50);
    }
  });
  it("updates and changes scientific labels without requiring a DOM", () => {
    const plates = createMovingPlatesScene();
    expect(plates.labels().some((l) => l.text === "Oceanic lithosphere")).toBe(
      true,
    );
    expect(
      plates
        .labels()
        .some((l) => l.text === "Asthenosphere · solid rock, slow flow"),
    ).toBe(true);
    plates.update({ ...initialPlate, boundary: "convergent" });
    expect(
      plates.labels().some((l) => l.text === "Subducting oceanic lithosphere"),
    ).toBe(true);
    expect(
      plates.labels().some((l) => l.text === "Continental lithosphere"),
    ).toBe(true);
    const slab = plates.group.getObjectByName("subducting-oceanic-lithosphere");
    const exposedSlab = plates.group.getObjectByName(
      "exposed-subducting-oceanic-lithosphere",
    );
    expect(slab).toBeTruthy();
    expect(slab!.rotation.z).toBeLessThan(0);
    expect(exposedSlab).toBeTruthy();
    expect(exposedSlab!.position.z).toBeGreaterThan(3.7);
    plates.group.updateMatrixWorld(true);
    expect(new T.Box3().setFromObject(slab!).max.y).toBeLessThan(-0.45);
    expect(new T.Box3().setFromObject(exposedSlab!).max.y).toBeLessThan(-0.45);
    expect(
      plates.group.getObjectByName("localized-mantle-wedge-melt"),
    ).toBeTruthy();
    plates.update({ ...initialPlate, boundary: "transform", loadingStep: 4 });
    expect(
      plates.labels().some((l) => l.text === "Locked transform fault"),
    ).toBe(true);
    plates.dispose();
    const clouds = createCloudRainScene();
    clouds.update({
      ...initialCloud,
      upliftM: 1_600,
      particleDiameterUm: 1_000,
    });
    expect(clouds.labels().some((l) => l.text.includes("rain at ground"))).toBe(
      true,
    );
    clouds.dispose();
    const magnets = createMagneticFieldsScene();
    magnets.update({ ...initialMagnetic, flipped: true });
    expect(magnets.labels().some((l) => l.text.includes("repel"))).toBe(true);
    magnets.dispose();
  });

  it("keeps the full motion range and every bounded slip observable", () => {
    const plates = createMovingPlatesScene({
      ...initialPlate,
      rateCmPerYear: 4,
      elapsedMillionYears: 5,
    });
    const widthAt200 = (
      plates.group.getObjectByName("new-oceanic-crust") as T.Mesh<T.BoxGeometry>
    ).geometry.parameters.width;
    const leftSurface = plates.group.getObjectByName("left-oceanic-surface");
    plates.group.updateMatrixWorld(true);
    expect(new T.Box3().setFromObject(leftSurface!).max.y).toBeLessThan(0.17);
    expect(plates.group.getObjectByName("ridge-ocean-water")).toBeTruthy();
    plates.update({
      ...initialPlate,
      rateCmPerYear: 10,
      elapsedMillionYears: 5,
    });
    const widthAt500 = (
      plates.group.getObjectByName("new-oceanic-crust") as T.Mesh<T.BoxGeometry>
    ).geometry.parameters.width;
    expect(widthAt500).toBeGreaterThan(widthAt200);

    plates.update({ ...initialPlate, boundary: "transform", slips: 1 });
    const firstOffset = plates.group.getObjectByName(
      "right-transform-lithosphere",
    )!.position.z;
    expect(firstOffset).toBeGreaterThanOrEqual(0.24);
    expect(
      plates.group.getObjectByName("illustrated-slip-tally-1"),
    ).toBeTruthy();
    plates.update({
      ...initialPlate,
      boundary: "transform",
      slips: FAULT_SLIP_LIMIT,
    });
    const finalOffset = plates.group.getObjectByName(
      "right-transform-lithosphere",
    )!.position.z;
    expect(finalOffset).toBeGreaterThan(firstOffset);
    expect(
      plates.group.getObjectByName(
        `illustrated-slip-tally-${FAULT_SLIP_LIMIT}`,
      ),
    ).toBeTruthy();
    plates.dispose();
  });
});
