import * as THREE from "three";
import type { Geometry3D, Node3D, Scene3D } from "./types";
export type ProjectedLabel = { text: string; x: number; y: number };
function geometry(g: Geometry3D): THREE.BufferGeometry {
  const a = "args" in g ? g.args : [];
  switch (g.kind) {
    case "box":
      return new THREE.BoxGeometry(a[0], a[1], a[2]);
    case "cylinder":
      return new THREE.CylinderGeometry(a[0], a[1], a[2], a[3]);
    case "torus":
      return new THREE.TorusGeometry(a[0], a[1], a[2], a[3]);
    case "circle":
      return new THREE.CircleGeometry(a[0], a[1]);
    case "icosahedron":
      return new THREE.IcosahedronGeometry(a[0], a[1]);
    case "line":
      return new THREE.BufferGeometry().setFromPoints(
        g.points.map((p) => new THREE.Vector3(...p)),
      );
    case "extrude": {
      const shape = new THREE.Shape();
      for (const c of g.commands) {
        if (c.op === "moveTo") shape.moveTo(c.args[0], c.args[1]);
        else if (c.op === "lineTo") shape.lineTo(c.args[0], c.args[1]);
        else if (c.op === "absarc")
          shape.absarc(
            c.args[0],
            c.args[1],
            c.args[2],
            c.args[3],
            c.args[4],
            Boolean(c.args[5]),
          );
        else shape.closePath();
      }
      return new THREE.ExtrudeGeometry(shape, {
        depth: g.depth,
        bevelEnabled: false,
      });
    }
  }
}
/** Only call with parseScene3D output. No object loaders, URLs, shaders or package callbacks. */
export function createScene3D(
  host: HTMLElement,
  initial: Scene3D,
  onLabels: (labels: ProjectedLabel[]) => void,
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
  const camera = new THREE.OrthographicCamera(-30, 30, 22, -22, 0.1, 250);
  let scene = new THREE.Scene(),
    data = initial,
    yaw = data.camera.yaw,
    elevation = data.camera.elevation,
    zoom = data.camera.zoom;
  let resources: (
    | THREE.BufferGeometry
    | THREE.Material
    | THREE.Texture
    | THREE.LightShadow
  )[] = [];
  let disposed = false;
  const clear = () => {
    for (const r of resources) r.dispose();
    resources = [];
    scene.clear();
  };
  const draw = () => {
    if (disposed) return;
    const target = new THREE.Vector3(...data.camera.target),
      radius = data.camera.radius;
    camera.position.set(
      Math.sin(yaw) * Math.cos(elevation) * radius + target.x,
      Math.sin(elevation) * radius + target.y,
      Math.cos(yaw) * Math.cos(elevation) * radius + target.z,
    );
    camera.lookAt(target);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    onLabels(
      data.labels
        .map((l) => {
          const p = new THREE.Vector3(...l.position).project(camera);
          return { text: l.text, x: (p.x + 1) * 50, y: (1 - p.y) * 50 };
        })
        .filter((l) => l.x > 5 && l.x < 90 && l.y > 3 && l.y < 90),
    );
  };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || disposed) return;
    // Bound backing allocation even if the surrounding page is exceptionally large.
    const scale = Math.min(1, 2048 / width, 2048 / height);
    renderer.setSize(width * scale, height * scale, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    const aspect = width / height,
      half =
        aspect < data.camera.narrowAspect
          ? data.camera.narrowHalfWidth / aspect
          : data.camera.halfHeight;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    draw();
  };
  const update = (next: Scene3D) => {
    clear();
    data = next;
    scene = new THREE.Scene();
    const textures = new Map<string, THREE.Texture>();
    for (const t of data.textures) {
      const canvas = document.createElement("canvas");
      canvas.width = t.width;
      canvas.height = t.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Texture canvas unavailable");
      for (const r of t.rects) {
        ctx.fillStyle = r.color;
        ctx.fillRect(r.x, r.y, r.width, r.height);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.repeat.set(...t.repeat);
      texture.anisotropy = t.anisotropy;
      resources.push(texture);
      textures.set(t.id, texture);
    }
    const materials = new Map<string, THREE.Material>();
    for (const m of data.materials) {
      const base = {
        color: m.color,
        transparent: m.transparent ?? false,
        opacity: m.opacity ?? 1,
      };
      let material: THREE.Material;
      if (m.kind === "standard")
        material = new THREE.MeshStandardMaterial({
          ...base,
          roughness: m.roughness ?? 1,
          metalness: m.metalness ?? 0,
          map: m.map ? textures.get(m.map) : null,
          bumpMap: m.bumpMap ? textures.get(m.bumpMap) : null,
          bumpScale: m.bumpScale ?? 1,
        });
      else if (m.kind === "basic")
        material = new THREE.MeshBasicMaterial({
          ...base,
          map: m.map ? textures.get(m.map) : null,
        });
      else if (m.kind === "dashed")
        material = new THREE.LineDashedMaterial({
          ...base,
          dashSize: m.dashSize ?? 3,
          gapSize: m.gapSize ?? 1,
        });
      else material = new THREE.LineBasicMaterial(base);
      resources.push(material);
      materials.set(m.id, material);
    }
    const build = (n: Node3D): THREE.Object3D => {
      let object: THREE.Object3D;
      if (n.kind === "group") object = new THREE.Group();
      else {
        const g = geometry(n.geometry!);
        resources.push(g);
        if (n.kind === "line") {
          const line = new THREE.Line(g, materials.get(n.material!)!);
          if (materials.get(n.material!) instanceof THREE.LineDashedMaterial)
            line.computeLineDistances();
          object = line;
        } else object = new THREE.Mesh(g, materials.get(n.material!)!);
      }
      if (n.position) object.position.set(...n.position);
      if (n.rotation) object.rotation.set(...n.rotation);
      if (n.scale) object.scale.set(...n.scale);
      object.visible = n.visible ?? true;
      object.castShadow = n.castShadow ?? false;
      object.receiveShadow = n.receiveShadow ?? false;
      for (const child of n.children ?? []) object.add(build(child));
      return object;
    };
    for (const n of data.nodes) scene.add(build(n));
    const h = data.lighting.hemisphere;
    scene.add(new THREE.HemisphereLight(h.sky, h.ground, h.intensity));
    for (const l of data.lighting.directional) {
      const light = new THREE.DirectionalLight(l.color, l.intensity);
      light.position.set(...l.position);
      if (l.shadow) {
        const s = l.shadow;
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
        resources.push(light.shadow);
      }
      scene.add(light);
    }
    resize();
    host.dataset.sceneReady = "true";
  };
  const observer = new ResizeObserver(resize);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    clear();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    delete host.dataset.sceneReady;
  };
  try {
    host.prepend(renderer.domElement);
    update(initial);
    observer.observe(host);
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    update,
    orbit(dx: number, dy: number) {
      yaw += dx;
      elevation = THREE.MathUtils.clamp(elevation + dy, 0.22, 1.42);
      draw();
    },
    zoomBy(factor: number) {
      zoom = THREE.MathUtils.clamp(zoom * factor, 0.75, 1.65);
      draw();
    },
    setView(id?: string) {
      const p = data.camera.presets.find((p) => p.id === id) ?? data.camera;
      yaw = p.yaw;
      elevation = p.elevation;
      zoom = p.zoom;
      draw();
    },
    dispose,
  };
}
