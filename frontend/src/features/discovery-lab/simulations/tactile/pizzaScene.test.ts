// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildPizzaScene } from "./pizzaScene";
import { disposeGroup } from "./tableGeometry";

function topArea(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const top = geometry.boundingBox!.max.z;
  const positions = geometry.getAttribute("position");
  let area = 0;
  for (let i = 0; i < positions.count; i += 3) {
    if (
      ![i, i + 1, i + 2].every(
        (vertex) => Math.abs(positions.getZ(vertex) - top) < 1e-6,
      )
    )
      continue;
    const ax = positions.getX(i);
    const ay = positions.getY(i);
    const bx = positions.getX(i + 1);
    const by = positions.getY(i + 1);
    const cx = positions.getX(i + 2);
    const cy = positions.getY(i + 2);
    area += Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
  }
  return area;
}

function selectedLayerAreas(parts: number) {
  const scene = buildPizzaScene(
    [
      {
        n: parts,
        d: parts,
        slices: Array.from({ length: parts }, (_, i) => i),
      },
    ],
    0,
    false,
  );
  const areas = new Map<number, number>([
    [0.13, 0],
    [0.262, 0],
    [0.29, 0],
  ]);
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.parent?.userData.slice === undefined) return;
    for (const layerZ of areas.keys()) {
      if (Math.abs(object.position.z - layerZ) < 1e-6) {
        expect(object.parent.position.x).toBe(0);
        expect(object.parent.position.y).toBe(0);
        areas.set(layerZ, areas.get(layerZ)! + topArea(object.geometry));
      }
    }
  });
  const result = [...areas.values()];
  disposeGroup(scene);
  return result;
}

describe("pizza teaching geometry", () => {
  it("keeps every complete food layer's area invariant as equal cuts double", () => {
    const reference = selectedLayerAreas(2);
    for (const parts of [4, 8, 16, 24]) {
      const actual = selectedLayerAreas(parts);
      actual.forEach((area, layer) => {
        // Independent curve triangulation introduces a small approximation;
        // a removed angular gap is much larger as the part count increases.
        expect(Math.abs(area / reference[layer] - 1)).toBeLessThan(0.005);
      });
    }
  });
});
