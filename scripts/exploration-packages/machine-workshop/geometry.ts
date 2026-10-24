import * as THREE from "three";
export type Point = [number, number, number];
export const material = (color: string, metalness = 0, roughness = 0.65) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });
export function box(
  parent: THREE.Object3D,
  size: Point,
  at: Point,
  mat: THREE.Material,
  name = "",
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...at);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function cylinder(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  at: Point,
  mat: THREE.Material,
  sides = 24,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, sides),
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
  from: Point,
  to: Point,
  radius: number,
  mat: THREE.Material,
) {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to),
    d = b.clone().sub(a);
  const mesh = cylinder(parent, radius, d.length(), [0, 0, 0], mat, 12);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  if (d.length() > 0)
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      d.normalize(),
    );
  return mesh;
}
export function rope(
  parent: THREE.Object3D,
  points: Point[],
  mat: THREE.Material,
  radius = 0.025,
) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  points
    .slice(1)
    .forEach((to, index) =>
      path.add(
        new THREE.LineCurve3(
          new THREE.Vector3(...points[index]),
          new THREE.Vector3(...to),
        ),
      ),
    );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      path,
      Math.max(24, points.length * 3),
      radius,
      7,
      false,
    ),
    mat,
  );
  parent.add(mesh);
  return mesh;
}
export function wheel(
  parent: THREE.Object3D,
  radius: number,
  at: Point,
  color = "#bc9861",
) {
  const group = new THREE.Group();
  group.position.set(...at);
  parent.add(group);
  const metal = material(color, 0.65, 0.3),
    dark = material("#23313c", 0.6, 0.4);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.05, 8, 32),
    metal,
  );
  group.add(rim);
  const hub = cylinder(group, 0.09, 0.24, [0, 0, 0], dark);
  hub.rotation.x = Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    bar(
      group,
      [0, 0, 0],
      [Math.cos(a) * radius, Math.sin(a) * radius, 0],
      0.027,
      metal,
    );
  }
  return group;
}
export function gear(
  parent: THREE.Object3D,
  radius: number,
  teeth: number,
  at: Point,
  color: string,
  angle: number,
) {
  const group = wheel(parent, radius - 0.06, at, color);
  group.rotation.z = angle;
  const metal = material(color, 0.7, 0.28);
  for (let i = 0; i < teeth; i++) {
    const a = (i * Math.PI * 2) / teeth;
    const tooth = box(
      group,
      [0.085, 0.105, 0.12],
      [Math.cos(a) * radius, Math.sin(a) * radius, 0],
      metal,
    );
    tooth.rotation.z = a - Math.PI / 2;
  }
  return group;
}
export function arrow(
  parent: THREE.Object3D,
  at: Point,
  length: number,
  color: string,
  direction: Point = [0, 1, 0],
) {
  const group = new THREE.Group(),
    mat = material(color, 0.2, 0.35);
  group.name = "direction-arrow";
  cylinder(group, 0.028, length, [0, length / 2, 0], mat);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.17, 12), mat);
  tip.position.y = length + 0.07;
  group.add(tip);
  group.position.set(...at);
  group.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(...direction).normalize(),
  );
  parent.add(group);
  return group;
}
export function disposeTree(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  root.traverse((item) => {
    if (item instanceof THREE.Mesh || item instanceof THREE.Line) {
      item.geometry.dispose();
      (Array.isArray(item.material) ? item.material : [item.material]).forEach(
        (m) => materials.add(m),
      );
    }
  });
  materials.forEach((m) => m.dispose());
}
export function replaceGroup(root: THREE.Group, old: THREE.Group | undefined) {
  if (old) {
    root.remove(old);
    disposeTree(old);
  }
  const next = new THREE.Group();
  root.add(next);
  return next;
}
export function bench(root: THREE.Group, width = 7.3, depth = 4.8) {
  const wood = material("#9f7950"),
    edge = material("#4c6373", 0.7, 0.4);
  box(root, [width, 0.22, depth], [0, -0.15, 0], edge);
  for (let i = 0; i < 9; i++)
    box(
      root,
      [width / 9 - 0.025, 0.1, depth - 0.16],
      [-width / 2 + width / 18 + (i * width) / 9, 0, 0],
      wood,
    );
  for (const x of [-width / 2 + 0.16, width / 2 - 0.16])
    for (const z of [-depth / 2 + 0.18, depth / 2 - 0.18]) {
      cylinder(root, 0.055, 0.018, [x, 0.066, z], edge, 6);
    }
}
export function pickPlane(ray: THREE.Raycaster, z: number) {
  return ray.ray.intersectPlane(
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -z),
    new THREE.Vector3(),
  );
}
