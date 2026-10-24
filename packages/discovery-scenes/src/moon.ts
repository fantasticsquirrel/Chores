import * as THREE from "three";

export type MoonSceneOptions = {
  colorUrl: string;
  heightUrl: string;
  onReady?: () => void;
  onUnavailable?: () => void;
};
export type MoonScene = {
  setAngle: (angle: number) => void;
  dispose: () => void;
};

/** DOM-hosted scene shared by the web app and the native app's offline WebView.
 * Controls, lesson text, model results and personal data never belong here.
 * Geometry/material/light match the reviewed Moon exemplar. No animation loop.
 */
export function createMoonScene(
  element: HTMLElement,
  options: MoonSceneOptions,
): MoonScene | null {
  if (typeof WebGLRenderingContext === "undefined") {
    options.onUnavailable?.();
    return null;
  }
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
  } catch {
    options.onUnavailable?.();
    return null;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  camera.position.set(0, 0, 5.4);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x020611, 0);
  element.appendChild(renderer.domElement);
  let currentAngle = 0;
  let loaded = 0;
  let disposed = false;
  let unavailable = false;
  const fail = () => {
    if (disposed || unavailable) return;
    unavailable = true;
    options.onUnavailable?.();
  };
  const loader = new THREE.TextureLoader();
  const loadedTexture = () => {
    if (disposed || unavailable) return;
    loaded++;
    if (loaded === 2) {
      element.dataset.surfaceReady = "true";
      options.onReady?.();
    }
    draw(currentAngle);
  };
  const color = loader.load(options.colorUrl, loadedTexture, undefined, fail);
  color.colorSpace = THREE.SRGBColorSpace;
  const bump = loader.load(options.heightUrl, loadedTexture, undefined, fail);
  const geometry = new THREE.SphereGeometry(1.24, 128, 96);
  const material = new THREE.MeshStandardMaterial({
    map: color,
    bumpMap: bump,
    bumpScale: 0.025,
    roughness: 1,
    metalness: 0,
  });
  const moon = new THREE.Mesh(geometry, material);
  moon.rotation.y = -Math.PI / 2;
  scene.add(moon);
  const sunlight = new THREE.DirectionalLight(0xffffff, 3.4);
  scene.add(sunlight);
  // Faint reflected light reveals the unlit outline, not direct sunlight.
  scene.add(new THREE.AmbientLight(0x879bb6, 0.025));
  function draw(value: number) {
    if (
      disposed ||
      unavailable ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 360
    )
      return;
    currentAngle = value;
    const radians = (value * Math.PI) / 180;
    sunlight.position.set(Math.sin(radians) * 8, 0, -Math.cos(radians) * 8);
    renderer.render(scene, camera);
  }
  const resize = () => {
    const { width, height } = element.getBoundingClientRect();
    if (!width || !height || disposed) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw(currentAngle);
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    fail();
  };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  const observer = new ResizeObserver(resize);
  observer.observe(element);
  resize();
  return {
    setAngle: draw,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      delete element.dataset.surfaceReady;
      geometry.dispose();
      material.dispose();
      color.dispose();
      bump.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
