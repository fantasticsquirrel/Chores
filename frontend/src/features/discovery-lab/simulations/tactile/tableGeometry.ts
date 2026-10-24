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
function texture(draw: (ctx: CanvasRenderingContext2D) => void, size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}
export function woodTexture() {
  return texture((ctx) => {
    ctx.fillStyle = "#b8986b";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 450; i++) {
      ctx.strokeStyle = `rgba(${i % 3 ? "94,62,34" : "238,211,158"},${0.04 + seeded(i) * 0.12})`;
      ctx.lineWidth = 0.5 + seeded(i + 2) * 2;
      ctx.beginPath();
      const y = seeded(i + 1) * 512;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        150,
        y + seeded(i + 5) * 30,
        350,
        y - seeded(i + 6) * 40,
        512,
        y + 3,
      );
      ctx.stroke();
    }
  });
}
export function foodTexture(base: string, toast: string, specks: number) {
  const map = texture((ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < specks; i++) {
      const x = seeded(i + 12) * 512,
        y = seeded(i + 27) * 512,
        r = 1 + seeded(i + 40) * 10;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, toast);
      gradient.addColorStop(1, `${toast}00`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(0.4, 0.4);
  map.offset.set(0.5, 0.5);
  return map;
}
export function numberTexture(
  value: number,
  color = "#f8efda",
  background = "transparent",
) {
  return texture((ctx) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = color;
    ctx.font = "600 150px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), 128, 139);
  }, 256);
}
export function pipsTexture(value: number) {
  return texture((ctx) => {
    ctx.fillStyle = "#e8e3cf";
    ctx.fillRect(0, 0, 256, 256);
    const points =
      value === 1
        ? [[128, 128]]
        : value === 2
          ? [
              [65, 65],
              [191, 191],
            ]
          : value === 3
            ? [
                [65, 65],
                [128, 128],
                [191, 191],
              ]
            : value === 4
              ? [
                  [65, 65],
                  [191, 65],
                  [65, 191],
                  [191, 191],
                ]
              : value === 5
                ? [
                    [65, 65],
                    [191, 65],
                    [128, 128],
                    [65, 191],
                    [191, 191],
                  ]
                : [
                    [65, 60],
                    [65, 128],
                    [65, 196],
                    [191, 60],
                    [191, 128],
                    [191, 196],
                  ];
    points.forEach(([x, y]) => {
      const gradient = ctx.createRadialGradient(x + 3, y + 4, 2, x, y, 18);
      gradient.addColorStop(0, "#3b4546");
      gradient.addColorStop(0.8, "#1c292c");
      gradient.addColorStop(1, "#8d8b7b");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, Math.PI * 2);
      ctx.fill();
    });
  }, 256);
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
