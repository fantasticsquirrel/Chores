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
export type SolarSceneState = {
  selected: number;
  earthYears: number;
  mode: string;
  planetAngles?: readonly number[];
};
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
  const planets = PLANETS.map((_, i) => {
    const p = createPlanet(i, i < 4 ? 0.065 : 0.11, earthTexture, textures[i]);
    orrery.add(p);
    return p;
  });
  const rings = PLANETS.map((_, i) =>
    ring(0.43 + i * 0.26, 0x54768e, orrery, 0.45),
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
    state: SolarSceneState = { selected: 2, earthYears: 0, mode: "orbits" };
  const layout = () => {
    if (state.mode === "sizes") {
      frameCamera(camera, aspect, 2.05, state.selected === 5 ? 4.1 : 3.3);
      camera.position.set(0, 0, 12);
      camera.lookAt(0, 0, 0);
    } else if (aspect < 1) {
      frameCamera(camera, aspect, 4.15, 2.65);
      hero.position.set(0, 1.7, 0);
      hero.scale.setScalar(0.9);
      orrery.position.set(0, -1.9, 0);
      orrery.scale.setScalar(0.95);
    } else {
      frameCamera(camera, aspect, 2.7, state.selected === 5 ? 6.2 : 5.5);
      hero.position.set(2.45, 0.25, 0);
      hero.scale.setScalar(1.35);
      orrery.position.set(-2.5, -0.55, 0);
      orrery.scale.setScalar(1.02);
    }
    orrery.rotation.x = 1.06;
    orrery.rotation.z = -0.14;
  };
  return {
    resize(value: number) {
      aspect = value;
      layout();
    },
    update(next: SolarSceneState) {
      state = next;
      hero.visible = orrery.visible = state.mode !== "sizes";
      sizes.visible = !hero.visible;
      specimens.forEach((p, i) => (p.visible = i === state.selected));
      comparisons.forEach((p, i) => (p.visible = i === state.selected));
      planets.forEach((p, i) => {
        const angle =
            state.planetAngles?.[i] ?? planetAngle(i, state.earthYears),
          r = 0.43 + i * 0.26;
        p.position.set(Math.cos(angle) * r, 0, -Math.sin(angle) * r);
        const line = rings[i].material as THREE.LineBasicMaterial;
        line.color.set(i === state.selected ? 0xe9d2a0 : 0x54768e);
        line.opacity = i === state.selected ? 0.9 : 0.45;
      });
      marker.position.copy(planets[state.selected].position);
      layout();
    },
  };
}
