import * as THREE from "three";
import { PLANETS } from "./spaceModels";

export function material(
  color: THREE.ColorRepresentation,
  metalness = 0,
  roughness = 0.65,
) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
export function mesh(
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  parent: THREE.Object3D,
  position: [number, number, number] = [0, 0, 0],
) {
  const object = new THREE.Mesh(geometry, surface);
  object.position.set(...position);
  parent.add(object);
  return object;
}
export function ring(
  radius: number,
  color: THREE.ColorRepresentation,
  parent: THREE.Object3D,
  opacity = 1,
) {
  const positions = Array.from({ length: 181 }, (_, i) => {
    const angle = (i / 180) * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius,
    );
  });
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(positions),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  parent.add(line);
  return line;
}
export function addStars(scene: THREE.Scene) {
  const points = Array.from(
    { length: 420 },
    (_, i) =>
      new THREE.Vector3(
        Math.sin(i * 71.19) * 30,
        Math.sin(i * 22.9) * 20,
        -8 - (i % 7),
      ),
  );
  scene.add(
    new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.PointsMaterial({
        color: 0xb3c8dc,
        size: 0.035,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
      }),
    ),
  );
}
/** Authored color illustrations, not measured surface maps. Deterministic and offline. */
export function illustratedTexture(index: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const base = new THREE.Color(PLANETS[index].color);
  const image = ctx.createImageData(1024, 512);
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 1024; x++) {
      const n =
        Math.sin(x * 0.051 + Math.sin(y * 0.043) * 5) *
        Math.sin(y * 0.072 + Math.sin(x * 0.031) * 4);
      const fine = Math.sin(x * 1.73 + y * 2.91) * 0.045;
      const gas = index >= 4 || index === 1;
      const band = gas
        ? Math.sin(y * (index === 4 ? 0.12 : 0.07) + n * 0.8) * 0.15 +
          Math.sin(y * 0.46 + n * 2) * 0.025
        : n * 0.17;
      const polar = index === 3 && (y < 18 || y > 493) ? 0.35 : 0;
      const shade = 0.82 + band + fine + polar;
      const p = (y * 1024 + x) * 4;
      image.data[p] = Math.min(255, base.r ** (1 / 2.2) * 255 * shade);
      image.data[p + 1] = Math.min(255, base.g ** (1 / 2.2) * 255 * shade);
      image.data[p + 2] = Math.min(255, base.b ** (1 / 2.2) * 255 * shade);
      image.data[p + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  if (index === 4) {
    ctx.save();
    ctx.translate(380, 310);
    ctx.scale(1, 0.42);
    const storm = ctx.createRadialGradient(0, 0, 2, 0, 0, 49);
    storm.addColorStop(0, "#a95d3f");
    storm.addColorStop(0.7, "#d2906c");
    storm.addColorStop(1, "#cfa88900");
    ctx.fillStyle = storm;
    ctx.beginPath();
    ctx.arc(0, 0, 49, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function createPlanet(
  index: number,
  radius: number,
  earthTexture: THREE.Texture,
  sharedTexture?: THREE.Texture,
) {
  const group = new THREE.Group();
  const surface = new THREE.MeshStandardMaterial({
    map:
      sharedTexture ?? (index === 2 ? earthTexture : illustratedTexture(index)),
    emissive: index === 2 ? 0x051c2c : 0x000000,
    emissiveIntensity: index === 2 ? 0.4 : 0,
    roughness: 0.88,
    metalness: 0,
  });
  const sphere = mesh(new THREE.SphereGeometry(radius, 72, 48), surface, group);
  sphere.rotation.y = -0.7;
  sphere.rotation.z = index === 6 ? 1.6 : 0.08;
  if (index === 2) {
    mesh(
      new THREE.SphereGeometry(radius * 1.035, 48, 32),
      new THREE.MeshBasicMaterial({
        color: 0x78b8d9,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
      }),
      group,
    );
  }
  if (index === 5) {
    const rings = new THREE.Group();
    rings.rotation.x = -Math.PI / 2.6;
    rings.rotation.y = 0.22;
    group.add(rings);
    for (let i = 0; i < 26; i++) {
      const r = radius * (1.25 + i * 0.035);
      if (i === 14 || i === 15) continue;
      mesh(
        new THREE.RingGeometry(r, r + radius * 0.028, 100),
        new THREE.MeshStandardMaterial({
          color: i < 14 ? 0xc9b38a : 0x99836a,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
          roughness: 1,
        }),
        rings,
      );
    }
  }
  return group;
}
