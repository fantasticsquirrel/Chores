import { resetVectorIds } from "./vector-author";
import { createFrameCompactor } from "../shared/compact-frame";
import * as THREE from "three";
export type Input = {
  type: string;
  values: Record<string, number>;
  control?: string;
  value?: number;
  dt?: number;
  width?: number;
  viewportWidth?: number;
  height?: number;
  pointer?: { phase: string; x: number; y: number };
};
export const range = (
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
) => ({ id, label, min, max, step, value });
export const select = (
  id: string,
  label: string,
  value: number,
  options: string[],
) => ({
  ...range(id, label, 0, options.length - 1, 1, value),
  kind: "select",
  options: options.map((label, value) => ({ label, value })),
});
export const button = (id: string, label: string, pressed?: boolean) => ({
  id,
  label,
  ...(pressed === undefined ? {} : { pressed }),
});
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export function context() {
  const scene = new THREE.Scene(),
    camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, 150);
  camera.position.set(0, 0, 12);
  return {
    scene,
    camera,
    renderer: { toneMappingExposure: 1.15 },
    invalidate: () => {},
  };
}
export function packageTexture(asset: string, width: number, height: number) {
  const t = new THREE.Texture();
  t.userData.packageAsset = { asset, width, height };
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function install(run: (input: Input) => unknown) {
  const compact = createFrameCompactor();
  self.onmessage = ({ data }: MessageEvent<Input>) => {
    resetVectorIds();
    self.postMessage(
      compact(
        run(data) as { scene3d?: unknown },
        data.type === "reset" || data.type === "init",
      ),
    );
  };
}
export const background = ["#132332", "#080f1a", "#040912"] as [
  string,
  string,
  string,
];

export function timelineDrag() {
  let start: { x: number; progress: number } | null = null;
  return (i: Input, progress: number) => {
    if (i.type === "reset") start = null;
    if (i.type !== "pointer" || !i.pointer) return progress;
    const p = i.pointer;
    if (p.phase === "down") start = { x: p.x, progress };
    if (start)
      progress = clamp(
        start.progress +
          ((p.x - start.x) * (i.width ?? 800)) / Math.max(200, i.width ?? 800),
        0,
        0.9999,
      );
    if (p.phase === "up") start = null;
    return progress;
  };
}
