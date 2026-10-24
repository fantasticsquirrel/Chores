import { describe, expect, it } from "vitest";
import * as T from "three";
import {
  initialCloud,
  initialMagnetic,
  initialPlate,
} from "@family-manager/family-api/discovery-models/expansion-earth";
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
    plates.update({ ...initialPlate, boundary: "convergent" });
    expect(plates.labels().some((l) => l.text.includes("subducting"))).toBe(
      true,
    );
    plates.dispose();
    const clouds = createCloudRainScene();
    clouds.update({ ...initialCloud, upliftM: 1800, dropletGrowth: 90 });
    expect(clouds.labels().some((l) => l.text.includes("rain"))).toBe(true);
    clouds.dispose();
    const magnets = createMagneticFieldsScene();
    magnets.update({ ...initialMagnetic, flipped: true });
    expect(magnets.labels().some((l) => l.text.includes("repel"))).toBe(true);
    magnets.dispose();
  });
});
