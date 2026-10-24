import * as T from "three";
import { buildRiver } from "./river";
import { buildPond } from "./pond";
import { buildCaravan } from "./caravan";
import { buildGarden } from "./garden";
import { disposeGroup } from "./geometry";
import type { LandscapeKind, LandscapeState, SceneLabel } from "./state";
export type ProjectedLabel = { text: string; x: number; y: number };
export type LandscapeScene = {
  setState: (state: LandscapeState) => void;
  orbit: (x: number, y: number) => void;
  setView: (above: boolean) => void;
  zoomBy: (factor: number) => void;
  pick: (x: number, y: number) => number | null;
  dispose: () => void;
};
export function createLandscapeScene(
  host: HTMLElement,
  kind: LandscapeKind,
  onLabels: (labels: ProjectedLabel[]) => void,
  onUnavailable?: () => void,
): LandscapeScene {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
  scene.add(new T.HemisphereLight(0xf6f1d8, 0x68795a, 2.6));
  const sun = new T.DirectionalLight(0xfff2cf, 3.5);
  sun.position.set(-7, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  const floor = new T.Mesh(
    new T.PlaneGeometry(80, 80),
    new T.ShadowMaterial({ opacity: 0.14 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.85;
  floor.receiveShadow = true;
  scene.add(floor);
  let group = new T.Group(),
    labels: SceneLabel[] = [],
    theta = kind === "garden" ? 0 : 0.22,
    elevation = kind === "pond" ? 0.45 : 0.87,
    zoom = 1,
    visible = true,
    disposed = false;
  scene.add(group);
  const target = new T.Vector3(0, kind === "pond" ? 0.15 : 0.55, 0);
  const draw = () => {
    if (disposed || !visible || document.hidden) return;
    camera.position
      .set(
        Math.sin(theta) * Math.cos(elevation) * 25,
        Math.sin(elevation) * 25,
        Math.cos(theta) * Math.cos(elevation) * 25,
      )
      .add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    onLabels(
      labels
        .map((label) => {
          const p = new T.Vector3(label.x, label.y, label.z).project(camera);
          return { text: label.text, x: (p.x + 1) * 50, y: (1 - p.y) * 50 };
        })
        .filter(
          (label) => label.x > 3 && label.x < 97 && label.y > 6 && label.y < 93,
        ),
    );
    host.dataset.surfaceReady = "true";
  };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || disposed) return;
    renderer.setSize(width, height);
    const aspect = width / height,
      half = Math.max(4.7, 8.05 / aspect) / zoom;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const intersection =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
          visible = entries[0]?.isIntersecting ?? true;
          if (visible) draw();
        })
      : null;
  intersection?.observe(host);
  const visibility = () => {
    if (!document.hidden) draw();
  };
  document.addEventListener("visibilitychange", visibility);
  const lost = (event: Event) => {
    event.preventDefault();
    onUnavailable?.();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  resize();
  return {
    setState(state) {
      if (state.kind !== kind || disposed) return;
      scene.remove(group);
      disposeGroup(group);
      const result =
        state.kind === "river"
          ? buildRiver(state)
          : state.kind === "pond"
            ? buildPond(state)
            : state.kind === "caravan"
              ? buildCaravan(state)
              : buildGarden(state);
      group = result.group;
      labels = result.labels;
      scene.add(group);
      draw();
    },
    orbit(x, y) {
      theta += x;
      elevation = Math.max(0.25, Math.min(1.48, elevation + y));
      draw();
    },
    setView(above) {
      theta = above || kind === "garden" ? 0 : 0.22;
      elevation = above ? 1.48 : kind === "pond" ? 0.45 : 0.87;
      zoom = 1;
      resize();
    },
    zoomBy(factor) {
      zoom = Math.max(0.8, Math.min(1.8, zoom * factor));
      resize();
    },
    pick(x, y) {
      const rect = host.getBoundingClientRect(),
        ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          1 - ((y - rect.top) / rect.height) * 2,
        ),
        camera,
      );
      for (const hit of ray.intersectObject(group, true)) {
        let object: T.Object3D | null = hit.object;
        while (object) {
          if (typeof object.userData.select === "number")
            return object.userData.select;
          object = object.parent;
        }
      }
      return null;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      disposeGroup(scene);
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      delete host.dataset.surfaceReady;
    },
  };
}
