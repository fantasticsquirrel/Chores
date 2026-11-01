import * as THREE from "three";

export type MoonSceneView = "earth" | "orbit";
export type MoonSceneState = { angle: number; view: MoonSceneView };

export type MoonSceneOptions = {
  colorUrl: string;
  heightUrl: string;
  earthUrl: string;
  onReady?: () => void;
  onUnavailable?: () => void;
};
export type MoonScene = {
  setState: (state: MoonSceneState) => void;
  setAngle: (angle: number) => void;
  setView: (view: MoonSceneView) => void;
  dispose: () => void;
};

/**
 * Demand-rendered Moon phase scene shared by web and the native offline view.
 * Earth view keeps the lunar near side fixed while moving only the Sun light.
 * Orbit view keeps sunlight fixed from scene-right and moves the Moon around
 * Earth. Controls, lesson logic and personal data remain outside this renderer.
 */
export function createMoonScene(
  element: HTMLElement,
  options: MoonSceneOptions,
): MoonScene | null {
  if (typeof WebGLRenderingContext === "undefined") {
    options.onUnavailable?.();
    return null;
  }

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
  } catch {
    options.onUnavailable?.();
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x020611, 0);
  element.appendChild(renderer.domElement);

  let current: MoonSceneState = { angle: 0, view: "earth" };
  let loaded = 0;
  let disposed = false;
  let unavailable = false;
  const disposables: { dispose: () => void }[] = [];
  const fail = () => {
    if (disposed || unavailable) return;
    unavailable = true;
    options.onUnavailable?.();
  };
  const loader = new THREE.TextureLoader();
  const loadedTexture = () => {
    if (disposed || unavailable) return;
    loaded += 1;
    if (loaded === 3) {
      element.dataset.surfaceReady = "true";
      options.onReady?.();
    }
    draw(current);
  };
  const color = loader.load(options.colorUrl, loadedTexture, undefined, fail);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const bump = loader.load(options.heightUrl, loadedTexture, undefined, fail);
  bump.colorSpace = THREE.NoColorSpace;
  const earthColor = loader.load(
    options.earthUrl,
    loadedTexture,
    undefined,
    fail,
  );
  earthColor.colorSpace = THREE.SRGBColorSpace;
  earthColor.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  disposables.push(color, bump, earthColor);

  const moonGeometry = new THREE.SphereGeometry(1.42, 128, 96);
  const moonMaterial = new THREE.MeshStandardMaterial({
    map: color,
    bumpMap: bump,
    bumpScale: 0.032,
    roughness: 0.98,
    metalness: 0,
  });
  const earthViewMoon = new THREE.Mesh(moonGeometry, moonMaterial);
  earthViewMoon.rotation.y = -Math.PI / 2;
  const earthViewGroup = new THREE.Group();
  earthViewGroup.add(earthViewMoon);
  scene.add(earthViewGroup);

  const orbitGroup = new THREE.Group();
  const earthGeometry = new THREE.SphereGeometry(0.62, 80, 56);
  const earthMaterial = new THREE.MeshStandardMaterial({
    map: earthColor,
    roughness: 0.86,
    metalness: 0,
  });
  const earth = new THREE.Mesh(earthGeometry, earthMaterial);
  earth.rotation.y = -0.65;
  earth.rotation.z = -0.17;
  orbitGroup.add(earth);
  const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x4ca8d8,
    transparent: true,
    opacity: 0.16,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const atmosphere = new THREE.Mesh(earthGeometry, atmosphereMaterial);
  atmosphere.scale.setScalar(1.07);
  orbitGroup.add(atmosphere);

  const orbitMoon = new THREE.Mesh(moonGeometry, moonMaterial);
  orbitMoon.scale.setScalar(0.22);
  orbitMoon.rotation.y = -Math.PI / 2;
  orbitGroup.add(orbitMoon);
  const orbitRadius = 2.22;
  const orbitPoints = Array.from({ length: 193 }, (_, index) => {
    const angle = (index / 192) * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * orbitRadius,
      Math.sin(angle) * orbitRadius,
      0,
    );
  });
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  const orbitMaterial = new THREE.LineDashedMaterial({
    color: 0x7897aa,
    transparent: true,
    opacity: 0.72,
    dashSize: 0.08,
    gapSize: 0.06,
  });
  const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
  orbitLine.computeLineDistances();
  orbitGroup.add(orbitLine);
  const sightGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const sightMaterial = new THREE.LineBasicMaterial({
    color: 0xd7edf0,
    transparent: true,
    opacity: 0.34,
  });
  orbitGroup.add(new THREE.Line(sightGeometry, sightMaterial));

  const sunGeometry = new THREE.SphereGeometry(0.48, 48, 32);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffd27c });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.set(3.8, 0, -0.3);
  orbitGroup.add(sun);
  const sunGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffc766,
    transparent: true,
    opacity: 0.13,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sunGlow = new THREE.Mesh(sunGeometry, sunGlowMaterial);
  sunGlow.position.copy(sun.position);
  sunGlow.scale.setScalar(1.55);
  orbitGroup.add(sunGlow);
  for (const y of [-0.8, 0, 0.8]) {
    orbitGroup.add(
      new THREE.ArrowHelper(
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(3.14, y, 0.05),
        0.92,
        0xf4ca7b,
        0.15,
        0.08,
      ),
    );
  }
  scene.add(orbitGroup);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(360 * 3);
  for (let index = 0; index < 360; index += 1) {
    const radius = 9 + ((index * 47) % 29) / 4;
    const azimuth = index * 2.399963;
    const elevation = ((index * 73) % 151) / 150 - 0.5;
    starPositions[index * 3] = Math.cos(azimuth) * radius;
    starPositions[index * 3 + 1] = elevation * 10;
    starPositions[index * 3 + 2] = -2.8 - Math.sin(azimuth) * radius * 0.25;
  }
  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3),
  );
  const starMaterial = new THREE.PointsMaterial({
    color: 0xdcebf2,
    size: 0.026,
    transparent: true,
    opacity: 0.56,
    sizeAttenuation: true,
    depthWrite: false,
  });
  scene.add(new THREE.Points(starGeometry, starMaterial));

  const sunlight = new THREE.DirectionalLight(0xfff4dc, 4.8);
  const coolFill = new THREE.DirectionalLight(0x6c90b8, 0.055);
  coolFill.position.set(-3, 2, 4);
  scene.add(sunlight, coolFill, new THREE.AmbientLight(0x7590a5, 0.012));
  disposables.push(
    moonGeometry,
    moonMaterial,
    earthGeometry,
    earthMaterial,
    atmosphereMaterial,
    orbitGeometry,
    orbitMaterial,
    sightGeometry,
    sightMaterial,
    sunGeometry,
    sunMaterial,
    sunGlowMaterial,
    starGeometry,
    starMaterial,
  );

  function draw(next: MoonSceneState) {
    if (
      disposed ||
      unavailable ||
      !Number.isFinite(next.angle) ||
      next.angle < 0 ||
      next.angle > 360 ||
      (next.view !== "earth" && next.view !== "orbit")
    )
      return;
    current = next;
    const radians = (next.angle * Math.PI) / 180;
    earthViewGroup.visible = next.view === "earth";
    orbitGroup.visible = next.view === "orbit";
    if (next.view === "earth") {
      sunlight.position.set(Math.sin(radians) * 8, 0.3, -Math.cos(radians) * 8);
      const earthCameraDistance = Math.max(5.35, 5.85 / camera.aspect);
      camera.position.set(0, 0.05, earthCameraDistance);
      camera.lookAt(0, 0, 0);
    } else {
      sunlight.position.set(8, 0.4, 0.5);
      const narrow = camera.aspect < 0.95;
      orbitGroup.scale.setScalar(narrow ? 0.73 : 1);
      orbitGroup.position.x = narrow ? -0.45 : 0;
      orbitMoon.position.set(
        Math.cos(radians) * orbitRadius,
        Math.sin(radians) * orbitRadius,
        0,
      );
      orbitMoon.rotation.z = radians + Math.PI;
      const positions = sightGeometry.attributes.position;
      positions.setXYZ(0, 0, 0, 0);
      positions.setXYZ(
        1,
        orbitMoon.position.x,
        orbitMoon.position.y,
        orbitMoon.position.z,
      );
      positions.needsUpdate = true;
      camera.position.set(0, narrow ? 3.5 : 3.7, narrow ? 12.5 : 8.25);
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
  }

  const resize = () => {
    const { width, height } = element.getBoundingClientRect();
    if (!width || !height || disposed) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw(current);
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    fail();
  };
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  const observer = new ResizeObserver(resize);
  observer.observe(element);
  resize();
  return {
    setState: draw,
    setAngle(angle) {
      draw({ ...current, angle });
    },
    setView(view) {
      draw({ ...current, view });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      delete element.dataset.surfaceReady;
      for (const disposable of disposables) disposable.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
