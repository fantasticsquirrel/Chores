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
export function packageTexture(asset: string, width: number, height: number) {
  const texture = new THREE.Texture();
  texture.userData.packageAsset = { asset, width, height };
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function illustratedTexture(index: number) {
  return packageTexture(`assets/planet-${index}.png`, 1024, 512);
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
