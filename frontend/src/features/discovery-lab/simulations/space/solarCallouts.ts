import * as THREE from "three";

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

type SolarCalloutsOptions = {
  scene: THREE.Scene;
  system: THREE.Group;
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  sun: THREE.Object3D;
  planets: readonly THREE.Object3D[];
  names: readonly string[];
};

export function createSolarCallouts({
  scene,
  system,
  camera,
  renderer,
  sun,
  planets,
  names,
}: SolarCalloutsOptions) {
  const followLabels = names.map((name) => {
    const label = createSceneLabel(name);
    label.name = `solar-follow-label-${name.toLowerCase()}`;
    system.add(label);
    return label;
  });
  const followSunLabel = createSceneLabel("Sun", true);
  followSunLabel.name = "solar-follow-label-sun";
  system.add(followSunLabel);
  const overviewLabels = names.map((name) => {
    const label = createOverviewSceneLabel(name);
    label.name = `solar-label-${name.toLowerCase()}`;
    scene.add(label);
    return label;
  });
  const overviewSunLabel = createOverviewSceneLabel("Sun", true);
  overviewSunLabel.name = "solar-label-sun";
  scene.add(overviewSunLabel);
  const overviewLeaders = Array.from({ length: names.length + 1 }, () => {
    const leader = createOverviewLeader();
    scene.add(leader);
    return leader;
  });
  const projectedPosition = new THREE.Vector3();
  const worldPosition = new THREE.Vector3();

  const layoutOverview = () => {
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;
    if (!width || !height) return;
    system.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    const bodies = [sun, ...planets];
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

  return {
    followLabels,
    followSunLabel,
    overviewLabels,
    overviewSunLabel,
    overviewLeaders,
    layoutOverview,
  };
}
