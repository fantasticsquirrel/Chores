import * as THREE from "three";
import type { SceneContext } from "./createSpaceScene";
import { frameCamera } from "./createSpaceScene";
import {
  addStars,
  createPlanet,
  illustratedTexture,
  mesh,
  ring,
} from "./spaceMaterials";
import { PLANETS, planetAngle } from "./spaceModels";

export type SolarSceneMode = "orbits" | "sizes";
export type SolarCameraMode = "close" | "overview" | "follow";
export type SolarSceneState = {
  selected: number;
  earthYears: number;
  mode: SolarSceneMode;
  cameraMode?: SolarCameraMode;
  planetAngles?: readonly number[];
};

type SolarScreenPoint = { x: number; y: number };

const SOLAR_OVERVIEW_LABEL_HEIGHT_PX = 30;
const SOLAR_OVERVIEW_LABEL_FONT_PX = 48;
const SOLAR_OVERVIEW_LABEL_TEXTURE_HEIGHT_PX = 96;
const SOLAR_OVERVIEW_LABEL_GAP_PX = 6;
const SOLAR_OVERVIEW_BODY_CLEARANCE_PX = 7;

export const SOLAR_OVERVIEW_GLYPH_HEIGHT_PX =
  (SOLAR_OVERVIEW_LABEL_HEIGHT_PX * SOLAR_OVERVIEW_LABEL_FONT_PX) /
  SOLAR_OVERVIEW_LABEL_TEXTURE_HEIGHT_PX;

export function layoutSolarOverviewCallouts(
  anchors: readonly SolarScreenPoint[],
  labelWidths: readonly number[],
  viewportWidth: number,
  viewportHeight: number,
) {
  const sun = anchors[0] ?? {
    x: viewportWidth / 2,
    y: viewportHeight / 2,
  };
  const top = viewportHeight <= 520 ? 116 : 108;
  const bottom = 16;
  const side = 8;
  const clamp = (value: number, minimum: number, maximum: number) =>
    Math.max(minimum, Math.min(maximum, value));
  const directions = anchors.map((anchor, index) => {
    const dx = index === 0 ? 0 : anchor.x - sun.x;
    const dy = index === 0 ? 1 : anchor.y - sun.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  });
  const placements = anchors.map((anchor, index) => {
    const direction = directions[index];
    const width = labelWidths[index] ?? 60;
    const horizontalDistance =
      Math.abs(direction.x) > 0.01
        ? (width / 2 + SOLAR_OVERVIEW_BODY_CLEARANCE_PX + 5) /
          Math.abs(direction.x)
        : Number.POSITIVE_INFINITY;
    const verticalDistance =
      Math.abs(direction.y) > 0.01
        ? (SOLAR_OVERVIEW_LABEL_HEIGHT_PX / 2 +
            SOLAR_OVERVIEW_BODY_CLEARANCE_PX +
            5) /
          Math.abs(direction.y)
        : Number.POSITIVE_INFINITY;
    const distance = Math.min(horizontalDistance, verticalDistance);
    return {
      x: anchor.x + direction.x * distance,
      y: anchor.y + direction.y * distance,
    };
  });

  const pushSign = (delta: number, fallback: number) =>
    delta === 0 ? (fallback >= 0 ? 1 : -1) : Math.sign(delta);
  const keepInFrame = (index: number) => {
    const halfWidth = (labelWidths[index] ?? 60) / 2;
    placements[index].x = clamp(
      placements[index].x,
      side + halfWidth,
      viewportWidth - side - halfWidth,
    );
    placements[index].y = clamp(
      placements[index].y,
      top + SOLAR_OVERVIEW_LABEL_HEIGHT_PX / 2,
      viewportHeight - bottom - SOLAR_OVERVIEW_LABEL_HEIGHT_PX / 2,
    );
  };

  for (let iteration = 0; iteration < 80; iteration += 1) {
    placements.forEach((_, labelIndex) => {
      const halfWidth = (labelWidths[labelIndex] ?? 60) / 2;
      anchors.forEach((anchor, anchorIndex) => {
        const dx = placements[labelIndex].x - anchor.x;
        const dy = placements[labelIndex].y - anchor.y;
        const overlapX =
          halfWidth + SOLAR_OVERVIEW_BODY_CLEARANCE_PX - Math.abs(dx);
        const overlapY =
          SOLAR_OVERVIEW_LABEL_HEIGHT_PX / 2 +
          SOLAR_OVERVIEW_BODY_CLEARANCE_PX -
          Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) return;
        if (overlapX < overlapY) {
          placements[labelIndex].x +=
            pushSign(dx, directions[labelIndex].x || labelIndex - anchorIndex) *
            overlapX;
        } else {
          placements[labelIndex].y +=
            pushSign(dy, directions[labelIndex].y || labelIndex - anchorIndex) *
            overlapY;
        }
      });
      keepInFrame(labelIndex);
    });

    for (let first = 0; first < placements.length; first += 1) {
      for (let second = first + 1; second < placements.length; second += 1) {
        const dx = placements[first].x - placements[second].x;
        const dy = placements[first].y - placements[second].y;
        const overlapX =
          ((labelWidths[first] ?? 60) + (labelWidths[second] ?? 60)) / 2 +
          SOLAR_OVERVIEW_LABEL_GAP_PX -
          Math.abs(dx);
        const overlapY =
          SOLAR_OVERVIEW_LABEL_HEIGHT_PX +
          SOLAR_OVERVIEW_LABEL_GAP_PX -
          Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (overlapX < overlapY) {
          const shift = overlapX / 2;
          const sign = pushSign(dx, first - second);
          placements[first].x += sign * shift;
          placements[second].x -= sign * shift;
        } else {
          const shift = overlapY / 2;
          const sign = pushSign(dy, first - second);
          placements[first].y += sign * shift;
          placements[second].y -= sign * shift;
        }
        keepInFrame(first);
        keepInFrame(second);
      }
    }
  }

  return placements;
}

