import * as T from "three";
import {
  cloudResult,
  initialCloud,
  normalizeCloud,
  type CloudState,
} from "./model";
import type { ExpansionLabel } from "./types";
import { arrow, box, earthScene, mesh, rock, terrain, tube } from "./geometry";
function build(input: CloudState) {
  const s = normalizeCloud(input),
    result = cloudResult(s),
    g = new T.Group();
  box(g, [12.8, 0.6, 7.2], [0, -0.75, 0], 0x756545);
  box(g, [12.8, 0.25, 7.2], [0, -0.32, 0], 0xa49066);
  const elevation = (x: number, z: number) =>
    0.1 +
    1.5 * Math.exp(-((x - 4) ** 2 + (z + 1.8) ** 2) / 5) +
    0.1 * Math.sin(x * 1.8) * Math.cos(z * 2);
  terrain(g, 12.8, 7.2, elevation, 0x71935c);
  for (let i = 0; i < 42; i++) {
    const x = ((i * 1.83) % 12) - 6,
      z = ((i * 2.73) % 6.8) - 3.4;
    if (Math.abs(x + 1) < 1.8) continue;
    if (i % 3 === 0) rock(g, [x, elevation(x, z) + 0.06, z], 0.13, 0xaaa58a);
    else {
      const trunk = mesh(
        g,
        new T.CylinderGeometry(0.035, 0.05, 0.4, 5),
        0x66513b,
        [x, elevation(x, z) + 0.2, z],
      );
      const crown = mesh(g, new T.ConeGeometry(0.22, 0.65, 8), 0x335f46, [
        x,
        trunk.position.y + 0.45,
        z,
      ]);
      crown.rotation.y = i * 0.7;
    }
  }
  for (let i = 0; i < 5; i++)
    tube(
      g,
      Array.from({ length: 18 }, (_, j) => {
        const x = -6 + j * 0.65,
          z = 2.4 + i * 0.15;
        return new T.Vector3(x, elevation(x, z) + 0.025, z);
      }),
      0xb5b477,
      0.018,
    );
  const lake = mesh(
    g,
    new T.CircleGeometry(1.35, 60),
    0x3b8eac,
    [-4, 0.28, -1.3],
    0.8,
  );
  lake.rotation.x = -Math.PI / 2;
  lake.scale.y = 0.6;
  for (let i = 0; i < 5; i++)
    arrow(
      g,
      new T.Vector3(-4.6 + i * 0.25, 0.45, -1.2),
      new T.Vector3(-4.6 + i * 0.25, 1.15, -1.2),
      0xb7e9ef,
      0.6,
    );
  const parcelY = 1 + s.upliftM / 650;
  // This lifted volume is a teaching marker, not an actual balloon or container.
  const parcel = mesh(
    g,
    new T.SphereGeometry(0.48, 28, 20),
    result.cloud ? 0xf4f6e8 : 0xe8b978,
    [-1, parcelY, 0],
    0.27,
  );
  parcel.userData.select = 0;
  const ring = mesh(g, new T.TorusGeometry(0.58, 0.025, 8, 64), 0xffd49b, [
    -1,
    parcelY,
    0,
  ]);
  ring.rotation.x = Math.PI / 2;
  ring.userData.select = 0;
  arrow(
    g,
    new T.Vector3(-1, 0.5, 0),
    new T.Vector3(-1, parcelY - 0.6, 0),
    0xf3b77e,
  );
  const cloudBase = 1 + Math.min(3000, result.condensationHeightM) / 650;
  if (result.condensationHeightM <= 3000) {
    tube(
      g,
      [new T.Vector3(-3, cloudBase, 0.8), new T.Vector3(2.2, cloudBase, 0.8)],
      0x9cc5d3,
      0.018,
    );
    for (let i = 0; i < 7; i++)
      box(g, [0.25, 0.025, 0.04], [-3 + i * 0.8, cloudBase, 1], 0xe5e8ce);
  }
  if (result.cloud) {
    const scale = 0.7 + Math.min(1, result.cloudDepthM / 1200);
    for (let i = 0; i < 30; i++) {
      const angle = i * 2.399,
        radius = 0.18 + ((i * 7) % 11) / 11;
      const x = -1 + Math.cos(angle) * radius * 1.75 * scale,
        z = Math.sin(angle) * radius * 0.85 * scale;
      const y = cloudBase + 0.35 + Math.max(0, 1 - radius) * 0.9 * scale;
      const puff = mesh(
        g,
        new T.SphereGeometry(0.48 + (i % 4) * 0.12, 20, 14),
        i % 4 === 0 ? 0xc4d1d0 : 0xf1f0df,
        [x, y, z],
        0.93,
      );
      puff.scale.set(1.25, 0.85, 1);
      puff.userData.select = 0;
    }
    if (result.rain)
      for (let i = 0; i < 65; i++) {
        const x = -3 + ((i * 1.19) % 4),
          z = -0.8 + ((i * 0.77) % 1.8),
          y = 0.6 + ((i * 0.47) % Math.max(0.4, cloudBase - 0.6));
        const drop = mesh(
          g,
          new T.CylinderGeometry(0.014, 0.025, 0.16, 5),
          0x83c9e9,
          [x, y, z],
          0.85,
        );
        drop.rotation.z = -0.12;
      }
  }
  for (let i = 0; i < 18; i++) {
    const x = -1 + Math.cos(i * 2.39) * 0.32,
      z = Math.sin(i * 2.39) * 0.32;
    mesh(
      g,
      new T.SphereGeometry(0.028, 8, 6),
      0xf6ce91,
      [x, parcelY + ((i % 5) - 2) * 0.12, z],
      0.85,
    );
  }
  const labels: ExpansionLabel[] = [
    { text: "Water vapor enters air", at: [-4.2, 1.5, -1.2] },
    {
      text: `Lifted parcel: ${Math.round(result.parcelTemperatureC)} °C`,
      at: [-1, parcelY + 0.8, 0.1],
    },
    {
      text:
        result.condensationHeightM > 3000
          ? "Condensation level above this view"
          : `Condensation level ≈ ${Math.round(result.condensationHeightM)} m`,
      at: [2.3, Math.min(cloudBase, 5.7), 1],
    },
    {
      text: result.rain
        ? "Large drops fall as rain"
        : result.cloud
          ? "Cloud droplets; no rain"
          : "Water vapor is invisible",
      at: [-1, 0.3, 3.4],
    },
  ];
  return { group: g, labels };
}
export function createCloudRainScene(state: CloudState = initialCloud) {
  return earthScene(state, build, {
    position: [11, 9, 18],
    target: [0, 2.4, 0],
    width: 15,
    height: 10,
  });
}
