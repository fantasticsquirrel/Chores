import { describe, expect, it } from "vitest";
import * as T from "three";
import {
  cloudResult,
  defaultCloudState,
  FALLING_PARTICLE_DIAMETER_UM,
  type CloudState,
} from "@family-manager/family-api/discovery-models/cloud-rain";
import { createCloudRainScene } from "./clouds";

const states: CloudState[] = [
  { ...defaultCloudState, upliftM: 0 },
  { ...defaultCloudState, upliftM: 400 },
  { ...defaultCloudState },
  { ...defaultCloudState, particleDiameterUm: 1_000 },
  {
    ...defaultCloudState,
    particleDiameterUm: 1_000,
    subcloudRelativeHumidityPercent: 20,
  },
  {
    temperatureC: 32,
    relativeHumidityPercent: 30,
    upliftM: 2_000,
    particleDiameterUm: 2_000,
    subcloudRelativeHumidityPercent: 100,
  },
];

describe("dimensional cloud and rain scene", () => {
  it("preserves rich terrain, water, parcel, cloud and state-specific precipitation", () => {
    const scene = createCloudRainScene(states[0]);
    for (const state of states) {
      scene.update(state);
      let meshes = 0;
      scene.group.traverse((object) => {
        if (object instanceof T.Mesh) {
          meshes += 1;
          object.geometry.computeBoundingBox();
          expect(Number.isFinite(object.geometry.boundingBox?.max.x)).toBe(
            true,
          );
        }
      });
      expect(meshes).toBeGreaterThan(70);
      expect(
        scene.group.getObjectByName("dimensional-weather-terrain"),
      ).toBeTruthy();
      expect(scene.group.getObjectByName("surface-water")).toBeTruthy();
      expect(
        scene.group.getObjectByName("evaporation-to-invisible-vapor"),
      ).toBeTruthy();
      expect(
        scene.group.getObjectByName("air-parcel-teaching-marker"),
      ).toBeTruthy();
      expect(
        scene.group.getObjectByName("estimated-condensation-level"),
      ).toBeTruthy();
      expect(scene.labels()).toHaveLength(4);
      expect(scene.labels().every((label) => label.left !== undefined)).toBe(
        true,
      );
    }
    scene.dispose();
  });

  it("shows cloud droplets, ground rain and virga as different geometry", () => {
    const scene = createCloudRainScene(defaultCloudState);
    expect(
      scene.group.getObjectByName("visible-liquid-cloud-droplets"),
    ).toBeTruthy();
    expect(
      scene.group.getObjectByName("precipitation-reaching-ground"),
    ).toBeFalsy();
    scene.update({ ...defaultCloudState, particleDiameterUm: 1_000 });
    expect(
      scene.group.getObjectByName("precipitation-reaching-ground"),
    ).toBeTruthy();
    expect(scene.group.getObjectByName("rain-impact-and-puddles")).toBeTruthy();
    scene.update({
      ...defaultCloudState,
      particleDiameterUm: 1_000,
      subcloudRelativeHumidityPercent: 20,
    });
    expect(
      scene.group.getObjectByName("virga-evaporating-before-ground"),
    ).toBeTruthy();
    expect(scene.group.getObjectByName("rain-impact-and-puddles")).toBeFalsy();
    scene.dispose();
  });

  it("draws no precipitation at zero condensate and sends every positive survivor to ground", () => {
    const scene = createCloudRainScene(defaultCloudState);
    const baseM = cloudResult({
      ...defaultCloudState,
      upliftM: 0,
    }).condensationHeightM;
    scene.update({
      ...defaultCloudState,
      upliftM: baseM,
      particleDiameterUm: 1_000,
    });
    expect(
      scene.group.getObjectByName("visible-liquid-cloud-droplets"),
    ).toBeFalsy();
    expect(
      scene.group.getObjectByName("precipitation-reaching-ground"),
    ).toBeFalsy();
    expect(
      scene.group.getObjectByName("virga-evaporating-before-ground"),
    ).toBeFalsy();

    const smallSurvivor = {
      ...defaultCloudState,
      particleDiameterUm: 300,
      subcloudRelativeHumidityPercent: 95,
    };
    const result = cloudResult(smallSurvivor);
    expect(result.groundParticleDiameterUm).toBeGreaterThan(0);
    expect(result.groundParticleDiameterUm).toBeLessThan(
      FALLING_PARTICLE_DIAMETER_UM,
    );
    expect(result.virga).toBe(false);
    scene.update(smallSurvivor);
    expect(
      scene.group.getObjectByName("precipitation-reaching-ground"),
    ).toBeTruthy();
    expect(
      scene.group.getObjectByName("virga-evaporating-before-ground"),
    ).toBeFalsy();
    scene.dispose();
  });

  it("disposes every generated geometry after repeated updates", () => {
    const scene = createCloudRainScene(defaultCloudState);
    const disposed = new Set<T.BufferGeometry>();
    scene.group.traverse((object) => {
      if (object instanceof T.Mesh)
        object.geometry.addEventListener("dispose", () =>
          disposed.add(object.geometry),
        );
    });
    const initialGeometries = new Set<T.BufferGeometry>();
    scene.group.traverse((object) => {
      if (object instanceof T.Mesh) initialGeometries.add(object.geometry);
    });
    scene.update({ ...defaultCloudState, particleDiameterUm: 1_000 });
    expect(disposed.size).toBe(initialGeometries.size);
    scene.dispose();
    expect(scene.group.children).toHaveLength(0);
  });
});
