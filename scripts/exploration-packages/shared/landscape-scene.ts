/** Generic lighting/camera author helper; topic geometry is always supplied by its package. */
import * as T from "three";
import { serializeScene, type Presentation } from "./serialize-scene";
export function landscapeScene(
  built: {
    group: T.Group;
    labels: { text: string; x: number; y: number; z: number }[];
  },
  kind: string,
) {
  const target: [number, number, number] = [
      0,
      kind === "pond" ? 0.15 : 0.55,
      0,
    ],
    theta = kind === "garden" ? 0 : 0.22,
    elevation = kind === "pond" ? 0.45 : 0.87;
  return {
    group: built.group,
    view: {
      target,
      position: [
        Math.sin(theta) * Math.cos(elevation) * 25,
        Math.sin(elevation) * 25 + target[1],
        Math.cos(theta) * Math.cos(elevation) * 25,
      ] as [number, number, number],
      width: 16.1,
      height: 9.4,
    },
    labels: () =>
      built.labels.map((l) => ({
        text: l.text,
        at: [l.x, l.y, l.z] as [number, number, number],
      })),
    pick: (ray: T.Raycaster) => {
      built.group.updateMatrixWorld(true);
      for (const hit of ray.intersectObject(built.group, true)) {
        let o: T.Object3D | null = hit.object;
        while (o) {
          if (typeof o.userData.select === "number") return o.userData.select;
          o = o.parent;
        }
      }
      return null;
    },
    dispose: () => {
      const materials = new Set<T.Material>(),
        geometries = new Set<T.BufferGeometry>();
      built.group.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.Line) {
          geometries.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            materials.add(m),
          );
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
export function serializeLandscape(
  scene: ReturnType<typeof landscapeScene>,
  presentation: Presentation,
) {
  const root = new T.Scene();
  root.add(scene.group, new T.HemisphereLight(0xf6f1d8, 0x68795a, 2.6));
  const sun = new T.DirectionalLight(0xfff2cf, 3.5);
  sun.position.set(-7, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.025;
  root.add(sun);
  const floor = new T.Mesh(
    new T.PlaneGeometry(80, 80),
    new T.ShadowMaterial({ opacity: 0.14 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.85;
  floor.receiveShadow = true;
  root.add(floor);
  const c = new T.OrthographicCamera(-8.05, 8.05, 4.7, -4.7, 0.1, 100);
  c.position.set(...scene.view.position);
  c.lookAt(...scene.view.target);
  const result = serializeScene(root, c, {
    target: scene.view.target,
    labels: scene.labels().map((l) => ({ text: l.text, position: l.at })),
    presentation: {
      ...presentation,
      background: ["#ece9d8", "#dfe6ce", "#c3d0b5"],
    },
    presets: [
      {
        id: "landscape",
        label: "Landscape",
        yaw: Math.atan2(scene.view.position[0], scene.view.position[2]),
        elevation: Math.asin(
          (scene.view.position[1] - scene.view.target[1]) / 25,
        ),
        zoom: 1,
      },
      { id: "above", label: "Above", yaw: 0, elevation: 1.45, zoom: 1 },
    ],
  });
  floor.geometry.dispose();
  floor.material.dispose();
  return result;
}
