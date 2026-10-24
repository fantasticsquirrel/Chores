import * as T from "three";
import { serializeScene, type Presentation } from "./serialize-scene";
type PhysicalModel = {
  group: T.Group;
  view: {
    position: [number, number, number];
    target: [number, number, number];
    width: number;
    height: number;
  };
  labels?: () => { text: string; at: [number, number, number] }[];
  interact: (
    name: string,
    point: T.Vector3,
    dragging: boolean,
  ) => { type: string; index?: number; value?: number } | undefined;
  dispose: () => void;
};
export function physicalScene(model: PhysicalModel, kind: string) {
  return {
    ...model,
    labels: () => model.labels?.() ?? [],
    pick: (ray: T.Raycaster) => {
      const point = new T.Vector3();
      if (
        !ray.ray.intersectPlane(
          new T.Plane(new T.Vector3(0, 1, 0), kind === "bridge" ? -1.5 : -1.02),
          point,
        )
      )
        return null;
      const name =
        ray.intersectObject(model.group, true).find((h) => h.object.name)
          ?.object.name ?? "";
      const action = model.interact(name, point, false);
      return action?.type === "switch"
        ? (action.index ?? null)
        : action?.type === "pluck"
          ? -1
          : (action?.value ?? null);
    },
  };
}
export function serializePhysical(
  model: ReturnType<typeof physicalScene>,
  presentation: Presentation,
) {
  const root = new T.Scene();
  root.add(model.group, new T.HemisphereLight(0xd7e7ed, 0x354338, 2));
  const key = new T.DirectionalLight(0xfff0d1, 3.2);
  key.position.set(-6, 12, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {
    left: -13,
    right: 13,
    top: 11,
    bottom: -11,
  });
  key.shadow.normalBias = 0.035;
  key.shadow.bias = -0.00015;
  root.add(key);
  const fill = new T.DirectionalLight(0xaac9da, 1.1);
  fill.position.set(7, 5, -8);
  root.add(fill);
  const c = new T.OrthographicCamera(
    -model.view.width / 2,
    model.view.width / 2,
    model.view.height / 2,
    -model.view.height / 2,
    0.1,
    100,
  );
  c.position.set(...model.view.position);
  c.lookAt(...model.view.target);
  return serializeScene(root, c, {
    target: model.view.target,
    presentation,
    labels: model.labels().map((l: any) => ({ text: l.text, position: l.at })),
  });
}
