import * as THREE from "three";
export function box(
  group: THREE.Group,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
export function cylinder(
  group: THREE.Group,
  radius: number,
  height: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  topRadius = radius,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(topRadius, radius, height, 32),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
export function line(
  group: THREE.Group,
  points: number[][],
  material: THREE.LineBasicMaterial,
) {
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((point) => new THREE.Vector3(...point)),
  );
  const mesh = new THREE.Line(geometry, material);
  group.add(mesh);
  return mesh;
}
export function disposeGeometry(group: THREE.Object3D) {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line)
      object.geometry.dispose();
  });
}
export function roof(
  group: THREE.Group,
  width: number,
  depth: number,
  height: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
) {
  const triangle = new THREE.Shape();
  triangle.moveTo(-width / 2, 0);
  triangle.lineTo(0, height);
  triangle.lineTo(width / 2, 0);
  triangle.closePath();
  const mesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(triangle, { depth, bevelEnabled: false }),
    material,
  );
  mesh.position.set(x, y, z - depth / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
