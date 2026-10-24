import * as T from "three";
type SceneLabel = { text: string; at: [number, number, number] };
export type BuiltLandscape = { group: T.Group; labels: SceneLabel[] };
export const material = (color: T.ColorRepresentation, roughness = 0.86) =>
  new T.MeshStandardMaterial({ color, roughness });
export function mesh(
  group: T.Object3D,
  geometry: T.BufferGeometry,
  surface: T.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const object = new T.Mesh(geometry, surface);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  group.add(object);
  return object;
}
export function box(
  group: T.Object3D,
  size: [number, number, number],
  color: T.ColorRepresentation,
  x = 0,
  y = 0,
  z = 0,
) {
  return mesh(group, new T.BoxGeometry(...size), material(color), x, y, z);
}
export function ellipsoid(
  group: T.Object3D,
  size: [number, number, number],
  color: T.ColorRepresentation,
  x = 0,
  y = 0,
  z = 0,
) {
  const object = mesh(
    group,
    new T.SphereGeometry(1, 18, 12),
    material(color),
    x,
    y,
    z,
  );
  object.scale.set(...size);
  return object;
}
export function line(
  group: T.Object3D,
  points: T.Vector3[],
  color: T.ColorRepresentation,
  radius = 0.025,
) {
  return mesh(
    group,
    new T.TubeGeometry(
      new T.CatmullRomCurve3(points),
      Math.max(12, points.length * 3),
      radius,
      5,
      false,
    ),
    material(color),
  );
}
export function rod(
  group: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  radius: number,
  color: T.ColorRepresentation,
) {
  const delta = b.clone().sub(a);
  const object = mesh(
    group,
    new T.CylinderGeometry(radius, radius, delta.length(), 7),
    material(color),
  );
  object.position.copy(a).add(b).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    delta.normalize(),
  );
  return object;
}
export const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
export const noise = (x: number, z: number) =>
  Math.sin(x * 2.71 + z * 1.4) * Math.cos(z * 3.12 - x * 0.7);
export function terrain(
  group: T.Object3D,
  width: number,
  depth: number,
  height: (x: number, z: number) => number,
  color: (x: number, z: number, y: number) => T.Color,
  segments = 80,
) {
  const geometry = new T.PlaneGeometry(width, depth, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors: number[] = [];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      z = position.getZ(i),
      y = height(x, z);
    position.setY(i, y);
    const c = color(x, z, y);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const sides: number[] = [],
    sideIndices: number[] = [];
  const edges = [
    Array.from({ length: segments + 1 }, (_, i) => [
      -width / 2 + (i * width) / segments,
      -depth / 2,
    ]),
    Array.from({ length: segments + 1 }, (_, i) => [
      width / 2,
      -depth / 2 + (i * depth) / segments,
    ]),
    Array.from({ length: segments + 1 }, (_, i) => [
      width / 2 - (i * width) / segments,
      depth / 2,
    ]),
    Array.from({ length: segments + 1 }, (_, i) => [
      -width / 2,
      depth / 2 - (i * depth) / segments,
    ]),
  ];
  for (const edge of edges)
    for (let i = 0; i < edge.length - 1; i++) {
      const [x, z] = edge[i],
        [xx, zz] = edge[i + 1],
        offset = sides.length / 3;
      sides.push(
        x,
        height(x, z),
        z,
        x,
        -0.02,
        z,
        xx,
        height(xx, zz),
        zz,
        xx,
        -0.02,
        zz,
      );
      sideIndices.push(
        offset,
        offset + 1,
        offset + 2,
        offset + 2,
        offset + 1,
        offset + 3,
      );
    }
  const skirt = new T.BufferGeometry();
  skirt.setAttribute("position", new T.Float32BufferAttribute(sides, 3));
  skirt.setIndex(sideIndices);
  skirt.computeVertexNormals();
  const soil = material("#91734e");
  soil.side = T.DoubleSide;
  mesh(group, skirt, soil);
  return mesh(
    group,
    geometry,
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.98 }),
  );
}
export function tree(
  group: T.Object3D,
  x: number,
  y: number,
  z: number,
  scale = 1,
  pine = false,
) {
  const trunk = mesh(
    group,
    new T.CylinderGeometry(0.06 * scale, 0.09 * scale, 0.7 * scale, 7),
    material("#735034"),
    x,
    y + 0.35 * scale,
    z,
  );
  trunk.castShadow = true;
  if (pine)
    for (let i = 0; i < 3; i++)
      mesh(
        group,
        new T.ConeGeometry((0.5 - i * 0.1) * scale, 0.9 * scale, 9),
        material(i % 2 ? "#44684b" : "#355840"),
        x,
        y + (0.65 + i * 0.32) * scale,
        z,
      );
  else
    for (let i = 0; i < 4; i++)
      ellipsoid(
        group,
        [0.42 * scale, 0.5 * scale, 0.4 * scale],
        i % 2 ? "#829454" : "#557c48",
        x + Math.sin(i * 2) * 0.22 * scale,
        y + (0.8 + (i % 2) * 0.24) * scale,
        z + Math.cos(i * 2) * 0.2 * scale,
      );
}
export function stone(
  group: T.Object3D,
  x: number,
  y: number,
  z: number,
  size = 0.2,
) {
  const object = mesh(
    group,
    new T.DodecahedronGeometry(size, 0),
    material("#9a9984"),
    x,
    y,
    z,
  );
  object.scale.set(1.4, 0.65, 1);
  object.rotation.set(x, z, 0);
}
export function ribbon(
  group: T.Object3D,
  points: T.Vector3[],
  width: number,
  surface: T.Material,
) {
  const positions: number[] = [],
    indices: number[] = [];
  points.forEach((p, i) => {
    const direction = points[Math.min(i + 1, points.length - 1)]
      .clone()
      .sub(points[Math.max(0, i - 1)])
      .normalize();
    const normal = v(-direction.z, 0, direction.x).multiplyScalar(width / 2);
    positions.push(
      p.x + normal.x,
      p.y,
      p.z + normal.z,
      p.x - normal.x,
      p.y,
      p.z - normal.z,
    );
    if (i) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(group, geometry, surface);
}
export function disposeGroup(group: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  group.traverse((object) => {
    if (object instanceof T.Mesh || object instanceof T.Line) {
      geometries.add(object.geometry);
      for (const m of Array.isArray(object.material)
        ? object.material
        : [object.material])
        materials.add(m);
    }
  });
  geometries.forEach((item) => item.dispose());
  materials.forEach((item) => item.dispose());
}
