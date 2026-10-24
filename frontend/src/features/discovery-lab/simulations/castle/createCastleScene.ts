import * as THREE from "three";
import { castleMaterials } from "./castleMaterials";
import { createFortress } from "./castleStructure";
import {
  createEvidence,
  createLandscape,
  updateLandscape,
} from "./castleLandscape";
import { disposeGeometry } from "./castleGeometry";
import {
  defaultCastleState,
  wallHeightScale,
  type CastleState,
} from "./castleState";
export type CastleView = "courtyard" | "entrance" | "north" | "overhead";
export type CastleLabel = { text: string; x: number; y: number };
export type CastleScene = ReturnType<typeof createCastleScene>;

/** DOM-hosted, demand-rendered exhibit. No React dependency, asset requests or idle loop. */
export function createCastleScene(
  host: HTMLElement,
  onLabels: (labels: CastleLabel[]) => void,
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-30, 30, 22, -22, 0.1, 250);
  const materials = castleMaterials(),
    fortress = createFortress(materials),
    landscape = createLandscape(materials);
  scene.add(landscape.group, fortress.group);
  scene.add(new THREE.HemisphereLight(0xe7f0e3, 0x64614b, 2.2));
  const sun = new THREE.DirectionalLight(0xffe4b8, 3.1);
  sun.position.set(-32, 60, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -48,
    right: 48,
    top: 48,
    bottom: -48,
    near: 1,
    far: 130,
  });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 3;
  scene.add(sun);
  const bounce = new THREE.DirectionalLight(0xb8d2db, 0.5);
  bounce.position.set(25, 16, -25);
  scene.add(bounce);
  let state = defaultCastleState,
    evidence = new THREE.Group(),
    yaw = 0.62,
    elevation = 0.7,
    zoom = 1;
  const draw = () => {
    const target = new THREE.Vector3(0, 3.2, 0),
      radius = 80;
    camera.position.set(
      Math.sin(yaw) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius + target.y,
      Math.cos(yaw) * Math.cos(elevation) * radius,
    );
    camera.lookAt(target);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    const anchors: [string, number, number, number][] = [
      ["Keep", -3.4, 16, -3.3],
      ["Gatehouse", 4.5, 12.8, 13],
      [
        state.towers ? "Projecting tower" : "Curtain wall",
        -15,
        (state.towers ? 12 : 8) * wallHeightScale(state),
        12,
      ],
    ];
    onLabels(
      anchors
        .map(([text, x, y, z]) => {
          const point = new THREE.Vector3(x, y, z).project(camera);
          return { text, x: (point.x + 1) * 50, y: (1 - point.y) * 50 };
        })
        .filter(
          (label) => label.x > 5 && label.x < 90 && label.y > 3 && label.y < 90,
        ),
    );
  };
  const setState = (value: CastleState) => {
    state = value;
    const verticalScale = wallHeightScale(state);
    [fortress.curtains, fortress.towers].forEach((group) => {
      group.scale.y = verticalScale;
      group.position.y = 0.55 * (1 - verticalScale);
    });
    fortress.towers.visible = state.towers;
    fortress.inner.visible = state.inner;
    fortress.gate.position.y = state.gate ? 0 : 4.9;
    disposeGeometry(landscape.ditch);
    landscape.ditch.clear();
    updateLandscape(landscape.ditch, landscape.bridge, state, materials);
    scene.remove(evidence);
    disposeGeometry(evidence);
    evidence = createEvidence(state, materials);
    scene.add(evidence);
    draw();
  };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    const aspect = width / height,
      half = aspect < 1.25 ? 28 / aspect : 21.5;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  setState(state);
  resize();
  host.dataset.sceneReady = "true";
  return {
    setState,
    orbit(dx: number, dy: number) {
      yaw += dx;
      elevation = THREE.MathUtils.clamp(elevation + dy, 0.22, 1.42);
      draw();
    },
    zoomBy(factor: number) {
      zoom = THREE.MathUtils.clamp(zoom * factor, 0.75, 1.65);
      draw();
    },
    setView(view: CastleView) {
      yaw = view === "north" ? Math.PI + 0.3 : view === "entrance" ? 0.1 : 0.62;
      elevation = view === "overhead" ? 1.42 : view === "entrance" ? 0.3 : 0.7;
      zoom = view === "entrance" ? 1.15 : 1;
      draw();
    },
    dispose() {
      observer.disconnect();
      disposeGeometry(scene);
      landscape.joint.dispose();
      materials.dispose();
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      delete host.dataset.sceneReady;
    },
  };
}