function orbitRadius(index: number) {
  return 0.5 + Math.log1p(PLANETS[index].distance) * 0.72;
}

function createGlowSphere(radius: number, color: number, opacity: number) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 56, 36),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

function createSceneLabel(text: string, accent = false) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "rgba(3, 14, 24, 0.88)";
  context.fillRect(1, 1, canvas.width - 2, canvas.height - 2);
  context.strokeStyle = accent
    ? "rgba(245, 223, 162, 0.92)"
    : "rgba(141, 193, 201, 0.72)";
  context.lineWidth = 4;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.fillStyle = accent ? "#fff1bd" : "#f2f7f2";
  context.font = "700 42px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    }),
  );
  label.renderOrder = 20;
  return label;
}

function createOverviewSceneLabel(text: string, accent = false) {
  const canvas = document.createElement("canvas");
  canvas.height = SOLAR_OVERVIEW_LABEL_TEXTURE_HEIGHT_PX;
  const measurementContext = canvas.getContext("2d")!;
  measurementContext.font = `700 ${SOLAR_OVERVIEW_LABEL_FONT_PX}px system-ui, sans-serif`;
  canvas.width = Math.ceil(measurementContext.measureText(text).width + 44);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "rgba(3, 14, 24, 0.92)";
  context.fillRect(1, 1, canvas.width - 2, canvas.height - 2);
  context.strokeStyle = accent
    ? "rgba(245, 223, 162, 0.96)"
    : "rgba(141, 193, 201, 0.82)";
  context.lineWidth = 4;
  context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  context.fillStyle = accent ? "#fff1bd" : "#f7fbf5";
  context.font = `700 ${SOLAR_OVERVIEW_LABEL_FONT_PX}px system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    }),
  );
  label.userData.pixelWidth =
    (canvas.width / canvas.height) * SOLAR_OVERVIEW_LABEL_HEIGHT_PX;
  label.renderOrder = 20;
  return label;
}

function createOverviewLeader() {
  const leader = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]),
    new THREE.LineBasicMaterial({
      color: 0x9ac4c5,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
      depthWrite: false,
    }),
  );
  leader.frustumCulled = false;
  leader.renderOrder = 19;
  return leader;
}

function createAsteroidBelt(parent: THREE.Object3D) {
  const inner = orbitRadius(3);
  const outer = orbitRadius(4);
  const points = Array.from({ length: 460 }, (_, index) => {
    const fraction = (index * 0.61803398875) % 1;
    const angle = index * 2.3999632297;
    const radius = inner + (outer - inner) * (0.31 + fraction * 0.31);
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      ((index % 9) - 4) * 0.0025,
      Math.sin(angle) * radius,
    );
  });
  const belt = new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.PointsMaterial({
      color: 0xa89b86,
      size: 0.012,
      transparent: true,
      opacity: 0.48,
      sizeAttenuation: true,
    }),
  );
  belt.name = "solar-asteroid-belt";
  parent.add(belt);
}

function arcGeometry(radius: number, start: number, fraction: number) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const points = Array.from({ length: 121 }, (_, index) => {
    const angle = start + (index / 120) * clamped * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      0.018,
      -Math.sin(angle) * radius,
    );
  });
  return new THREE.BufferGeometry().setFromPoints(points);
}

export function buildSolarScene(
  { scene, camera, renderer, invalidate }: SceneContext,
  earthUrl: string,
) {
  const earthTexture = new THREE.TextureLoader().load(earthUrl, invalidate);
  earthTexture.colorSpace = THREE.SRGBColorSpace;
  earthTexture.anisotropy = Math.min(
    8,
    renderer.capabilities.getMaxAnisotropy(),
  );
  const textures = PLANETS.map((_, index) =>
    index === 2 ? earthTexture : illustratedTexture(index),
  );
  textures.forEach((texture) => {
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  });

  const stars = addStars(scene);
  const ambient = new THREE.HemisphereLight(0x91b9d5, 0x02050a, 0.78);
  scene.add(ambient);
  const warmKey = new THREE.DirectionalLight(0xffddac, 4.6);
  warmKey.position.set(-6, 5, 8);
  warmKey.castShadow = true;
  scene.add(warmKey);
  const blueRim = new THREE.DirectionalLight(0x5db7e6, 1.6);
  blueRim.position.set(5, 2, -7);
  scene.add(blueRim);

  const close = new THREE.Group();
  close.name = "solar-close-mission";
  const system = new THREE.Group();
  system.name = "solar-system-overview";
  const sizes = new THREE.Group();
  sizes.name = "solar-diameter-bay";
  scene.add(close, system, sizes);

  const closeWorlds = PLANETS.map((_, index) => {
    const group = createPlanet(index, 1.18, earthTexture, textures[index]);
    group.name = `solar-close-${index}`;
    group.add(createGlowSphere(1.23, index === 2 ? 0x58aee4 : 0xb9d0d6, 0.12));
    close.add(group);
    return group;
  });
  const closeInset = new THREE.Group();
  closeInset.name = "solar-close-heliocentric-inset";
  close.add(closeInset);
  mesh(
    new THREE.SphereGeometry(0.075, 32, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd47d }),
    closeInset,
  );
  closeInset.add(createGlowSphere(0.11, 0xffa84d, 0.16));
  const insetRadii = PLANETS.map(
    (planet) => 0.11 + Math.log1p(planet.distance) * 0.15,
  );
  const insetOrbitLines = PLANETS.map((_, index) =>
    ring(insetRadii[index], 0x55798c, closeInset, 0.45),
  );
  const insetPlanets = PLANETS.map((planet, index) => {
    const radius = Math.min(
      0.034,
      0.012 + Math.sqrt(planet.diameter / PLANETS[2].diameter) * 0.006,
    );
    const body = createPlanet(index, radius, earthTexture, textures[index]);
    closeInset.add(body);
    return body;
  });
  const insetMarker = ring(0.055, 0xf5dfa2, closeInset, 0.95);
  insetMarker.rotation.x = Math.PI / 2;

  const sunGroup = new THREE.Group();
  sunGroup.name = "solar-sun";
  system.add(sunGroup);
  mesh(
    new THREE.SphereGeometry(0.2, 56, 36),
    new THREE.MeshBasicMaterial({ color: 0xffd47d }),
    sunGroup,
  );
  for (let layer = 0; layer < 5; layer += 1)
    sunGroup.add(
      createGlowSphere(0.23 + layer * 0.035, 0xffa84d, 0.09 - layer * 0.012),
    );
  const sunLight = new THREE.PointLight(0xffc36d, 16, 0, 2);
  sunLight.position.set(0, 0.16, 0);
  system.add(sunLight);

  const orbitLines = PLANETS.map((_, index) =>
    ring(orbitRadius(index), 0x55798c, system, 0.42),
  );
  createAsteroidBelt(system);
  const systemPlanetRadii = PLANETS.map((planet) =>
    Math.min(
      0.16,
      0.065 + Math.sqrt(planet.diameter / PLANETS[2].diameter) * 0.026,
    ),
  );
  const systemPlanets = PLANETS.map((_, index) => {
    const radius = systemPlanetRadii[index];
    const group = createPlanet(index, radius, earthTexture, textures[index]);
    group.name = `solar-overview-${index}`;
    system.add(group);
    return group;
  });
  const followLabels = PLANETS.map((planet) => {
    const label = createSceneLabel(planet.name);
    label.name = `solar-follow-label-${planet.name.toLowerCase()}`;
    system.add(label);
    return label;
  });
  const followSunLabel = createSceneLabel("Sun", true);
  followSunLabel.name = "solar-follow-label-sun";
  system.add(followSunLabel);
  const overviewLabels = PLANETS.map((planet) => {
    const label = createOverviewSceneLabel(planet.name);
    label.name = `solar-label-${planet.name.toLowerCase()}`;
    scene.add(label);
    return label;
  });
  const overviewSunLabel = createOverviewSceneLabel("Sun", true);
  overviewSunLabel.name = "solar-label-sun";
  scene.add(overviewSunLabel);
  const overviewLeaders = Array.from({ length: PLANETS.length + 1 }, () => {
    const leader = createOverviewLeader();
    scene.add(leader);
    return leader;
  });
  const selectedMarker = ring(0.17, 0xf5dfa2, system, 0.92);
  selectedMarker.rotation.x = Math.PI / 2;
  const startMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.008, 8, 40),
    new THREE.MeshBasicMaterial({
      color: 0x9ac4c5,
      transparent: true,
      opacity: 0.62,
    }),
  );
  startMarker.rotation.x = Math.PI / 2;
  startMarker.name = "solar-start-marker";
  system.add(startMarker);
  const travelGlow = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0x66e5cc,
      transparent: true,
      opacity: 0.28,
    }),
  );
  travelGlow.scale.setScalar(1.004);
  const travel = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xc8f1db }),
  );
  travel.name = "solar-elapsed-arc";
  system.add(travelGlow, travel);

  const earthSize = createPlanet(2, 0.13, earthTexture, textures[2]);
  sizes.add(earthSize);
  const comparisons = PLANETS.map((planet, index) => {
    const body = createPlanet(
      index,
      (planet.diameter / PLANETS[2].diameter) * 0.13,
      earthTexture,
      textures[index],
    );
    sizes.add(body);
    return body;
  });
  const measurement = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({
      color: 0xbce5d5,
      dashSize: 0.045,
      gapSize: 0.03,
      transparent: true,
      opacity: 0.82,
    }),
  );
  sizes.add(measurement);

  let aspect = 1.6;
  let state: SolarSceneState = {
    selected: 2,
    earthYears: 0,
    mode: "orbits",
    cameraMode: "close",
  };
  const selectedPosition = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const projectedPosition = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();

  const layoutOverviewLabels = () => {
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    if (!width || !height) return;
    system.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const bodies = [sunGroup, ...systemPlanets];
    const labels = [overviewSunLabel, ...overviewLabels];
    const anchors = bodies.map((body) => {
      body.getWorldPosition(worldPosition);
      projectedPosition.copy(worldPosition).project(camera);
      return {
        x: ((projectedPosition.x + 1) / 2) * width,
        y: ((1 - projectedPosition.y) / 2) * height,
        z: projectedPosition.z,
        world: worldPosition.clone(),
      };
    });
    const labelWidths = labels.map(
      (label) => label.userData.pixelWidth as number,
    );
    const placements = layoutSolarOverviewCallouts(
      anchors,
      labelWidths,
      width,
      height,
    );
    const worldHeight = camera.top - camera.bottom;
    const labelWorldHeight =
      (SOLAR_OVERVIEW_LABEL_HEIGHT_PX / height) * worldHeight;

    labels.forEach((label, index) => {
      const placement = placements[index];
      projectedPosition.set(
        (placement.x / width) * 2 - 1,
        1 - (placement.y / height) * 2,
        anchors[index].z,
      );
      projectedPosition.unproject(camera);
      label.position.copy(projectedPosition);
      label.scale.set(
        labelWorldHeight *
          (labelWidths[index] / SOLAR_OVERVIEW_LABEL_HEIGHT_PX),
        labelWorldHeight,
        1,
      );
      const leaderPositions = overviewLeaders[index].geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      leaderPositions.setXYZ(
        0,
        anchors[index].world.x,
        anchors[index].world.y,
        anchors[index].world.z,
      );
      leaderPositions.setXYZ(
        1,
        projectedPosition.x,
        projectedPosition.y,
        projectedPosition.z,
      );
      leaderPositions.needsUpdate = true;
    });
  };

  const layout = () => {
    close.visible = state.mode === "orbits" && state.cameraMode === "close";
    system.visible = state.mode === "orbits" && state.cameraMode !== "close";
    sizes.visible = state.mode === "sizes";
    stars.position.set(0, 0, 0);
    const sunCenteredLighting =
      state.mode === "orbits" && state.cameraMode !== "close";
    warmKey.visible = !sunCenteredLighting;
    blueRim.visible = !sunCenteredLighting;
    ambient.intensity = sunCenteredLighting ? 0.22 : 0.78;
    sunLight.visible = sunCenteredLighting;
    selectedMarker.visible = state.cameraMode === "overview";
    followLabels.forEach((label, index) => {
      label.visible = state.cameraMode === "follow" && index === state.selected;
      label.scale.set(aspect < 1 ? 0.62 : 0.66, aspect < 1 ? 0.155 : 0.165, 1);
    });
    followSunLabel.visible = state.cameraMode === "follow";
    followSunLabel.scale.set(
      aspect < 1 ? 0.52 : 0.54,
      aspect < 1 ? 0.13 : 0.135,
      1,
    );
    followSunLabel.position.set(0, 0.3, 0);
    const overviewVisible =
      state.mode === "orbits" && state.cameraMode === "overview";
    overviewLabels.forEach((label) => {
      label.visible = overviewVisible;
    });
    overviewSunLabel.visible = overviewVisible;
    overviewLeaders.forEach((leader) => {
      leader.visible = overviewVisible;
    });

    if (state.mode === "sizes") {
      const comparisonRadius =
        (PLANETS[state.selected].diameter / PLANETS[2].diameter) * 0.13;
      const largest = Math.max(0.13, comparisonRadius);
      const separation = Math.max(0.72, largest + 0.5);
      const baseline = -0.72;
      earthSize.position.set(-separation, baseline + 0.13, 0);
      comparisons[state.selected].position.set(
        separation,
        baseline + comparisonRadius,
        0,
      );
      measurement.geometry.dispose();
      measurement.geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-separation - 0.23, baseline, 0.1),
        new THREE.Vector3(
          separation + Math.max(0.23, comparisonRadius),
          baseline,
          0.1,
        ),
      ]);
      measurement.computeLineDistances();
      frameCamera(
        camera,
        aspect,
        Math.max(0.86, largest * 1.32 + 0.38),
        separation + largest + 0.34,
      );
      focus.set(0, baseline + largest * 0.72, 0);
      camera.position.set(0, 1.45, 8.4);
      camera.lookAt(focus);
      return;
    }

    if (state.cameraMode === "overview") {
      frameCamera(camera, aspect, 3.18, 3.18);
      focus.set(0, 0, 0);
      camera.position.set(0, 7.8, 6.9);
      camera.lookAt(focus);
      system.rotation.set(0.92, 0, -0.14);
      layoutOverviewLabels();
      return;
    }

    if (state.cameraMode === "follow") {
      system.rotation.set(0.45, 0, -0.08);
      system.updateMatrixWorld(true);
      systemPlanets[state.selected].getWorldPosition(selectedPosition);
      focus.copy(selectedPosition);
      frameCamera(
        camera,
        aspect,
        aspect < 1 ? 0.98 : 0.82,
        aspect < 1 ? 0.7 : 1.2,
      );
      camera.position.copy(focus).add(new THREE.Vector3(2.9, 2.5, 3.1));
      camera.lookAt(focus);
      stars.position.copy(focus);
      return;
    }

    frameCamera(
      camera,
      aspect,
      aspect < 1 ? 1.85 : 1.58,
      aspect < 1 ? 1.7 : 2.2,
    );
    closeWorlds.forEach((world) => {
      world.position.set(aspect < 1 ? 0 : 0.38, aspect < 1 ? 0.22 : 0.12, 0);
      world.scale.setScalar(aspect < 1 ? 0.9 : 1);
    });
    closeInset.position.set(
      aspect < 1 ? -0.55 : -1.43,
      aspect < 1 ? -1.25 : -1.0,
      0.22,
    );
    closeInset.scale.setScalar(aspect < 1 ? 0.82 : 0.86);
    focus.set(0.12, -0.02, 0);
    camera.position.set(2.9, 3.1, 6.4);
    camera.lookAt(focus);
  };

  return {
    resize(value: number) {
      aspect = value;
      layout();
    },
    update(next: SolarSceneState) {
      state = { ...next, cameraMode: next.cameraMode ?? "overview" };
      closeWorlds.forEach((world, index) => {
        world.visible = index === state.selected;
        world.rotation.y = -0.25 + state.earthYears * 0.08;
      });
      comparisons.forEach((world, index) => {
        world.visible = index === state.selected;
        world.rotation.y = -0.4 + state.earthYears * 0.05;
      });
      earthSize.rotation.y = -0.4 + state.earthYears * 0.05;

      systemPlanets.forEach((world, index) => {
        const angle =
          state.planetAngles?.[index] ?? planetAngle(index, state.earthYears);
        const radius = orbitRadius(index);
        world.position.set(
          Math.cos(angle) * radius,
          0,
          -Math.sin(angle) * radius,
        );
        world.rotation.y = -0.2 + state.earthYears * (0.04 + index * 0.004);
        const line = orbitLines[index].material as THREE.LineBasicMaterial;
        line.color.set(index === state.selected ? 0xf0d996 : 0x55798c);
        line.opacity = index === state.selected ? 0.94 : 0.4;
      });
      insetPlanets.forEach((world, index) => {
        const angle =
          state.planetAngles?.[index] ?? planetAngle(index, state.earthYears);
        const radius = insetRadii[index];
        world.position.set(
          Math.cos(angle) * radius,
          0,
          -Math.sin(angle) * radius,
        );
        world.scale.setScalar(index === state.selected ? 1.75 : 1);
        const line = insetOrbitLines[index].material as THREE.LineBasicMaterial;
        line.color.set(index === state.selected ? 0xf0d996 : 0x55798c);
        line.opacity = index === state.selected ? 0.96 : 0.38;
      });
      insetMarker.position.copy(insetPlanets[state.selected].position);

      const selected = systemPlanets[state.selected];
      const selectedRadius = orbitRadius(state.selected);
      const start = state.selected * 0.8;
      selectedMarker.position.copy(selected.position);
      selectedMarker.scale.setScalar(
        Math.max(
          0.85,
          (systemPlanetRadii[state.selected] * 1.18 + 0.04) / 0.17,
        ),
      );
      startMarker.position.set(
        Math.cos(start) * selectedRadius,
        0.018,
        -Math.sin(start) * selectedRadius,
      );
      const rawFraction = state.earthYears / PLANETS[state.selected].year;
      const remainder = rawFraction - Math.floor(rawFraction);
      const shownFraction =
        rawFraction > 0 && remainder < 0.0001 ? 1 : remainder;
      travel.geometry.dispose();
      travelGlow.geometry.dispose();
      travel.geometry = arcGeometry(selectedRadius, start, shownFraction);
      travelGlow.geometry = travel.geometry.clone();

      systemPlanets.forEach((world, index) => {
        const scale =
          index === state.selected
            ? state.cameraMode === "follow"
              ? 2.15
              : state.cameraMode === "overview"
                ? 1.18
                : 1
            : 1;
        world.scale.setScalar(scale);
        followLabels[index].position.set(
          world.position.x,
          systemPlanetRadii[index] * scale +
            (state.cameraMode === "follow" ? 0.17 : 0.1),
          world.position.z,
        );
      });
      layout();
    },
  };
}
