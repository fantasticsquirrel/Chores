import * as THREE from "three";
export const material = (color: string, metalness = 0, roughness = 0.7) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });
export function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  at: [number, number, number],
  mat: THREE.Material,
  name = "",
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...at);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}
export function cylinder(
  parent: THREE.Object3D,
  radius: number,
  length: number,
  at: [number, number, number],
  mat: THREE.Material,
  sides = 12,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, sides),
    mat,
  );
  mesh.position.set(...at);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function bar(
  parent: THREE.Object3D,
  from: [number, number, number],
  to: [number, number, number],
  width: number,
  mat: THREE.Material,
) {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to),
    direction = b.clone().sub(a);
  const mesh = box(parent, [width, direction.length(), width], [0, 0, 0], mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return mesh;
}
export function tube(
  parent: THREE.Object3D,
  points: [number, number, number][],
  radius: number,
  mat: THREE.Material,
  smooth = false,
) {
  const curve = smooth
    ? new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    : new THREE.CurvePath<THREE.Vector3>();
  if (!smooth)
    for (let i = 1; i < points.length; i++)
      (curve as THREE.CurvePath<THREE.Vector3>).add(
        new THREE.LineCurve3(
          new THREE.Vector3(...points[i - 1]),
          new THREE.Vector3(...points[i]),
        ),
      );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      smooth ? 100 : Math.max(20, points.length * 6),
      radius,
      8,
      false,
    ),
    mat,
  );
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
export function disposeObject(object: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.LineSegments ||
      child instanceof THREE.Line
    ) {
      child.geometry.dispose();
      const list = Array.isArray(child.material)
        ? child.material
        : [child.material];
      list.forEach((m) => materials.add(m));
    }
  });
  materials.forEach((m) => m.dispose());
}
export function screw(
  parent: THREE.Object3D,
  at: [number, number, number],
  mat: THREE.Material,
  radius = 0.055,
) {
  cylinder(parent, radius, 0.035, at, mat, 12);
  box(
    parent,
    [radius * 1.4, 0.008, 0.012],
    [at[0], at[1] + 0.022, at[2]],
    material("#37464a"),
  );
}
export function arrow(
  parent: THREE.Object3D,
  length: number,
  color: string,
  down = false,
) {
  const group = new THREE.Group();
  const mat = material(color, 0.25, 0.35);
  cylinder(group, 0.035, 1, [0, 0.5, 0], mat);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 12), mat);
  cone.position.y = 1.05;
  group.add(cone);
  group.scale.y = length;
  if (down) group.rotation.z = Math.PI;
  parent.add(group);
  return group;
}
