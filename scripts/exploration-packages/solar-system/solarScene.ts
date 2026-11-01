import { packageTexture } from "./spaceMaterials";
import * as THREE from "three";
import type { SceneContext } from "./createSpaceScene";
import { frameCamera } from "./createSpaceScene";
import {
  addStars,
  createPlanet,
  illustratedTexture,
  mesh,
  ring,
} from "./spaceMaterials";
import { PLANETS, planetAngle } from "./spaceModels";
export type SolarCameraMode = "close" | "overview" | "follow";
export type SolarSceneState = {
  selected: number;
  earthYears: number;
  mode: string;
  cameraMode?: SolarCameraMode;
  planetAngles?: readonly number[];
};

const ORBIT_RADII = PLANETS.map(
  (planet) => 0.48 + Math.log1p(planet.distance) * 0.76,
);

export function buildSolarScene(
  { scene, camera, invalidate }: SceneContext,
  earthUrl: string,
) {
  const earthTexture = packageTexture(earthUrl, 2048, 1024);
  earthTexture.colorSpace = THREE.SRGBColorSpace;
  const textures = PLANETS.map((_, i) =>
    i === 2 ? earthTexture : illustratedTexture(i),
  );
  addStars(scene);
  scene.add(new THREE.AmbientLight(0xb3c8df, 0.65));
  const light = new THREE.DirectionalLight(0xffefd6, 3.1);
  light.position.set(-5, 4, 8);
  scene.add(light);
  const hero = new THREE.Group(),
    orrery = new THREE.Group(),
    sizes = new THREE.Group();
  scene.add(hero, orrery, sizes);
  const specimens = PLANETS.map((_, i) => {
    const p = createPlanet(i, 1.25, earthTexture, textures[i]);
    hero.add(p);
    return p;
  });
  const closeInset = new THREE.Group();
  hero.add(closeInset);
  mesh(
    new THREE.SphereGeometry(0.075, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd47d }),
    closeInset,
  );
  const insetRadii = PLANETS.map(
    (planet) => 0.11 + Math.log1p(planet.distance) * 0.15,
  );
  const insetRings = PLANETS.map((_, index) =>
    ring(insetRadii[index], 0x55798e, closeInset, 0.44),
  );
  const insetPlanets = PLANETS.map((planet) => {
    const body = mesh(
      new THREE.SphereGeometry(
        Math.min(
          0.034,
          0.012 + Math.sqrt(planet.diameter / PLANETS[2].diameter) * 0.006,
        ),
        12,
        8,
      ),
      new THREE.MeshStandardMaterial({ color: planet.color, roughness: 0.75 }),
      closeInset,
    );
    return body;
  });
  const insetMarker = ring(0.055, 0xf5dfa2, closeInset, 0.95);
  insetMarker.rotation.x = Math.PI / 2;
  const planets = PLANETS.map((_, i) => {
    const p = createPlanet(
      i,
      0.055 + Math.sqrt(PLANETS[i].diameter / PLANETS[2].diameter) * 0.034,
      earthTexture,
      textures[i],
    );
    orrery.add(p);
    return p;
  });
  const rings = PLANETS.map((_, i) =>
    ring(ORBIT_RADII[i], 0x54768e, orrery, 0.48),
  );
  mesh(
    new THREE.SphereGeometry(0.18, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xffcf75 }),
    orrery,
  );
  for (let i = 0; i < 5; i++)
    mesh(
      new THREE.SphereGeometry(0.19 + i * 0.018, 32, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffa549,
        transparent: true,
        opacity: 0.035,
        depthWrite: false,
      }),
      orrery,
    );
  const asteroidPoints = Array.from({ length: 260 }, (_, index) => {
    const angle = index * 2.399963;
    const radius =
      ORBIT_RADII[3] +
      (ORBIT_RADII[4] - ORBIT_RADII[3]) * (0.32 + (index % 19) / 58);
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      ((index % 9) - 4) * 0.006,
      Math.sin(angle) * radius,
    );
  });
  orrery.add(
    new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(asteroidPoints),
      new THREE.PointsMaterial({
        color: 0xbba987,
        size: 0.018,
        transparent: true,
        opacity: 0.55,
      }),
    ),
  );
  const marker = ring(0.17, 0xf5e1af, orrery);
  marker.rotation.x = Math.PI / 2;
  const earth = createPlanet(2, 0.13, earthTexture);
  earth.position.x = -1.45;
  sizes.add(earth);
  const comparisons = PLANETS.map((p, i) => {
    const body = createPlanet(
      i,
      (p.diameter / 12756) * 0.13,
      earthTexture,
      textures[i],
    );
    body.position.x = 1.25;
    sizes.add(body);
    return body;
  });
  let aspect = 1.6,
    state: SolarSceneState = {
      selected: 2,
      earthYears: 0,
      mode: "orbits",
      cameraMode: "close",
    };
  const layout = () => {
    if (state.mode === "sizes") {
      const comparisonRadius =
        (PLANETS[state.selected].diameter / PLANETS[2].diameter) * 0.13;
      const baseline = -1.25;
      earth.position.set(-1.45, baseline + 0.13, 0);
      comparisons[state.selected].position.set(
        1.25,
        baseline + comparisonRadius,
        0,
      );
      frameCamera(camera, aspect, 2.05, state.selected === 5 ? 4.1 : 3.3);
      camera.position.set(0, 1.15, 12);
      camera.lookAt(0, -0.05, 0);
    } else if (state.cameraMode === "close") {
      frameCamera(camera, aspect, aspect < 1 ? 2.25 : 1.95, 2.8);
      camera.position.set(0, 0.15, 6);
      camera.lookAt(0, 0, 0);
      specimens.forEach((world) => {
        world.position.set(aspect < 1 ? 0 : 0.38, aspect < 1 ? 0.34 : 0.12, 0);
        world.scale.setScalar(aspect < 1 ? 0.77 : 1);
      });
      closeInset.position.set(
        aspect < 1 ? -0.55 : -1.43,
        aspect < 1 ? -1.02 : -0.74,
        0.22,
      );
      closeInset.scale.setScalar(aspect < 1 ? 0.73 : 0.84);
    } else if (state.cameraMode === "follow") {
      const target = planets[state.selected].position;
      frameCamera(camera, aspect, 0.78, 1.2);
      camera.position.set(target.x + 0.8, 0.65, target.z + 1.15);
      camera.lookAt(target);
    } else {
      frameCamera(camera, aspect, aspect < 1 ? 3.85 : 3.35, 4.3);
      camera.position.set(0, 3.8, 5.4);
      camera.lookAt(0, 0, 0);
    }
  };
  return {
    resize(value: number) {
      aspect = value;
      layout();
    },
    update(next: SolarSceneState) {
      state = { ...next, cameraMode: next.cameraMode ?? "overview" };
      hero.visible = state.mode !== "sizes" && state.cameraMode === "close";
      orrery.visible = state.mode !== "sizes" && !hero.visible;
      sizes.visible = state.mode === "sizes";
      specimens.forEach((p, i) => (p.visible = i === state.selected));
      comparisons.forEach((p, i) => (p.visible = i === state.selected));
      planets.forEach((p, i) => {
        const angle =
            state.planetAngles?.[i] ?? planetAngle(i, state.earthYears),
          r = ORBIT_RADII[i];
        p.position.set(Math.cos(angle) * r, 0, -Math.sin(angle) * r);
        p.scale.setScalar(
          state.cameraMode === "follow" && i === state.selected ? 2.2 : 1,
        );
        const line = rings[i].material as THREE.LineBasicMaterial;
        line.color.set(i === state.selected ? 0xe9d2a0 : 0x54768e);
        line.opacity = i === state.selected ? 0.9 : 0.45;
      });
      insetPlanets.forEach((planet, index) => {
        const angle =
          state.planetAngles?.[index] ?? planetAngle(index, state.earthYears);
        planet.position.set(
          Math.cos(angle) * insetRadii[index],
          0,
          -Math.sin(angle) * insetRadii[index],
        );
        planet.scale.setScalar(index === state.selected ? 1.75 : 1);
        const line = insetRings[index].material as THREE.LineBasicMaterial;
        line.color.set(index === state.selected ? 0xf0d996 : 0x55798e);
        line.opacity = index === state.selected ? 0.96 : 0.38;
      });
      insetMarker.position.copy(insetPlanets[state.selected].position);
      marker.position.copy(planets[state.selected].position);
      layout();
      invalidate();
    },
  };
}
