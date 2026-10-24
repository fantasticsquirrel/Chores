import * as THREE from "three";

export type PizzaPlate = { n: number; d: number; slices: number[] };
export const PALETTE = [
  "#bf6c48",
  "#398b88",
  "#8e71b1",
  "#c29b42",
  "#6e955e",
  "#567fa5",
];
export function material(
  color: THREE.ColorRepresentation,
  roughness = 0.6,
  metalness = 0,
) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
export function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material | THREE.Material[],
  x = 0,
  y = 0,
  z = 0,
) {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}
export function disk(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const result = mesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, height, 96),
    surface,
    x,
    y,
    z,
  );
  result.rotation.x = Math.PI / 2;
  return result;
}
export function sector(
  radius: number,
  start: number,
  span: number,
  depth: number,
) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(radius * Math.cos(start), radius * Math.sin(start));
  shape.absarc(0, 0, radius, start, start + span, false);
  shape.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 64,
  });
}
export function seeded(index: number) {
  const x = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
function raster(name: string, size = 256) {
  const t = new THREE.Texture();
  t.userData.packageAsset = {
    asset: `assets/${name}.png`,
    width: size,
    height: size,
  };
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function woodTexture() {
  return raster("wood", 512);
}
export function foodTexture(base: string, _toast: string, _specks: number) {
  const t = raster(
    base === "#e9b66b" ? "bread" : base === "#ffe6a0" ? "cheese" : "pepperoni",
    512,
  );
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.4, 0.4);
  t.offset.set(0.5, 0.5);
  return t;
}
export function numberTexture(
  value: number,
  _color?: string,
  _background?: string,
) {
  return raster(`number-${value}`);
}
export function pipsTexture(value: number) {
  return raster(`pips-${value}`);
}
export function disposeGroup(group: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    (object.userData.ownedMaterials as THREE.Material[] | undefined)?.forEach(
      (surface) => materials.add(surface),
    );
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      (Array.isArray(object.material)
        ? object.material
        : [object.material]
      ).forEach((surface: THREE.Material) => materials.add(surface));
    }
  });
  materials.forEach((surface) => {
    Object.values(surface).forEach((value) => {
      if (value instanceof THREE.Texture) textures.add(value);
    });
    surface.dispose();
  });
  textures.forEach((map) => map.dispose());
}
