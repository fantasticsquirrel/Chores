import * as T from "three";
import { serializeScene, type Presentation } from "./serialize-scene";
export function serializeTactile(
  exhibit: T.Group,
  presentation: Presentation,
  options: { pizza: boolean; mobile?: boolean; wood?: T.Texture },
) {
  const root = new T.Scene();
  root.add(exhibit, new T.HemisphereLight(0xfff5df, 0x555e5e, 2.2));
  const key = new T.DirectionalLight(0xffeccc, 3.8);
  key.position.set(-4, 3, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {
    left: -6,
    right: 6,
    top: 6,
    bottom: -6,
    near: 0.5,
    far: 20,
  });
  key.shadow.normalBias = 0.018;
  key.shadow.bias = -0.0003;
  root.add(key);
  const fill = new T.DirectionalLight(0xc8e1ee, 1);
  fill.position.set(3, -2, 5);
  root.add(fill);
  const surface = options.pizza
    ? new T.MeshStandardMaterial({
        map: options.wood,
        color: 0xc8b08a,
        roughness: 0.85,
      })
    : new T.ShadowMaterial({ opacity: 0.24 });
  const floor = new T.Mesh(new T.PlaneGeometry(30, 30), surface);
  floor.position.z = -0.04;
  floor.receiveShadow = true;
  root.add(floor);
  if (options.pizza) {
    const cloth = new T.Mesh(
      new T.BoxGeometry(3.9, 12, 0.025),
      new T.MeshStandardMaterial({ color: 0xd7d7c6, roughness: 1 }),
    );
    cloth.position.set(-4.9, 0.5, -0.015);
    cloth.rotation.z = -0.16;
    cloth.receiveShadow = true;
    root.add(cloth);
  }
  const halfWidth = options.pizza ? (options.mobile ? 2.5 : 3.8) : 2.5,
    halfHeight = options.pizza && options.mobile ? 4.2 : 2.35;
  const c = new T.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    0.1,
    40,
  );
  c.up.set(0, 0, 1);
  c.position.set(0, -5.8, 11);
  c.lookAt(0, 0, 0);
  const out = serializeScene(root, c, {
    target: [0, 0, 0],
    presentation,
    narrowHalfWidth: halfWidth,
  });
  for (const o of root.children) {
    if (o === exhibit) continue;
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      (o.material as T.Material).dispose();
    }
  }
  return out;
}
