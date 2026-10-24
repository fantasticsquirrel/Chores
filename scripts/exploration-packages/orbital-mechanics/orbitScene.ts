import { packageTexture } from "./spaceMaterials";
import * as THREE from "three";
import type { Point } from "./physics";
import type { SceneContext } from "./createSpaceScene";
import { frameCamera } from "./createSpaceScene";
import { addStars, createPlanet, material, mesh, ring } from "./spaceMaterials";
import { trajectoryView } from "./spaceModels";
export type OrbitSceneState = { points: Point[]; progress: number };
export function buildOrbitScene(
  { scene, camera, invalidate }: SceneContext,
  earthUrl: string,
) {
  const earthTexture = packageTexture(earthUrl, 2048, 1024);
  earthTexture.colorSpace = THREE.SRGBColorSpace;
  addStars(scene);
  const world = new THREE.Group();
  scene.add(world);
  world.add(createPlanet(2, 0.22, earthTexture));
  scene.add(new THREE.AmbientLight(0xadc6e8, 0.6));
  const sun = new THREE.DirectionalLight(0xffecd4, 3.3);
  sun.position.set(-3, 4, 6);
  scene.add(sun);
  ring(1, 0x4b6f83, world, 0.35);
  const path = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x8ac8bc,
      transparent: true,
      opacity: 0.8,
    }),
  );
  world.add(path);
  const traveled = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xe2edce }),
  );
  world.add(traveled);
  const satellite = new THREE.Group();
  mesh(
    new THREE.BoxGeometry(0.075, 0.06, 0.075),
    material(0xe4c899, 0.65, 0.3),
    satellite,
  );
  for (const side of [-1, 1]) {
    mesh(
      new THREE.BoxGeometry(0.1, 0.006, 0.065),
      material(0x244878, 0.45, 0.22),
      satellite,
      [side * 0.095, 0, 0],
    );
    for (let i = 0; i < 4; i++)
      mesh(
        new THREE.BoxGeometry(0.002, 0.008, 0.065),
        material(0x8aa7bc, 0.3, 0.4),
        satellite,
        [side * 0.095 - 0.038 + i * 0.025, 0, 0],
      );
  }
  const antenna = mesh(
    new THREE.CylinderGeometry(0.002, 0.002, 0.08, 6),
    material(0xd6dce2, 0.7, 0.2),
    satellite,
    [0, 0.065, 0],
  );
  antenna.rotation.z = 0.3;
  world.add(satellite);
  const force = new THREE.ArrowHelper(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(),
    0.4,
    0xf1bb73,
    0.045,
    0.025,
  );
  const velocity = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(),
    0.25,
    0x9cbded,
    0.045,
    0.025,
  );
  world.add(force, velocity);
  let aspect = 1.6,
    points: Point[] | null = null,
    extent = 1.3,
    centerX = 0,
    centerY = 0;
  const framing = () => {
    frameCamera(
      camera,
      aspect,
      extent * 0.48,
      extent * (aspect < 1.3 ? 1.03 : 1.16),
    );
    camera.position.set(
      centerX,
      aspect < 1.3 ? 8 : 3.6,
      -centerY + (aspect < 1.3 ? 1.6 : 5.5),
    );
    camera.lookAt(centerX, 0, -centerY);
  };
  return {
    resize(value: number) {
      aspect = value;
      framing();
    },
    update(state: OrbitSceneState) {
      if (points !== state.points) {
        points = state.points;
        const view = trajectoryView(points);
        extent = view.extent;
        centerX = view.centerX;
        centerY = view.centerY;
        path.geometry.dispose();
        path.geometry = new THREE.BufferGeometry().setFromPoints(
          points.map((p) => new THREE.Vector3(p.x, 0, -p.y)),
        );
        traveled.geometry.dispose();
        traveled.geometry = path.geometry.clone();
        framing();
      }
      const index = Math.min(
        state.points.length - 1,
        Math.floor(state.progress * state.points.length),
      );
      const point = state.points[index],
        next = state.points[Math.min(index + 1, state.points.length - 1)];
      satellite.position.set(point.x, 0.012, -point.y);
      const direction = new THREE.Vector3(-point.x, 0, point.y).normalize();
      force.position.copy(satellite.position);
      force.setDirection(direction);
      force.setLength(
        Math.min(0.45, Math.max(0.03, Math.hypot(point.x, point.y) - 0.22)),
        0.045,
        0.025,
      );
      const tangent = new THREE.Vector3(next.x - point.x, 0, -next.y + point.y);
      velocity.visible = tangent.length() > 0;
      if (velocity.visible) {
        tangent.normalize();
        velocity.position.copy(satellite.position);
        velocity.setDirection(tangent);
      }
      satellite.rotation.y = Math.atan2(-tangent.z, tangent.x);
      traveled.geometry.setDrawRange(0, index + 1);
    },
  };
}
