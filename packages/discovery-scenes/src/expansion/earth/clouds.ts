import * as T from "three";
import {
  cloudResult,
  initialCloud,
  normalizeCloud,
  type CloudState,
} from "@family-manager/family-api/discovery-models/cloud-rain";
import type { ExpansionLabel } from "../types";
import { arrow, box, earthScene, mesh, rock, terrain, tube } from "./geometry";

const sceneY = (heightM: number) => 0.95 + heightM / 480;

function addTerrain(group: T.Group) {
  box(group, [12.8, 0.6, 7.2], [0, -0.75, 0], 0x65563c).name =
    "terrain-foundation";
  box(group, [12.8, 0.25, 7.2], [0, -0.32, 0], 0xa48a5f).name = "soil-layer";
  const elevation = (x: number, z: number) =>
    0.1 +
    1.5 * Math.exp(-((x - 4) ** 2 + (z + 1.8) ** 2) / 5) +
    0.1 * Math.sin(x * 1.8) * Math.cos(z * 2);
  terrain(group, 12.8, 7.2, elevation, 0x71935c).name =
    "dimensional-weather-terrain";
  for (let index = 0; index < 42; index += 1) {
    const x = ((index * 1.83) % 12) - 6;
    const z = ((index * 2.73) % 6.8) - 3.4;
    if (Math.abs(x + 1) < 1.8) continue;
    if (index % 3 === 0)
      rock(
        group,
        [x, elevation(x, z) + 0.06, z],
        0.13,
        index % 2 ? 0xaaa58a : 0x918976,
      );
    else {
      const trunk = mesh(
        group,
        new T.CylinderGeometry(0.035, 0.05, 0.4, 5),
        0x66513b,
        [x, elevation(x, z) + 0.2, z],
      );
      const crown = mesh(
        group,
        new T.ConeGeometry(0.22, 0.65, 8),
        index % 4 ? 0x335f46 : 0x46795a,
        [x, trunk.position.y + 0.45, z],
      );
      crown.rotation.y = index * 0.7;
    }
  }
  for (let row = 0; row < 6; row += 1)
    tube(
      group,
      Array.from({ length: 19 }, (_, point) => {
        const x = -6 + point * 0.64;
        const z = 2.25 + row * 0.16;
        return new T.Vector3(x, elevation(x, z) + 0.025, z);
      }),
      row % 2 ? 0xb7b77a : 0x8f9f66,
      0.017,
    );
  return elevation;
}

function addLakeAndEvaporation(group: T.Group) {
  const lake = mesh(
    group,
    new T.CircleGeometry(1.35, 60),
    0x3b8eac,
    [-4, 0.28, -1.3],
    0.86,
  );
  lake.name = "surface-water";
  lake.rotation.x = -Math.PI / 2;
  lake.scale.y = 0.6;
  for (let ringIndex = 0; ringIndex < 4; ringIndex += 1) {
    const ring = mesh(
      group,
      new T.TorusGeometry(0.35 + ringIndex * 0.22, 0.012, 5, 48),
      0xa5dfea,
      [-4, 0.305 + ringIndex * 0.004, -1.3],
      0.64,
    );
    ring.rotation.x = Math.PI / 2;
  }
  const evaporation = new T.Group();
  evaporation.name = "evaporation-to-invisible-vapor";
  for (let index = 0; index < 6; index += 1)
    arrow(
      evaporation,
      new T.Vector3(-4.65 + index * 0.25, 0.45, -1.25),
      new T.Vector3(-4.65 + index * 0.25, 1.25 + (index % 2) * 0.12, -1.25),
      0xb7e9ef,
      0.62,
    );
  group.add(evaporation);
}

