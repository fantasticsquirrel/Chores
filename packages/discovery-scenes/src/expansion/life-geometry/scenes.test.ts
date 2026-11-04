import { describe, expect, it, vi } from "vitest";
import * as T from "three";
import {
  defaultCellExplorerState,
  defaultShapeSlicerState,
  defaultAdaptationIslandState,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";
import {
  createCellExplorerScene,
  createShapeSlicerScene,
  createAdaptationIslandScene,
} from "./index";
describe("React-free life and geometry scenes", () => {
  it("rebuilds cell compartments without accumulating meshes and excludes plant-only labels in animals", () => {
    const scene = createCellExplorerScene(defaultCellExplorerState);
    const count = scene.group.children.length;
    scene.update({ ...defaultCellExplorerState, inside: 5, outside: 11 });
    expect(scene.group.children.length).toBe(count);
    expect(scene.labels().map((label) => label.text)).toContain("Inside 5.0");
    expect(scene.labels().map((label) => label.text)).toContain(
      "Oxygen · lipid path",
    );
    scene.update({
      ...defaultCellExplorerState,
      molecule: "glucose",
      carrier: false,
    });
    expect(scene.labels().map((label) => label.text)).toContain(
      "Glucose · blocked",
    );
    scene.update({
      ...defaultCellExplorerState,
      cellType: "animal",
      selected: "chloroplast",
    });
    expect(scene.labels().map((label) => label.text)).not.toContain(
      "Chloroplast",
    );
    scene.dispose();
  });
  it("updates the exact section and releases old geometry", () => {
    const scene = createShapeSlicerScene(defaultShapeSlicerState);
    expect(scene.labels?.().map((label) => label.text)).toContain(
      "Section · square",
    );
    let geometry: T.BufferGeometry | undefined;
    scene.group.traverse((object) => {
      if (!geometry && object instanceof T.Mesh) geometry = object.geometry;
    });
    const dispose = vi.spyOn(geometry!, "dispose");
    scene.update({ ...defaultShapeSlicerState, tilt: 45, turn: 35.26438968 });
    expect(dispose).toHaveBeenCalledOnce();
    expect(
      scene.labels().some((label) => label.text === "Section · hexagon"),
    ).toBe(true);
    scene.update({ ...defaultShapeSlicerState, solid: "sphere", offset: 1.75 });
    expect(scene.labels?.().map((label) => label.text)).toContain(
      "Section · no intersection",
    );
    expect(
      scene
        .labels()
        .some((label) => label.text === "Section · no intersection"),
    ).toBe(true);
    scene.dispose();
  });
  it("updates the habitat and generation labels without requiring DOM", () => {
    const scene = createAdaptationIslandScene(defaultAdaptationIslandState);
    scene.update({
      ...defaultAdaptationIslandState,
      predators: false,
      habitat: "light",
      generation: 20,
    });
    expect(scene.labels().map((label) => label.text)).toEqual([
      "Generation 20",
      "Pale ground",
      "Predation excluded",
    ]);
    scene.dispose();
  });
});
