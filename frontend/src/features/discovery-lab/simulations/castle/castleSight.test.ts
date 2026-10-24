import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createEvidence } from "./castleLandscape";
import { defaultCastleState } from "./castleState";
import type { CastleMaterials } from "./castleMaterials";
const materials = {
  gold: new THREE.MeshBasicMaterial(),
  sightOverlay: new THREE.LineDashedMaterial({ dashSize: 0.8, gapSize: 0.6 }),
} as CastleMaterials;
describe("nonstructural castle sight overlays", () => {
  it("draws no sight lines by default", () => {
    const scene = createEvidence(defaultCastleState, materials);
    expect(
      scene.children.filter((child) => child instanceof THREE.Line),
    ).toHaveLength(0);
  });
  it("uses dashed rays from one corner, staying outside the curtain walls", () => {
    const scene = createEvidence(
      { ...defaultCastleState, sight: true },
      materials,
    );
    const lines = scene.children.filter(
      (child): child is THREE.Line => child instanceof THREE.Line,
    );
    expect(lines).toHaveLength(2);
    for (const ray of lines) {
      expect(ray.material).toBe(materials.sightOverlay);
      expect(ray.geometry.getAttribute("lineDistance")).toBeTruthy();
      const points = ray.geometry.getAttribute("position");
      const outsideEast = [0, 1].every((i) => points.getX(i) >= 18);
      const outsideSouth = [0, 1].every((i) => points.getZ(i) >= 15);
      expect(outsideEast || outsideSouth).toBe(true);
    }
  });
});