function addParcel(
  group: T.Group,
  state: CloudState,
  result: ReturnType<typeof cloudResult>,
) {
  const parcelY = sceneY(state.upliftM);
  const parcelGroup = new T.Group();
  parcelGroup.name = "air-parcel-teaching-marker";
  const parcel = mesh(
    parcelGroup,
    new T.SphereGeometry(0.48, 28, 20),
    result.cloud ? 0xdde9e4 : 0xe8b978,
    [-1, parcelY, 0],
    result.cloud ? 0.18 : 0.28,
  );
  parcel.userData.select = 0;
  const ring = mesh(
    parcelGroup,
    new T.TorusGeometry(0.61, 0.03, 8, 64),
    result.cloud ? 0x9ee2e2 : 0xffd49b,
    [-1, parcelY, 0],
  );
  ring.rotation.x = Math.PI / 2;
  ring.userData.select = 0;
  const liftArrow = arrow(
    parcelGroup,
    new T.Vector3(-1, 0.52, 0),
    new T.Vector3(-1, Math.max(0.85, parcelY - 0.62), 0),
    0xf3b77e,
  );
  liftArrow.name = "parcel-lift-arrow";
  for (let index = 0; index < 22; index += 1) {
    const x = -1 + Math.cos(index * 2.39) * 0.34;
    const z = Math.sin(index * 2.39) * 0.34;
    const marker = mesh(
      parcelGroup,
      new T.SphereGeometry(0.026, 8, 6),
      0xf6ce91,
      [x, parcelY + ((index % 5) - 2) * 0.12, z],
      0.78,
    );
    marker.name = "invisible-vapor-diagram-marker";
  }
  group.add(parcelGroup);
  return parcelY;
}

function addCloudAndPrecipitation(
  group: T.Group,
  state: CloudState,
  result: ReturnType<typeof cloudResult>,
) {
  const cloudBaseY = sceneY(Math.min(2_000, result.condensationHeightM));
  const cloudBase = new T.Group();
  cloudBase.name = "estimated-condensation-level";
  tube(
    cloudBase,
    [
      new T.Vector3(-3.2, cloudBaseY, 0.88),
      new T.Vector3(2.4, cloudBaseY, 0.88),
    ],
    0x9cc5d3,
    0.018,
  );
  for (let index = 0; index < 8; index += 1)
    box(
      cloudBase,
      [0.26, 0.026, 0.045],
      [-3.1 + index * 0.76, cloudBaseY, 1.02],
      0xe5e8ce,
    );
  group.add(cloudBase);
  if (!result.cloud) return cloudBaseY;

  const cloud = new T.Group();
  cloud.name = "visible-liquid-cloud-droplets";
  const scale = 0.78 + Math.min(1, result.cloudDepthM / 1_000) * 0.62;
  for (let index = 0; index < 38; index += 1) {
    const angle = index * 2.399;
    const radius = 0.18 + ((index * 7) % 13) / 12;
    const x = -1 + Math.cos(angle) * radius * 1.75 * scale;
    const z = Math.sin(angle) * radius * 0.85 * scale;
    const y = cloudBaseY + 0.35 + Math.max(0, 1 - radius) * 0.95 * scale;
    const puff = mesh(
      cloud,
      new T.SphereGeometry(0.46 + (index % 5) * 0.1, 20, 14),
      index % 5 === 0 ? 0xaebfc1 : index % 3 === 0 ? 0xd7e0da : 0xf1f0df,
      [x, y, z],
      0.94,
    );
    puff.scale.set(1.28, 0.84, 1);
    puff.userData.select = 0;
  }
  const representativeParticles = new T.Group();
  representativeParticles.name = "representative-cloud-particles";
  const particleRadius = Math.min(
    0.12,
    0.027 + Math.log10(Math.max(10, state.particleDiameterUm) / 10) * 0.035,
  );
  for (let index = 0; index < 18; index += 1)
    mesh(
      representativeParticles,
      new T.SphereGeometry(particleRadius, 10, 8),
      0xb8eff7,
      [
        -1.7 + (index % 6) * 0.28,
        cloudBaseY + 0.38 + Math.floor(index / 6) * 0.25,
        1.05,
      ],
      0.9,
    );
  cloud.add(representativeParticles);
  group.add(cloud);

  if (!result.fallingPrecipitation) return cloudBaseY;
  const precipitation = new T.Group();
  precipitation.name = result.virga
    ? "virga-evaporating-before-ground"
    : "precipitation-reaching-ground";
  const bottomY = result.virga ? 1.05 : 0.34;
  const available = Math.max(0.3, cloudBaseY - bottomY);
  for (let index = 0; index < 72; index += 1) {
    const fraction = ((index * 0.47) % available) / available;
    const x = -3.05 + ((index * 1.19) % 4.3);
    const z = -0.85 + ((index * 0.77) % 1.9);
    const y = cloudBaseY - fraction * available;
    const taper = result.virga ? Math.max(0.18, (y - bottomY) / available) : 1;
    const drop = mesh(
      precipitation,
      new T.CylinderGeometry(0.012 * taper, 0.026 * taper, 0.18 * taper, 6),
      result.virga ? 0x8fc7d4 : 0x63bfe5,
      [x, y, z],
      result.virga ? 0.42 + 0.5 * taper : 0.9,
    );
    drop.rotation.z = -0.1;
  }
  if (result.virga)
    for (let index = 0; index < 6; index += 1) {
      const wisp = mesh(
        precipitation,
        new T.TorusGeometry(0.12 + index * 0.018, 0.012, 5, 32, Math.PI * 1.4),
        0xb9e7e9,
        [-2.4 + index * 0.58, 0.92 + (index % 2) * 0.1, -0.2],
        0.45,
      );
      wisp.rotation.x = Math.PI / 2;
    }
  else {
    const wetGround = new T.Group();
    wetGround.name = "rain-impact-and-puddles";
    for (let index = 0; index < 7; index += 1) {
      const splash = mesh(
        wetGround,
        new T.TorusGeometry(0.12 + (index % 3) * 0.06, 0.012, 5, 32),
        0x8bd8ef,
        [-2.75 + index * 0.62, 0.35, -0.35 + (index % 2) * 0.42],
        0.72,
      );
      splash.rotation.x = Math.PI / 2;
    }
    precipitation.add(wetGround);
  }
  group.add(precipitation);
  return cloudBaseY;
}

