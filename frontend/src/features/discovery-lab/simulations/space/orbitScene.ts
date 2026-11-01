import * as THREE from "three";
import { orbitTangentAt } from "@family-manager/family-api/discovery-models/orbit";
import type { Point } from "../physics";
import type { SceneContext } from "./createSpaceScene";
import { frameCamera } from "./createSpaceScene";
import { addStars, createPlanet, material, mesh } from "./spaceMaterials";

export type OrbitCameraMode = "close" | "overview" | "follow";
export type OrbitSceneState = {
  points: Point[];
  progress: number;
  cameraMode?: OrbitCameraMode;
};

function createAtmosphere(radius: number) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.16, 64, 40),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: `
        varying float rim;
        void main() {
          vec3 viewNormal = normalize(normalMatrix * normal);
          vec3 viewPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          vec3 viewDirection = normalize(-viewPosition);
          rim = pow(1.0 - abs(dot(viewNormal, viewDirection)), 2.2);
          gl_Position = projectionMatrix * vec4(viewPosition, 1.0);
        }
      `,
      fragmentShader: `
        varying float rim;
        void main() {
          gl_FragColor = vec4(0.29, 0.73, 1.0, rim * 0.52);
        }
      `,
    }),
  );
}

function createStartingRing(parent: THREE.Object3D) {
  const points = Array.from({ length: 181 }, (_, index) => {
    const angle = (index / 180) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
  });
  const ring = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({
      color: 0x7395a6,
      dashSize: 0.025,
      gapSize: 0.025,
      transparent: true,
      opacity: 0.36,
    }),
  );
  ring.computeLineDistances();
  ring.name = "orbit-starting-radius";
  parent.add(ring);
}

function createProbe() {
  const probe = new THREE.Group();
  probe.name = "orbit-probe";
  const body = mesh(
    new THREE.BoxGeometry(0.115, 0.09, 0.095),
    material(0xe0b568, 0.72, 0.28),
    probe,
  );
  body.castShadow = true;
  mesh(
    new THREE.BoxGeometry(0.09, 0.096, 0.055),
    material(0x9f6c2f, 0.8, 0.24),
    probe,
    [0, 0, 0.028],
  );

  for (const side of [-1, 1]) {
    const x = side * 0.145;
    const panel = mesh(
      new THREE.BoxGeometry(0.16, 0.012, 0.105),
      new THREE.MeshStandardMaterial({
        color: 0x1b4e78,
        emissive: 0x0c3354,
        emissiveIntensity: 0.65,
        metalness: 0.45,
        roughness: 0.3,
      }),
      probe,
      [x, 0, 0],
    );
    panel.castShadow = true;
    for (let index = 0; index < 5; index += 1)
      mesh(
        new THREE.BoxGeometry(0.003, 0.015, 0.105),
        material(0x8fc2dc, 0.25, 0.42),
        probe,
        [x - 0.064 + index * 0.032, 0.002, 0],
      );
    for (const z of [-0.034, 0.034])
      mesh(
        new THREE.BoxGeometry(0.16, 0.015, 0.003),
        material(0x8fc2dc, 0.25, 0.42),
        probe,
        [x, 0.002, z],
      );
  }

  const mast = mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.105, 10),
    material(0xd8e1e6, 0.78, 0.2),
    probe,
    [0, 0.09, 0],
  );
  mast.rotation.z = -0.18;
  const dish = mesh(
    new THREE.CylinderGeometry(0.008, 0.048, 0.028, 28),
    material(0xdce5e6, 0.5, 0.32),
    probe,
    [0.018, 0.145, 0],
  );
  dish.rotation.z = Math.PI;
  return probe;
}

function pointGeometry(points: readonly Point[]) {
  return new THREE.BufferGeometry().setFromPoints(
    points.map((point) => new THREE.Vector3(point.x, 0.008, -point.y)),
  );
}

