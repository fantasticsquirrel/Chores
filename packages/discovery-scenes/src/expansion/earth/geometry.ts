import * as T from "three";
import type { ExpansionLabel, ExpansionScene } from "../types";
export function material(
  color: T.ColorRepresentation,
  roughness = 0.85,
  opacity = 1,
) {
  return new T.MeshStandardMaterial({
    color,
    roughness,
    transparent: opacity < 1,
    opacity,
    metalness: 0.03,
  });
}
export function mesh(
  g: T.Group,
  geometry: T.BufferGeometry,
  color: T.ColorRepresentation,
  at: [number, number, number],
  opacity = 1,
) {
  const m = new T.Mesh(geometry, material(color, 0.85, opacity));
  m.position.set(...at);
  m.castShadow = opacity === 1;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
export function box(
  g: T.Group,
  size: [number, number, number],
  at: [number, number, number],
  color: T.ColorRepresentation,
) {
  return mesh(g, new T.BoxGeometry(...size), color, at);
}
export function rock(
  g: T.Group,
  at: [number, number, number],
  scale: number,
  color: T.ColorRepresentation,
) {
  const m = mesh(g, new T.DodecahedronGeometry(scale, 0), color, at);
  m.scale.set(1.2, 0.65, 0.85);
  m.rotation.set(at[0] * 1.3, at[2], 0.2);
  return m;
}
export function tube(
  g: T.Group,
  points: T.Vector3[],
  color: T.ColorRepresentation,
  radius = 0.025,
) {
  return mesh(
    g,
    new T.TubeGeometry(
      new T.CatmullRomCurve3(points),
      Math.max(16, points.length * 3),
      radius,
      6,
      false,
    ),
    color,
    [0, 0, 0],
  );
}
export function arrow(
  g: T.Group,
  start: T.Vector3,
  end: T.Vector3,
  color = 0xffe2a2,
  scale = 1,
) {
  const d = end.clone().sub(start);
  const a = new T.ArrowHelper(
    d.clone().normalize(),
    start,
    d.length(),
    color,
    0.24 * scale,
    0.15 * scale,
  );
  g.add(a);
  return a;
}
export function terrain(
  g: T.Group,
  width: number,
  depth: number,
  height: (x: number, z: number) => number,
  color: number,
  x = 0,
  z = 0,
) {
  const geometry = new T.PlaneGeometry(width, depth, 48, 40);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute("position"),
    colors: number[] = [],
    base = new T.Color(color);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i),
      pz = pos.getZ(i);
    pos.setY(i, height(px, pz));
    const variation =
      0.82 + 0.16 * Math.sin(px * 13.7 + pz * 5.3) + 0.1 * Math.cos(pz * 18.3);
    colors.push(base.r * variation, base.g * variation, base.b * variation);
  }
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const m = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: T.DoubleSide,
    }),
  );
  m.position.set(x, 0, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
export function dispose(group: T.Group) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  group.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Line) {
      geometries.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  group.clear();
}
export function earthScene<S>(
  initial: S,
  build: (s: S) => { group: T.Group; labels: ExpansionLabel[] },
  view: ExpansionScene<S>["view"],
): ExpansionScene<S> {
  const root = new T.Group();
  let current = build(initial);
  root.add(current.group);
  return {
    group: root,
    view,
    labels: () => current.labels,
    update(s) {
      root.remove(current.group);
      dispose(current.group);
      current = build(s);
      root.add(current.group);
    },
    pick(ray) {
      for (const hit of ray.intersectObject(root, true)) {
        let obj: T.Object3D | null = hit.object;
        while (obj) {
          if (typeof obj.userData.select === "number")
            return obj.userData.select;
          obj = obj.parent;
        }
      }
      return null;
    },
    dispose() {
      dispose(current.group);
      root.clear();
    },
  };
}
