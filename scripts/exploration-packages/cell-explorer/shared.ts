import * as T from "three";
import {
  disposeGroup,
  ellipsoid,
  line,
  material,
  mesh,
  rod,
  v,
} from "./landscapeGeometry";
export { disposeGroup, ellipsoid, line, material, mesh, rod, v };
export function ring(
  group: T.Object3D,
  x: number,
  y: number,
  z: number,
  rx: number,
  rz: number,
  color: string,
  thickness = 0.04,
) {
  const points = Array.from({ length: 65 }, (_, i) =>
    v(
      x + rx * Math.cos((i * Math.PI) / 32),
      y,
      z + rz * Math.sin((i * Math.PI) / 32),
    ),
  );
  return line(group, points, color, thickness);
}
export function roundedPlate(
  group: T.Object3D,
  width: number,
  depth: number,
  height: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
) {
  const r = 0.5,
    w = width / 2,
    d = depth / 2,
    shape = new T.Shape();
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);
  const geometry = new T.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    bevelSegments: 3,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return mesh(group, geometry, material(color), x, y, z);
}
export function rebuild(group: T.Group, build: () => void) {
  disposeGroup(group);
  group.clear();
  build();
  group.updateMatrixWorld(true);
}