export function buildOrbitScene(
  { scene, camera, renderer, invalidate }: SceneContext,
  earthUrl: string,
) {
  const earthTexture = new THREE.TextureLoader().load(earthUrl, invalidate);
  earthTexture.colorSpace = THREE.SRGBColorSpace;
  earthTexture.anisotropy = Math.min(
    8,
    renderer.capabilities.getMaxAnisotropy(),
  );
  const stars = addStars(scene);

  const world = new THREE.Group();
  world.name = "orbit-world";
  scene.add(world);

  const planet = createPlanet(2, 0.22, earthTexture);
  planet.name = "orbit-planet";
  planet.add(createAtmosphere(0.22));
  planet.rotation.z = -0.12;
  world.add(planet);

  scene.add(new THREE.HemisphereLight(0x98b8d3, 0x02060c, 0.72));
  const sun = new THREE.DirectionalLight(0xffe7c2, 4.8);
  sun.position.set(-4.5, 5.5, 6.5);
  sun.castShadow = true;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x63b7e5, 1.45);
  rim.position.set(4, 1.5, -5);
  scene.add(rim);

  createStartingRing(world);
  const future = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0xa8d9dc,
      transparent: true,
      opacity: 0.72,
    }),
  );
  future.name = "orbit-future-path";
  world.add(future);
  const traveledGlow = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x8ff1dc,
      transparent: true,
      opacity: 0.22,
    }),
  );
  traveledGlow.scale.setScalar(1.003);
  world.add(traveledGlow);
  const traveled = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xe8f4ce }),
  );
  traveled.name = "orbit-traveled-path";
  world.add(traveled);

  const probe = createProbe();
  world.add(probe);
  const force = new THREE.ArrowHelper(
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(),
    0.34,
    0xf2ad4f,
    0.065,
    0.035,
  );
  force.name = "orbit-gravity-vector";
  const velocity = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(),
    0.3,
    0x70ddf2,
    0.065,
    0.035,
  );
  velocity.name = "orbit-motion-vector";
  world.add(force, velocity);

  let aspect = 1.6;
  let points: Point[] | null = null;
  const currentPoint = new THREE.Vector3(1, 0.032, 0);
  const overviewCenter = new THREE.Vector3();
  let overviewHorizontal = 1.2;
  let overviewVertical = 1.2;
  let cameraMode: OrbitCameraMode = "close";
  const framing = () => {
    const compact = aspect < 1.18;
    const focus = new THREE.Vector3();
    if (cameraMode === "overview") {
      focus.copy(overviewCenter);
      frameCamera(camera, aspect, overviewVertical, overviewHorizontal);
      camera.position.set(focus.x, 10, focus.z + 0.001);
    } else if (cameraMode === "follow") {
      focus.copy(currentPoint);
      frameCamera(camera, aspect, compact ? 0.56 : 0.46, compact ? 0.58 : 0.72);
      const radial = currentPoint.clone().setY(0).normalize();
      const tangent = new THREE.Vector3(radial.z, 0, -radial.x);
      camera.position
        .copy(focus)
        .addScaledVector(radial, 7)
        .addScaledVector(tangent, 2.2)
        .add(new THREE.Vector3(0, 5.2, 0));
    } else {
      focus.copy(currentPoint).multiplyScalar(0.48);
      frameCamera(camera, aspect, compact ? 0.64 : 0.54, compact ? 0.64 : 0.84);
      const radial = currentPoint.clone().setY(0).normalize();
      const tangent = new THREE.Vector3(radial.z, 0, -radial.x);
      camera.position
        .copy(focus)
        .addScaledVector(radial, 7)
        .addScaledVector(tangent, 2.2)
        .add(new THREE.Vector3(0, 5.2, 0));
    }
    camera.lookAt(focus);
    stars.position.copy(focus);
    probe.scale.setScalar(compact ? 1.12 : 1.04);
  };

  return {
    resize(value: number) {
      aspect = value;
      framing();
    },
    update(state: OrbitSceneState) {
      cameraMode = state.cameraMode ?? "close";
      if (points !== state.points) {
        points = state.points;
        const xs = points.map((point) => point.x);
        const zs = points.map((point) => -point.y);
        const minX = Math.min(-0.22, ...xs);
        const maxX = Math.max(0.22, ...xs);
        const minZ = Math.min(-0.22, ...zs);
        const maxZ = Math.max(0.22, ...zs);
        overviewCenter.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
        overviewHorizontal = Math.max(0.72, (maxX - minX) / 2 + 0.28);
        overviewVertical = Math.max(0.72, (maxZ - minZ) / 2 + 0.28);
        future.geometry.dispose();
        future.geometry = pointGeometry(points);
        traveled.geometry.dispose();
        traveled.geometry = future.geometry.clone();
        traveledGlow.geometry.dispose();
        traveledGlow.geometry = future.geometry.clone();
      }

      const index = Math.min(
        state.points.length - 1,
        Math.floor(state.progress * state.points.length),
      );
      const point = state.points[index];
      probe.position.set(point.x, 0.032, -point.y);
      currentPoint.copy(probe.position);
      planet.rotation.y = -0.32 + state.progress * 0.68;

      const inward = new THREE.Vector3(-point.x, 0, point.y).normalize();
      force.position.copy(probe.position);
      force.position.y += 0.025;
      force.setDirection(inward);
      force.setLength(
        Math.min(0.38, Math.max(0.075, Math.hypot(point.x, point.y) - 0.22)),
        0.065,
        0.035,
      );

      const tangentPoint = orbitTangentAt(state.points, index);
      const tangent = new THREE.Vector3(tangentPoint.x, 0, -tangentPoint.y);
      velocity.visible = tangent.length() > 0;
      if (velocity.visible) {
        tangent.normalize();
        velocity.position.copy(probe.position);
        velocity.position.y += 0.025;
        velocity.setDirection(tangent);
        velocity.setLength(0.3, 0.065, 0.035);
        probe.rotation.y = Math.atan2(tangent.x, tangent.z);
      }
      traveled.geometry.setDrawRange(0, index + 1);
      traveledGlow.geometry.setDrawRange(0, index + 1);
      framing();
    },
  };
}
