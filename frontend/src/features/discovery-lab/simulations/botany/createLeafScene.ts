import * as THREE from "three";
export type LeafState = {
  light: number;
  water: number;
  carbon: number;
  rate: number;
};
/** Schematic magnified leaf section. Cells and organelles are not shown at a common scale. */
export type LeafLabel = {
  id: string;
  text: string;
  x: number;
  y: number;
  left: number;
  top: number;
};
export function createLeafScene(
  host: HTMLElement,
  onLabels?: (labels: LeafLabel[]) => void,
  onUnavailable?: () => void,
) {
  if (typeof WebGLRenderingContext === "undefined") return null;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x091814, 0);
  host.appendChild(renderer.domElement);
  const contextLost = () => onUnavailable?.();
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(7, 5.3, 9);
  camera.lookAt(0, 0.5, 0);
  scene.add(new THREE.HemisphereLight(0xe3f3d7, 0x152d28, 2));
  const sun = new THREE.DirectionalLight(0xffe4a8, 3);
  sun.position.set(-3, 6, 3);
  scene.add(sun);
  const materials: THREE.Material[] = [],
    geometries: THREE.BufferGeometry[] = [];
  const material = (
    color: number,
    extra: THREE.MeshStandardMaterialParameters = {},
  ) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      ...extra,
    });
    materials.push(m);
    return m;
  };
  const leafMat = material(0x40873f),
    veinMat = material(0xb3c87d),
    skinMat = material(0x80ab65),
    cellMat = material(0x98bd7a, {
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    chloroMat = material(0x397b36, {
      emissive: 0x3e942e,
      emissiveIntensity: 0.15,
    }),
    waterMat = material(0x5cb8cd),
    sugarMat = material(0xe6c883);
  function mesh(
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) {
    geometries.push(geometry);
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  }
  function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material) {
    const curve = new THREE.CatmullRomCurve3(points);
    return mesh(
      new THREE.TubeGeometry(curve, 24, radius, 6, false),
      mat,
      0,
      0,
      0,
    );
  }
  const leaf = new THREE.Shape();
  leaf.moveTo(-1.8, 0);
  leaf.bezierCurveTo(-0.7, 1.5, 1, 1.45, 1.9, 0);
  leaf.bezierCurveTo(0.8, -1.3, -0.7, -1.3, -1.8, 0);
  const blade = mesh(
    new THREE.ExtrudeGeometry(leaf, {
      depth: 0.07,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.03,
      bevelThickness: 0.02,
      curveSegments: 32,
    }),
    leafMat,
    -2.1,
    0.12,
    0,
  );
  blade.rotation.x = -Math.PI / 2;
  blade.rotation.z = 0.2;
  tube(
    [
      new THREE.Vector3(-4.5, 0.18, 0.35),
      new THREE.Vector3(-2.3, 0.24, 0),
      new THREE.Vector3(-0.3, 0.2, -0.35),
    ],
    0.035,
    veinMat,
  );
  for (let i = 0; i < 6; i++)
    for (const side of [-1, 1]) {
      const x = -3.6 + i * 0.43;
      const width = Math.sin(((i + 1) / 7) * Math.PI) * 0.95;
      tube(
        [
          new THREE.Vector3(x, 0.22, 0.1),
          new THREE.Vector3(x + 0.28, 0.23, side * width * 0.5),
          new THREE.Vector3(x + 0.5, 0.2, side * width),
        ],
        0.012,
        veinMat,
      );
    }
  // A separated, magnified tissue sample: upper epidermis, palisade layer and spongy layer.
  mesh(new THREE.BoxGeometry(3.8, 0.14, 2.2), skinMat, 1.5, 1.8, 0);
  mesh(new THREE.BoxGeometry(3.8, 0.12, 2.2), skinMat, 1.5, -0.4, 0);
  const chloroplasts: THREE.Mesh[] = [];
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 6; col++) {
      const x = -0.05 + col * 0.61,
        z = -0.57 + row * 1.12;
      const cell = mesh(
        new THREE.CapsuleGeometry(0.25, 1, 5, 12),
        cellMat,
        x,
        0.95,
        z,
      );
      cell.scale.z = 1.3;
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const organelle = mesh(
          new THREE.SphereGeometry(0.105, 12, 8),
          chloroMat,
          x + Math.cos(a) * 0.18,
          0.5 + (k % 3) * 0.33,
          z + Math.sin(a) * 0.23,
        );
        organelle.scale.set(1.25, 0.42, 0.85);
        chloroplasts.push(organelle);
      }
    }
  for (let i = 0; i < 10; i++) {
    const cell = mesh(
      new THREE.SphereGeometry(0.3, 16, 12),
      cellMat,
      -0.15 + (i % 5) * 0.77,
      -0.05 + (i % 2) * 0.13,
      -0.62 + Math.floor(i / 5) * 1.1,
    );
    cell.scale.set(1.15, 0.72, 0.9);
  }
  // Paired guard cells leave an opening in the lower surface for gas exchange.
  for (const offset of [-0.16, 0.16]) {
    const guard = mesh(
      new THREE.SphereGeometry(0.22, 18, 12),
      leafMat,
      1.6 + offset,
      -0.48,
      0.92,
    );
    guard.scale.set(0.52, 0.3, 1.35);
  }
  // Vascular bundle distinguishes water transport from sugar transport.
  tube(
    [
      new THREE.Vector3(-0.5, -0.1, 0.25),
      new THREE.Vector3(1.5, -0.05, 0.25),
      new THREE.Vector3(3.6, -0.1, 0.25),
    ],
    0.1,
    waterMat,
  );
  tube(
    [
      new THREE.Vector3(-0.5, -0.1, 0.5),
      new THREE.Vector3(1.5, -0.05, 0.5),
      new THREE.Vector3(3.6, -0.1, 0.5),
    ],
    0.08,
    sugarMat,
  );
  const rays: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const ray = mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 1.55, 6),
      sugarMat,
      -0.15 + i * 0.52,
      2.8,
      -0.4 + (i % 2) * 0.8,
    );
    ray.rotation.z = -0.25;
    rays.push(ray);
  }
  const carbonDots: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const dot = mesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      material(0xd7dfda),
      0.1 + i * 0.31,
      -0.9 - (i % 2) * 0.2,
      0.7,
    );
    carbonDots.push(dot);
  }
  const oxygenDots: THREE.Mesh[] = [];
  const oxygenMat = material(0xf4bcac);
  for (let i = 0; i < 6; i++)
    for (const offset of [-0.045, 0.045]) {
      oxygenDots.push(
        mesh(
          new THREE.SphereGeometry(0.05, 8, 6),
          oxygenMat,
          2.4 + i * 0.2 + offset,
          -0.8 - i * 0.13,
          1.0,
        ),
      );
    }
  const labels = [
    {
      id: "cell",
      text: "Leaf cell",
      point: new THREE.Vector3(2.4, 1.1, -0.57),
      left: 83,
      top: 18,
    },
    {
      id: "chloroplast",
      text: "Chloroplast",
      point: new THREE.Vector3(1.5, 0.85, 0.62),
      left: 82,
      top: 37,
    },
    {
      id: "stoma",
      text: "Stoma: gas opening",
      point: new THREE.Vector3(1.6, -0.48, 0.92),
      left: 80,
      top: 77,
    },
    {
      id: "vein",
      text: "Vein: water in, sugar out",
      point: new THREE.Vector3(0.4, -0.05, 0.35),
      left: 14,
      top: 62,
    },
  ];
  const plinth = mesh(
    new THREE.CylinderGeometry(5.1, 5.25, 0.16, 64),
    material(0x193b32),
    0,
    -1.45,
    0,
  );
  plinth.scale.z = 0.65;
  let state: LeafState = { light: 70, water: 60, carbon: 80, rate: 40 };
  const draw = () => {
    sun.intensity = 0.4 + state.light / 30;
    chloroMat.emissiveIntensity = state.rate / 150;
    leafMat.color.setHSL(0.28, 0.45, 0.21 + state.water / 900);
    rays.forEach((ray, i) => {
      ray.visible = i < Math.ceil(state.light / 15);
    });
    carbonDots.forEach((dot, i) => {
      dot.visible = i < Math.ceil(state.carbon / 10);
    });
    waterMat.opacity = 0.25 + state.water / 134;
    waterMat.transparent = true;
    oxygenDots.forEach((dot, i) => {
      dot.visible = i < Math.ceil(state.rate / 17) * 2;
    });
    renderer.render(scene, camera);
    onLabels?.(
      labels.map(({ point, ...label }) => {
        const projected = point.clone().project(camera);
        return {
          ...label,
          x: (projected.x + 1) * 50,
          y: (1 - projected.y) * 50,
        };
      }),
    );
  };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  return {
    setState(next: LeafState) {
      state = next;
      draw();
    },
    dispose() {
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
