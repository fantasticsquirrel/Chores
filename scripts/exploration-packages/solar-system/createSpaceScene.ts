import * as THREE from "three";
export type SceneContext = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  renderer: { toneMappingExposure: number };
  invalidate: () => void;
};
export function frameCamera(
  camera: THREE.OrthographicCamera,
  aspect: number,
  vertical: number,
  horizontal = vertical,
) {
  const h = Math.max(vertical, horizontal / aspect);
  camera.left = -h * aspect;
  camera.right = h * aspect;
  camera.top = h;
  camera.bottom = -h;
  camera.updateProjectionMatrix();
}
