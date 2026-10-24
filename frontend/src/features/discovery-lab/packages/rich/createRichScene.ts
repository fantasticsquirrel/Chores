import { createRichResources } from "./createRichResources";
import * as THREE from "three";
import type { RichNode, RichScene } from "./parseRichScene";
import type { RasterAssets } from "./rasterAssets";
export type RichProjectedLabel = {
  text: string;
  x: number;
  y: number;
  anchorX?: number;
  anchorY?: number;
};
/** Explicit primitive construction only. Never ObjectLoader, arbitrary props, URLs or callbacks. */
export function createRichScene(
  host: HTMLElement,
  initial: RichScene,
  assets: RasterAssets,
  onLabels: (labels: RichProjectedLabel[]) => void,
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let data = initial,
    scene = new THREE.Scene(),
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera =
      new THREE.OrthographicCamera(),
    disposed = false,
    orbiting = false,
    yaw = data.camera.yaw,
    elevation = data.camera.elevation,
    zoom = data.camera.zoom;
  const resources = createRichResources(assets);
  const { geometries, materials } = resources;
  let shadows: THREE.LightShadow[] = [];
  let topologyKey = "",
    lightingKey = "";
  let roots: THREE.Object3D[] = [],
    lightObjects: THREE.Object3D[] = [];
  const draw = () => {
    if (disposed) return;
    const c = data.camera,
      target = new THREE.Vector3(...c.target);
    if (c.position && !orbiting) camera.position.set(...c.position);
    else {
      const up = new THREE.Vector3(...(c.up ?? [0, 1, 0])).normalize();
      const offset = new THREE.Vector3(
        Math.sin(yaw) * Math.cos(elevation) * c.radius,
        Math.sin(elevation) * c.radius,
        Math.cos(yaw) * Math.cos(elevation) * c.radius,
      ).applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          up,
        ),
      );
      camera.position.copy(target).add(offset);
    }
    camera.up.set(...(c.up ?? [0, 1, 0]));
    camera.lookAt(target);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    onLabels(
      data.labels
        .map((l) => {
          const p = new THREE.Vector3(...l.position).project(camera);
          return {
            text: l.text,
            x: l.left ?? (p.x + 1) * 50,
            y: l.top ?? (1 - p.y) * 50,
            ...(l.left !== undefined && l.top !== undefined
              ? { anchorX: (p.x + 1) * 50, anchorY: (1 - p.y) * 50 }
              : {}),
          };
        })
        .filter((l) => l.x > 2 && l.x < 98 && l.y > 2 && l.y < 98),
    );
  };
  const resize = () => {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const factor = Math.min(1, 2048 / width, 2048 / height);
    renderer.setSize(width * factor, height * factor, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    const aspect = width / height;
    if (camera instanceof THREE.PerspectiveCamera) camera.aspect = aspect;
    else {
      const half =
        aspect < data.camera.narrowAspect
          ? data.camera.narrowHalfWidth / aspect
          : data.camera.halfHeight;
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half;
      camera.bottom = -half;
    }
    draw();
  };
  const update = (next: RichScene) => {
    if (disposed) return;
    data = next;
    renderer.toneMapping =
      data.presentation.toneMapping === "none"
        ? THREE.NoToneMapping
        : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = data.presentation.exposure ?? 1;

    resources.update(data);
    const build = (n: RichNode): THREE.Object3D => {
      let object: THREE.Object3D;
      if (n.kind === "group") object = new THREE.Group();
      else {
        const g = geometries.get(n.geometry!)!.value,
          m = materials.get(n.material!)!.value;
        switch (n.kind) {
          case "mesh":
            object = new THREE.Mesh(g, m);
            break;
          case "points":
            object = new THREE.Points(g, m);
            break;
          case "segments":
            object = new THREE.LineSegments(g, m);
            break;
          default:
            object = new THREE.Line(g, m);
        }
        if (
          object instanceof THREE.Line &&
          m instanceof THREE.LineDashedMaterial
        )
          object.computeLineDistances();
      }
      if (n.id) object.userData.pickId = n.id;
      if (n.position) object.position.set(...n.position);
      if (n.rotation) object.rotation.set(...n.rotation);
      if (n.scale) object.scale.set(...n.scale);
      object.visible = n.visible ?? true;
      object.castShadow = n.castShadow ?? false;
      object.receiveShadow = n.receiveShadow ?? false;
      object.renderOrder = n.renderOrder ?? 0;
      for (const child of n.children ?? []) object.add(build(child));
      return object;
    };
    const topology = (n: RichNode): unknown => [
      n.kind,
      (n.children ?? []).map(topology),
    ];
    const nextTopology = JSON.stringify(data.nodes.map(topology));
    const apply = (object: THREE.Object3D, n: RichNode) => {
      object.userData.pickId = n.id;
      object.position.set(...(n.position ?? [0, 0, 0]));
      object.rotation.set(...(n.rotation ?? [0, 0, 0]));
      object.scale.set(...(n.scale ?? [1, 1, 1]));
      object.visible = n.visible ?? true;
      object.castShadow = n.castShadow ?? false;
      object.receiveShadow = n.receiveShadow ?? false;
      object.renderOrder = n.renderOrder ?? 0;
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Line ||
        object instanceof THREE.Points
      ) {
        object.geometry = geometries.get(n.geometry!)!.value;
        object.material = materials.get(n.material!)!.value;
      }
      (n.children ?? []).forEach((child, i) =>
        apply(object.children[i], child),
      );
    };
    if (nextTopology !== topologyKey) {
      for (const root of roots) scene.remove(root);
      roots = data.nodes.map(build);
      scene.add(...roots);
      topologyKey = nextTopology;
    } else data.nodes.forEach((n, i) => apply(roots[i], n));
    const nextLighting = JSON.stringify(data.lighting);
    if (nextLighting !== lightingKey) {
      for (const light of lightObjects) scene.remove(light);
      for (const shadow of shadows) shadow.dispose();
      shadows = [];
      const before = new Set(scene.children);
      const h = data.lighting.hemisphere;
      scene.add(new THREE.HemisphereLight(h.sky, h.ground, h.intensity));
      if (data.lighting.ambient) {
        const a = data.lighting.ambient;
        scene.add(new THREE.AmbientLight(a.color, a.intensity));
      }
      for (const p of data.lighting.point ?? []) {
        const light = new THREE.PointLight(
          p.color,
          p.intensity,
          p.distance,
          p.decay,
        );
        light.position.set(...p.position);
        scene.add(light);
      }
      for (const d of data.lighting.directional) {
        const light = new THREE.DirectionalLight(d.color, d.intensity);
        light.position.set(...d.position);
        if (d.target) light.target.position.set(...d.target);
        scene.add(light.target);
        if (d.shadow) {
          const s = d.shadow;
          light.castShadow = true;
          light.shadow.mapSize.set(s.size, s.size);
          Object.assign(light.shadow.camera, {
            left: -s.extent,
            right: s.extent,
            top: s.extent,
            bottom: -s.extent,
            near: s.near,
            far: s.far,
          });
          light.shadow.bias = s.bias;
          light.shadow.normalBias = s.normalBias;
          light.shadow.radius = s.radius;
          shadows.push(light.shadow);
        }
        scene.add(light);
      }
      lightObjects = scene.children.filter((o) => !before.has(o));
      lightingKey = nextLighting;
    }
    const c = data.camera;
    if (c.kind === "perspective") {
      if (!(camera instanceof THREE.PerspectiveCamera))
        camera = new THREE.PerspectiveCamera();
      (camera as THREE.PerspectiveCamera).fov = c.fov ?? 40;
    } else if (!(camera instanceof THREE.OrthographicCamera))
      camera = new THREE.OrthographicCamera();
    camera.near = c.near ?? 0.1;
    camera.far = c.far ?? 2000;
    resize();
    host.dataset.sceneReady = "true";
  };
  const observer = new ResizeObserver(resize);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    resources.dispose();
    for (const s of shadows) s.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    delete host.dataset.sceneReady;
  };
  try {
    host.prepend(renderer.domElement);
    update(initial);
    observer.observe(host);
  } catch (e) {
    dispose();
    throw e;
  }
  return {
    update,
    dispose,
    orbit(dx: number, dy: number) {
      if (!orbiting && data.camera.position) {
        const up = new THREE.Vector3(
          ...(data.camera.up ?? [0, 1, 0]),
        ).normalize();
        const offset = new THREE.Vector3(...data.camera.position)
          .sub(new THREE.Vector3(...data.camera.target))
          .applyQuaternion(
            new THREE.Quaternion().setFromUnitVectors(
              up,
              new THREE.Vector3(0, 1, 0),
            ),
          );
        yaw = Math.atan2(offset.x, offset.z);
        elevation = Math.asin(
          THREE.MathUtils.clamp(offset.y / offset.length(), -1, 1),
        );
      }
      orbiting = true;
      yaw += dx;
      elevation = THREE.MathUtils.clamp(elevation + dy, -1.5, 1.5);
      draw();
    },
    zoomBy(factor: number) {
      zoom = THREE.MathUtils.clamp(zoom * factor, 0.2, 5);
      draw();
    },
    setView(id?: string) {
      const p = data.camera.presets.find((p) => p.id === id) ?? data.camera;
      yaw = p.yaw;
      elevation = p.elevation;
      zoom = p.zoom;
      orbiting = !!id;
      draw();
    },
    pick(x: number, y: number) {
      scene.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), camera);
      const rays = {
        rayOrigin: ray.ray.origin.toArray(),
        rayDirection: ray.ray.direction.toArray(),
      };
      for (const hit of ray.intersectObjects(scene.children, true)) {
        let object: THREE.Object3D | null = hit.object;
        while (object) {
          if (typeof object.userData.pickId === "string")
            return {
              ...rays,
              id: object.userData.pickId,
              point: hit.point.toArray(),
            };
          object = object.parent;
        }
      }
      return rays;
    },
  };
}
