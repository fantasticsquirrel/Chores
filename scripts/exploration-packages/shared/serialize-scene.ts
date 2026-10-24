import * as T from "three";
import type {
  RichScene,
  RichNode,
} from "../../../frontend/src/features/discovery-lab/packages/rich/parseRichScene";

type Vec = [number, number, number];
export type Presentation = RichScene["presentation"];
export type SerializeOptions = {
  target: Vec;
  presentation: Presentation;
  labels?: RichScene["labels"];
  narrowHalfWidth?: number;
  presets?: RichScene["camera"]["presets"];
};
const vec = (v: T.Vector3): Vec => [v.x, v.y, v.z];
const rounded = (v: number) => {
  if (!Number.isFinite(v)) throw new Error("Nonfinite authored geometry");
  return Math.round(v * 1e6) / 1e6;
};

/** Author-side conversion only. The host accepts validated buffers, never a Three loader document. */
export function serializeScene(
  root: T.Object3D,
  camera: T.Camera,
  options: SerializeOptions,
): RichScene {
  const geometries: RichScene["geometries"] = [],
    materials: RichScene["materials"] = [],
    textures: RichScene["textures"] = [];
  const geometryKeys = new Map<string, string>(),
    materialKeys = new Map<string, string>(),
    textureKeys = new Map<string, string>();
  let nodeCount = 0;
  const texture = (map: T.Texture): string => {
    const meta = map.userData.packageAsset as
      | { asset: string; width: number; height: number }
      | undefined;
    if (!meta)
      throw new Error(
        `Texture ${map.name || map.uuid} requires immutable packageAsset metadata`,
      );
    const data = {
      asset: meta.asset,
      width: meta.width,
      height: meta.height,
      repeat: [map.repeat.x, map.repeat.y] as [number, number],
      anisotropy: Math.max(1, Math.min(4, map.anisotropy)),
      colorSpace:
        map.colorSpace === T.SRGBColorSpace
          ? ("srgb" as const)
          : ("linear" as const),
      wrap:
        map.wrapS === T.RepeatWrapping
          ? ("repeat" as const)
          : ("clamp" as const),
      flipY: map.flipY,
    };
    if (map.wrapS !== map.wrapT)
      throw new Error("Bake asymmetric wrapping into package raster");
    Object.assign(data, {
      offset: [map.offset.x, map.offset.y],
      rotation: map.rotation,
      center: [map.center.x, map.center.y],
    });
    const key = JSON.stringify(data),
      found = textureKeys.get(key);
    if (found) return found;
    const id = `t${textures.length}`;
    textures.push({ id, ...data });
    textureKeys.set(key, id);
    return id;
  };
  const material = (source: T.Material): string => {
    const m = source as T.MeshPhysicalMaterial &
      T.PointsMaterial &
      T.LineDashedMaterial;
    let kind: RichScene["materials"][number]["kind"];
    if (m.type === "MeshPhysicalMaterial") kind = "physical";
    else if (m.type === "MeshStandardMaterial") kind = "standard";
    else if (m.type === "MeshBasicMaterial") kind = "basic";
    else if (m.type === "LineDashedMaterial") kind = "dashed";
    else if (m.type === "LineBasicMaterial") kind = "line";
    else if (m.type === "PointsMaterial") kind = "points";
    else if (m.type === "ShadowMaterial") kind = "shadow";
    else throw new Error(`Unsupported authored material ${m.type}`);
    const data: Omit<RichScene["materials"][number], "id"> = {
      kind,
      color: m.color?.getHex() ?? 0xffffff,
      opacity: m.opacity,
      transparent: m.transparent,
      side: m.side as 0 | 1 | 2,
      depthWrite: m.depthWrite,
      depthTest: m.depthTest,
      toneMapped: m.toneMapped,
    };
    if (m.map) data.map = texture(m.map);
    if (m.bumpMap) data.bumpMap = texture(m.bumpMap);
    for (const name of [
      "normalMap",
      "alphaMap",
      "roughnessMap",
      "metalnessMap",
      "displacementMap",
      "emissiveMap",
      "envMap",
    ] as const)
      if (m[name])
        throw new Error(`Unsupported authored material texture ${name}`);
    if (kind === "standard" || kind === "physical")
      Object.assign(data, {
        roughness: m.roughness,
        metalness: m.metalness,
        emissive: m.emissive.getHex(),
        emissiveIntensity: m.emissiveIntensity,
        vertexColors: m.vertexColors,
        flatShading: m.flatShading,
        wireframe: m.wireframe,
        ...(m.bumpMap ? { bumpScale: m.bumpScale } : {}),
      });
    if (kind === "basic")
      Object.assign(data, {
        vertexColors: m.vertexColors,
        wireframe: m.wireframe,
      });
    if (kind === "physical")
      Object.assign(data, {
        transmission: m.transmission,
        thickness: m.thickness,
        ior: m.ior,
      });
    if (kind === "points")
      Object.assign(data, {
        size: m.size,
        sizeAttenuation: m.sizeAttenuation,
        vertexColors: m.vertexColors,
      });
    if (kind === "dashed")
      Object.assign(data, { dashSize: m.dashSize, gapSize: m.gapSize });
    const key = JSON.stringify(data),
      found = materialKeys.get(key);
    if (found) return found;
    const id = `m${materials.length}`;
    materials.push({ id, ...data });
    materialKeys.set(key, id);
    return id;
  };
  const geometry = (
    g: T.BufferGeometry,
    start = 0,
    count = Infinity,
  ): string => {
    if (
      (g instanceof T.ShapeGeometry || g instanceof T.ExtrudeGeometry) &&
      start === 0 &&
      count === Infinity
    ) {
      const raw = g.parameters.shapes;
      const shape = Array.isArray(raw)
        ? raw.length === 1
          ? raw[0]
          : undefined
        : raw;
      const options =
        g instanceof T.ExtrudeGeometry ? g.parameters.options : undefined;
      const curveSegments =
        g instanceof T.ShapeGeometry
          ? g.parameters.curveSegments
          : (options?.curveSegments ?? 12);
      if (
        shape &&
        !shape.holes.length &&
        shape.curves.length &&
        (!options ||
          (options.bevelEnabled === false &&
            (options.steps ?? 1) === 1 &&
            !options.extrudePath &&
            !options.UVGenerator &&
            (options.depth ?? 1) > 0))
      ) {
        const first = shape.curves[0].getPoint(0);
        const commands: { op: string; args: number[] }[] = [
          { op: "moveTo", args: [first.x, first.y] },
        ];
        let supported = true;
        for (const curve of shape.curves) {
          if (curve instanceof T.LineCurve)
            commands.push({ op: "lineTo", args: [curve.v2.x, curve.v2.y] });
          else if (curve instanceof T.EllipseCurve)
            commands.push({
              op: "absellipse",
              args: [
                curve.aX,
                curve.aY,
                curve.xRadius,
                curve.yRadius,
                curve.aStartAngle,
                curve.aEndAngle,
                curve.aClockwise ? 1 : 0,
                curve.aRotation,
              ],
            });
          else if (curve instanceof T.CubicBezierCurve)
            commands.push({
              op: "bezierCurveTo",
              args: [
                curve.v1.x,
                curve.v1.y,
                curve.v2.x,
                curve.v2.y,
                curve.v3.x,
                curve.v3.y,
              ],
            });
          else if (curve instanceof T.QuadraticBezierCurve)
            commands.push({
              op: "quadraticCurveTo",
              args: [curve.v1.x, curve.v1.y, curve.v2.x, curve.v2.y],
            });
          else supported = false;
        }
        if (shape.autoClose) commands.push({ op: "closePath", args: [] });
        if (supported && commands.length <= 64) {
          const rebuilt =
            g instanceof T.ShapeGeometry
              ? new T.ShapeGeometry(shape, curveSegments)
              : new T.ExtrudeGeometry(shape, options);
          const same = (
            a: T.BufferAttribute | T.InterleavedBufferAttribute | undefined,
            b: T.BufferAttribute | T.InterleavedBufferAttribute | undefined,
          ) => {
            if (!a || !b) return a === b;
            if (a.count !== b.count || a.itemSize !== b.itemSize) return false;
            for (let i = 0; i < a.count; i++)
              for (let j = 0; j < a.itemSize; j++)
                if (a.getComponent(i, j) !== b.getComponent(i, j)) return false;
            return true;
          };
          const pristine =
            Object.keys(g.attributes).length ===
              Object.keys(rebuilt.attributes).length &&
            Object.keys(g.attributes).every((k) =>
              same(g.getAttribute(k), rebuilt.getAttribute(k)),
            ) &&
            same(g.index ?? undefined, rebuilt.index ?? undefined);
          rebuilt.dispose();
          if (pristine) {
            const data = {
              kind: g instanceof T.ShapeGeometry ? "shape" : "extrude",
              commands,
              curveSegments,
              ...(options ? { depth: options.depth ?? 1 } : {}),
            };
            const key = JSON.stringify(data),
              found = geometryKeys.get(key);
            if (found) return found;
            const id = `g${geometries.length}`;
            geometries.push({ id, ...data } as RichScene["geometries"][number]);
            geometryKeys.set(key, id);
            return id;
          }
        }
      }
    }
    const definitions: Record<string, [string, string[]]> = {
      SphereGeometry: [
        "sphere",
        [
          "radius",
          "widthSegments",
          "heightSegments",
          "phiStart",
          "phiLength",
          "thetaStart",
          "thetaLength",
        ],
      ],
      BoxGeometry: [
        "box",
        [
          "width",
          "height",
          "depth",
          "widthSegments",
          "heightSegments",
          "depthSegments",
        ],
      ],
      PlaneGeometry: [
        "plane",
        ["width", "height", "widthSegments", "heightSegments"],
      ],
      CylinderGeometry: [
        "cylinder",
        [
          "radiusTop",
          "radiusBottom",
          "height",
          "radialSegments",
          "heightSegments",
          "openEnded",
          "thetaStart",
          "thetaLength",
        ],
      ],
      TorusGeometry: [
        "torus",
        ["radius", "tube", "radialSegments", "tubularSegments", "arc"],
      ],
      CircleGeometry: [
        "circle",
        ["radius", "segments", "thetaStart", "thetaLength"],
      ],
      RingGeometry: [
        "ring",
        [
          "innerRadius",
          "outerRadius",
          "thetaSegments",
          "phiSegments",
          "thetaStart",
          "thetaLength",
        ],
      ],
      IcosahedronGeometry: ["icosahedron", ["radius", "detail"]],
      DodecahedronGeometry: ["dodecahedron", ["radius", "detail"]],
      ConeGeometry: [
        "cone",
        [
          "radius",
          "height",
          "radialSegments",
          "heightSegments",
          "openEnded",
          "thetaStart",
          "thetaLength",
        ],
      ],
    };
    const definition = definitions[g.type];
    if (
      definition &&
      start === 0 &&
      count === Infinity &&
      !g.morphAttributes.position?.length
    ) {
      const parameters = (
        g as T.BufferGeometry & { parameters: Record<string, number | boolean> }
      ).parameters;
      const args = definition[1].map((name) => Number(parameters[name]));
      const Constructor = g.constructor as new (
        ...args: (number | boolean)[]
      ) => T.BufferGeometry;
      const original = new Constructor(
        ...definition[1].map((name) => parameters[name]),
      );
      const same = (
        a: T.BufferAttribute | T.InterleavedBufferAttribute | undefined,
        b: T.BufferAttribute | T.InterleavedBufferAttribute | undefined,
      ) => {
        if (!a || !b) return a === b;
        if (a.count !== b.count || a.itemSize !== b.itemSize) return false;
        for (let i = 0; i < a.count; i++)
          for (let j = 0; j < a.itemSize; j++)
            if (a.getComponent(i, j) !== b.getComponent(i, j)) return false;
        return true;
      };
      const pristine =
        Object.keys(g.attributes).length ===
          Object.keys(original.attributes).length &&
        Object.keys(g.attributes).every((k) =>
          same(g.getAttribute(k), original.getAttribute(k)),
        ) &&
        same(g.index ?? undefined, original.index ?? undefined);
      original.dispose();
      if (pristine) {
        const data = { kind: definition[0], args };
        const key = JSON.stringify(data),
          found = geometryKeys.get(key);
        if (found) return found;
        const id = `g${geometries.length}`;
        geometries.push({ id, ...data } as RichScene["geometries"][number]);
        geometryKeys.set(key, id);
        return id;
      }
    }
    const position = g.getAttribute("position");
    if (!position) throw new Error("Missing authored position buffer");
    if (g.morphAttributes.position?.length)
      throw new Error("Bake morph targets before serialization");
    const data: Omit<
      Extract<RichScene["geometries"][number], { kind: "buffer" }>,
      "id"
    > = { kind: "buffer", positions: [] };
    for (let i = 0; i < position.count; i++)
      data.positions.push(
        rounded(position.getX(i)),
        rounded(position.getY(i)),
        rounded(position.getZ(i)),
      );
    for (const [attribute, key, size] of [
      ["normal", "normals", 3],
      ["color", "colors", 3],
      ["uv", "uvs", 2],
    ] as const) {
      const a = g.getAttribute(attribute);
      if (!a) continue;
      const values: number[] = [];
      for (let i = 0; i < a.count; i++) {
        values.push(rounded(a.getX(i)), rounded(a.getY(i)));
        if (size === 3) values.push(rounded(a.getZ(i)));
      }
      data[key] = values;
    }
    const total = g.index?.count ?? position.count,
      end = Math.min(total, start + count);
    if (g.index || start !== 0 || end !== total)
      data.indices = Array.from({ length: Math.max(0, end - start) }, (_, i) =>
        g.index ? g.index.getX(start + i) : start + i,
      );
    const key = JSON.stringify(data),
      found = geometryKeys.get(key);
    if (found) return found;
    const id = `g${geometries.length}`;
    geometries.push({ id, ...data });
    geometryKeys.set(key, id);
    return id;
  };
  const node = (o: T.Object3D): RichNode | null => {
    if (o instanceof T.Light || o instanceof T.Camera) return null;
    if (
      (o as T.SkinnedMesh).isSkinnedMesh ||
      (o as T.InstancedMesh).isInstancedMesh
    )
      throw new Error("Bake skinning/instances before serialization");
    const euler = new T.Euler().setFromQuaternion(o.quaternion, "XYZ");
    const zero = o.scale.x === 0 || o.scale.y === 0 || o.scale.z === 0;
    const n: RichNode = {
      id: `n${nodeCount++}`,
      kind: "group",
      position: vec(o.position),
      rotation: [euler.x, euler.y, euler.z],
      scale: zero ? [1, 1, 1] : vec(o.scale),
      visible: o.visible && !zero,
      castShadow: o.castShadow,
      receiveShadow: o.receiveShadow,
      renderOrder: o.renderOrder,
    };
    const children = o.children.map(node).filter((v): v is RichNode => !!v);
    if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points) {
      const kind =
        o instanceof T.Points
          ? "points"
          : o instanceof T.LineSegments
            ? "segments"
            : o instanceof T.Line
              ? "line"
              : "mesh";
      const drawStart = o.geometry.drawRange.start,
        drawCount = o.geometry.drawRange.count;
      if (Array.isArray(o.material)) {
        for (const group of o.geometry.groups) {
          const start = Math.max(drawStart, group.start),
            end = Math.min(drawStart + drawCount, group.start + group.count);
          if (end <= start) continue;
          const m = o.material[group.materialIndex ?? 0];
          if (!m) throw new Error("Missing grouped material");
          children.push({
            id: `n${nodeCount++}`,
            kind,
            geometry: geometry(o.geometry, start, end - start),
            material: material(m),
            castShadow: o.castShadow,
            receiveShadow: o.receiveShadow,
          });
        }
        if (!o.geometry.groups.length)
          throw new Error("Material array requires authored geometry groups");
      } else {
        n.kind = kind;
        n.geometry = geometry(o.geometry, drawStart, drawCount);
        n.material = material(o.material);
      }
    } else if (
      !(o instanceof T.Group) &&
      !(o instanceof T.Scene) &&
      o.type !== "Object3D" &&
      o.type !== "ArrowHelper"
    )
      throw new Error(`Unsupported authored object ${o.type}`);
    if (children.length) n.children = children;
    return n;
  };
  root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const nodes = [node(root)].filter((n): n is RichNode => !!n);
  const lighting: RichScene["lighting"] = {
    hemisphere: { sky: 0xffffff, ground: 0x444444, intensity: 0 },
    directional: [],
  };
  root.traverse((o) => {
    if (o instanceof T.HemisphereLight)
      lighting.hemisphere = {
        sky: o.color.getHex(),
        ground: o.groundColor.getHex(),
        intensity: o.intensity,
      };
    else if (o instanceof T.AmbientLight)
      lighting.ambient = { color: o.color.getHex(), intensity: o.intensity };
    else if (o instanceof T.DirectionalLight) {
      const light: RichScene["lighting"]["directional"][number] = {
        color: o.color.getHex(),
        intensity: o.intensity,
        position: vec(o.getWorldPosition(new T.Vector3())),
        target: vec(o.target.getWorldPosition(new T.Vector3())),
      };
      if (o.castShadow) {
        const c = o.shadow.camera;
        light.shadow = {
          size: o.shadow.mapSize.x as 512 | 1024 | 2048,
          extent: Math.max(
            Math.abs(c.left),
            Math.abs(c.right),
            Math.abs(c.top),
            Math.abs(c.bottom),
          ),
          near: c.near,
          far: c.far,
          bias: o.shadow.bias,
          normalBias: o.shadow.normalBias,
          radius: o.shadow.radius,
        };
      }
      lighting.directional.push(light);
    } else if (o instanceof T.PointLight)
      (lighting.point ??= []).push({
        color: o.color.getHex(),
        intensity: o.intensity,
        position: vec(o.getWorldPosition(new T.Vector3())),
        distance: o.distance,
        decay: o.decay,
      });
    else if (o instanceof T.Light)
      throw new Error(`Unsupported authored light ${o.type}`);
  });
  const position = camera.getWorldPosition(new T.Vector3()),
    delta = position.clone().sub(new T.Vector3(...options.target)),
    radius = delta.length();
  const ortho = camera instanceof T.OrthographicCamera,
    perspective = camera instanceof T.PerspectiveCamera;
  if (!ortho && !perspective)
    throw new Error("Expected orthographic or perspective camera");
  const halfHeight = ortho
    ? (camera.top - camera.bottom) / 2
    : Math.tan((camera.fov * Math.PI) / 360) * radius;
  const yaw = Math.atan2(delta.x, delta.z),
    elevation = Math.asin(delta.y / radius);
  return {
    geometries,
    materials,
    textures,
    nodes,
    lighting,
    labels: options.labels ?? [],
    presentation: options.presentation,
    camera: {
      kind: ortho ? "orthographic" : "perspective",
      position: vec(position),
      up: vec(camera.up),
      target: options.target,
      radius,
      yaw,
      elevation,
      zoom: camera.zoom,
      halfHeight,
      narrowHalfWidth:
        options.narrowHalfWidth ??
        (ortho ? (camera.right - camera.left) / 2 : halfHeight * camera.aspect),
      narrowAspect: ortho
        ? (camera.right - camera.left) / (camera.top - camera.bottom)
        : camera.aspect,
      presets: options.presets ?? [
        {
          id: "default",
          label: "Default view",
          yaw,
          elevation,
          zoom: camera.zoom,
        },
      ],
      near: camera.near,
      far: camera.far,
      ...(perspective ? { fov: camera.fov } : {}),
    },
  };
}

export function serializeExpansionScene(
  scene: {
    group: T.Group;
    view: { position: Vec; target: Vec; width: number; height: number };
    labels: () => { text: string; at: Vec }[];
  },
  presentation: Presentation,
): RichScene {
  const root = new T.Scene();
  root.add(scene.group);
  root.add(new T.HemisphereLight(0xdcebf2, 0x3d443b, 2));
  const key = new T.DirectionalLight(0xfff0d4, 3.1);
  key.position.set(-7, 12, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {
    left: -15,
    right: 15,
    top: 15,
    bottom: -15,
  });
  key.shadow.normalBias = 0.04;
  root.add(key);
  const fill = new T.DirectionalLight(0xb4cfee, 1.1);
  fill.position.set(8, 4, -6);
  root.add(fill);
  const camera = new T.OrthographicCamera(
    -scene.view.width / 2,
    scene.view.width / 2,
    scene.view.height / 2,
    -scene.view.height / 2,
    0.1,
    150,
  );
  camera.position.set(...scene.view.position);
  camera.lookAt(...scene.view.target);
  return serializeScene(root, camera, {
    target: scene.view.target,
    presentation,
    labels: scene
      .labels()
      .map((label) => ({ text: label.text, position: label.at })),
  });
}
