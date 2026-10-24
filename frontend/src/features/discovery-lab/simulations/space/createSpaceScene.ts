import * as THREE from "three";

export type SceneContext = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  invalidate: () => void;
};
export type ExhibitScene<T> = {
  update: (state: T) => void;
  resize?: (aspect: number) => void;
  dispose?: () => void;
};

/** Browser-independent scene builders can also run in the native offline WebView. */
export function createSpaceScene<T>(
  host: HTMLElement,
  build: (context: SceneContext) => ExhibitScene<T>,
  unavailable: () => void,
) {
  if (typeof WebGLRenderingContext === "undefined") {
    unavailable();
    return null;
  }
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    unavailable();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x020711, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, 150);
  camera.position.set(0, 0, 12);
  let frame = 0,
    disposed = false,
    visible = true;
  const invalidate = () => {
    if (disposed || frame || !visible || document.hidden) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!disposed) renderer.render(scene, camera);
    });
  };
  host.appendChild(renderer.domElement);
  const exhibit = build({ scene, camera, renderer, invalidate });
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    exhibit.resize?.(width / height);
    camera.updateProjectionMatrix();
    invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const visibility =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          if (visible) invalidate();
        });
  visibility?.observe(host);
  const onVisible = () => {
    if (!document.hidden) invalidate();
  };
  const onLoss = (event: Event) => {
    event.preventDefault();
    unavailable();
  };
  document.addEventListener("visibilitychange", onVisible);
  renderer.domElement.addEventListener("webglcontextlost", onLoss);
  resize();
  host.dataset.sceneReady = "true";
  return {
    update(state: T) {
      if (!disposed) {
        exhibit.update(state);
        invalidate();
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility?.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      renderer.domElement.removeEventListener("webglcontextlost", onLoss);
      exhibit.dispose?.();
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        const drawable = object as THREE.Mesh;
        if (drawable.geometry) geometries.add(drawable.geometry);
        const material = drawable.material;
        if (material)
          for (const item of Array.isArray(material) ? material : [material])
            materials.add(item);
      });
      materials.forEach((material) => {
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      delete host.dataset.sceneReady;
    },
  };
}
export function frameCamera(
  camera: THREE.OrthographicCamera,
  aspect: number,
  vertical: number,
  horizontal = vertical,
) {
  const halfHeight = Math.max(vertical, horizontal / aspect);
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}
