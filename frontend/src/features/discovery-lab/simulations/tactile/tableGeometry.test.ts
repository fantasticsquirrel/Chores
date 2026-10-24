import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { disposeGroup, sector } from "./tableGeometry";
function topArea(geometry: THREE.BufferGeometry, z: number) {
  const positions = geometry.getAttribute("position");
  let area = 0;
  for (let i = 0; i < positions.count; i += 3) {
    if (
      ![i, i + 1, i + 2].every(
        (vertex) => Math.abs(positions.getZ(vertex) - z) < 1e-6,
      )
    )
      continue;
    const ax = positions.getX(i),
      ay = positions.getY(i);
    const bx = positions.getX(i + 1),
      by = positions.getY(i + 1);
    const cx = positions.getX(i + 2),
      cy = positions.getY(i + 2);
    area += Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / 2;
  }
  return area;
}
describe("tactile exhibit geometry", () => {
  it.each([2, 3, 4, 6, 8, 12, 24])(
    "uses proportional area for %i equal pizza slices",
    (parts) => {
      const geometry = sector(1.28, -0.7, (Math.PI * 2) / parts, 0.13);
      expect(topArea(geometry, 0.13) / (Math.PI * 1.28 ** 2)).toBeCloseTo(
        1 / parts,
        3,
      );
      geometry.dispose();
    },
  );
  it("can show a certain outcome as a complete circle", () => {
    const geometry = sector(1.72, -Math.PI / 2, Math.PI * 2, 0.038);
    expect(topArea(geometry, 0.038) / (Math.PI * 1.72 ** 2)).toBeCloseTo(1, 2);
    geometry.dispose();
  });
  it("releases shared textures and unused owned materials exactly once", () => {
    const root = new THREE.Group(),
      map = new THREE.Texture();
    const used = new THREE.MeshStandardMaterial({ map }),
      unused = new THREE.MeshStandardMaterial({ map });
    root.userData.ownedMaterials = [used, unused];
    root.add(
      new THREE.Mesh(new THREE.BoxGeometry(), used),
      new THREE.Mesh(new THREE.BoxGeometry(), used),
    );
    const mapDispose = vi.spyOn(map, "dispose"),
      usedDispose = vi.spyOn(used, "dispose"),
      unusedDispose = vi.spyOn(unused, "dispose");
    disposeGroup(root);
    expect(mapDispose).toHaveBeenCalledTimes(1);
    expect(usedDispose).toHaveBeenCalledTimes(1);
    expect(unusedDispose).toHaveBeenCalledTimes(1);
  });
});
