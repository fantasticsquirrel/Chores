import * as THREE from "three";
import type { SceneContext } from "./createSpaceScene";
import { frameCamera } from "./createSpaceScene";
import { material, mesh } from "./spaceMaterials";
import { fallAtTime } from "./spaceModels";
export type GravitySceneState = {
  height: number;
  gravity: number;
  elapsed: number;
  mass: number;
  referenceGravity?: number;
  referenceMass?: number;
  referenceDistance?: number;
  comparisonDistance?: number;
};
export function buildGravityScene({ scene, camera, renderer }: SceneContext) {
  renderer.toneMappingExposure = 1.3;
  const brass = material(0xbca379, 0.7, 0.35),
    dark = material(0x25333d, 0.55, 0.4),
    steel = material(0x71818a, 0.7, 0.3);
  const floor = mesh(
    new THREE.PlaneGeometry(80, 80),
    material(0x18242c, 0.3, 0.5),
    scene,
    [0, -0.15, 0],
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(new THREE.HemisphereLight(0xc8e2f1, 0x14222e, 2));
  const key = new THREE.DirectionalLight(0xffe7c4, 4);
  key.position.set(-4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -3;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8ed5d8, 2);
  rim.position.set(4, 4, -3);
  scene.add(rim);
  const balls: THREE.Mesh[] = [],
    shadows: THREE.Mesh[] = [],
    tickGroups: THREE.Group[] = [];
  for (const [i, x] of [-1.55, 1.55].entries()) {
    const tower = new THREE.Group();
    tower.position.x = x;
    scene.add(tower);
    for (const y of [0.16, 4.8]) {
      mesh(new THREE.CylinderGeometry(0.85, 0.87, 0.22, 64), dark, tower, [
        0,
        y,
        0,
      ]).castShadow = true;
      mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.04, 64), brass, tower, [
        0,
        y + 0.12,
        0,
      ]);
      for (let n = 0; n < 8; n++) {
        const a = (n / 8) * Math.PI * 2;
        mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.035, 6), steel, tower, [
          Math.cos(a) * 0.72,
          y + 0.15,
          Math.sin(a) * 0.72,
        ]);
      }
    }
    for (const side of [-1, 1]) {
      mesh(new THREE.CylinderGeometry(0.035, 0.035, 4.45, 12), brass, tower, [
        side * 0.7,
        2.48,
        -0.25,
      ]).castShadow = true;
      mesh(new THREE.BoxGeometry(0.045, 4.45, 0.08), dark, tower, [
        side * 0.76,
        2.48,
        -0.24,
      ]);
    }
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xa4d5dd,
      transparent: true,
      opacity: 0.085,
      roughness: 0.15,
      metalness: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    mesh(
      new THREE.CylinderGeometry(0.68, 0.68, 4.38, 64, 1, true),
      glass,
      tower,
      [0, 2.49, 0],
    );
    const ticks = new THREE.Group();
    tower.add(ticks);
    tickGroups.push(ticks);
    for (let n = 0; n <= 20; n++)
      mesh(
        new THREE.BoxGeometry(n % 5 === 0 ? 0.18 : 0.09, 0.012, 0.008),
        material(0xacc4c7, 0.1, 0.6),
        ticks,
        [-0.59, 0.47 + n * 0.2, 0.42],
      );
    mesh(
      new THREE.CylinderGeometry(0.52, 0.55, 0.06, 40),
      steel,
      tower,
      [0, 0.38, 0],
    );
    const ball = mesh(
      new THREE.SphereGeometry(0.21, 48, 36),
      material(i === 0 ? 0xb0bdd6 : 0xb0d0ba, 0.72, 0.24),
      tower,
      [0, 4.47, 0],
    );
    ball.castShadow = true;
    balls.push(ball);
    const shadow = mesh(
      new THREE.CircleGeometry(0.26, 32),
      new THREE.MeshBasicMaterial({
        color: 0x050a0d,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
      tower,
      [0, 0.42, 0],
    );
    shadow.rotation.x = -Math.PI / 2;
    shadows.push(shadow);
    mesh(new THREE.BoxGeometry(0.35, 0.09, 0.26), brass, tower, [0, 4.64, 0]);
  }
  return {
    resize(aspect: number) {
      frameCamera(camera, aspect, 3.1, 3.9);
      camera.position.set(5, 5.4, 13);
      camera.lookAt(0, 2.4, 0);
    },
    update(state: GravitySceneState) {
      [state.referenceGravity ?? 9.81, state.gravity].forEach((g, i) => {
        const supplied =
          i === 0 ? state.referenceDistance : state.comparisonDistance;
        const distance =
          supplied ?? fallAtTime(state.height, g, state.elapsed).distance;
        const fraction = Math.max(0, Math.min(1, distance / state.height));
        balls[i].position.y = 4.45 - fraction * 3.82;
        shadows[i].scale.setScalar(0.55 + (1 - fraction) * 0.8);
        (shadows[i].material as THREE.MeshBasicMaterial).opacity =
          0.16 + fraction * 0.5;
      });
      // Mass changes weight, not shape or acceleration: same visible size avoids implying volume is mass.
    },
  };
}