function build(input: CloudState) {
  const state = normalizeCloud(input);
  const result = cloudResult(state);
  const group = new T.Group();
  group.name = "cloud-rain-dimensional-landscape";
  addTerrain(group);
  addLakeAndEvaporation(group);
  const parcelY = addParcel(group, state, result);
  const cloudBaseY = addCloudAndPrecipitation(group, state, result);
  const outcomeLabel =
    result.outcome === "invisible-vapor"
      ? "Invisible vapor · no cloud yet"
      : result.outcome === "cloud-droplets"
        ? `${state.particleDiameterUm.toFixed(0)} µm droplets · no precipitation`
        : result.outcome === "virga"
          ? "Virga · drops evaporate aloft"
          : result.outcome === "rain-at-ground"
            ? `${state.particleDiameterUm.toFixed(0)} → ${result.groundParticleDiameterUm.toFixed(0)} µm · rain at ground`
            : `${state.particleDiameterUm.toFixed(0)} → ${result.groundParticleDiameterUm.toFixed(0)} µm · drizzle at ground`;
  const labels: ExpansionLabel[] = [
    {
      text: "Evaporation → invisible vapor",
      at: [-4.2, 1.05, -1.2],
      left: 17,
      top: 66,
    },
    {
      text: `${result.parcelTemperatureC.toFixed(1)} °C · ${result.parcelRelativeHumidityPercent.toFixed(0)}% RH`,
      at: [-1, parcelY, 0.1],
      left: 47,
      top: 17,
    },
    {
      text: `Cloud base ≈ ${result.condensationHeightM.toFixed(0)} m`,
      at: [2.35, cloudBaseY, 0.95],
      left: 79,
      top: 38,
    },
    {
      text: outcomeLabel,
      at: [
        -1.1,
        result.virga
          ? 1.15
          : result.groundPrecipitation
            ? 0.38
            : cloudBaseY + 0.45,
        0.2,
      ],
      left: 53,
      top: 82,
    },
  ];
  return { group, labels };
}

export function createCloudRainScene(state: CloudState = initialCloud) {
  return earthScene(state, build, {
    position: [11, 9, 18],
    target: [0, 2.4, 0],
    width: 15,
    height: 10,
  });
}
