import type { OfflineSceneState } from "@family-manager/discovery-scenes/protocol";
import { orbitModel, planets, productionRate } from "../lib/models";

/** Educational calculations stay in native models; only their visual state is sent. */
export function nativeSceneState(
  id: string,
  value: number,
  second: number,
  third: number,
  fourth: number,
): OfflineSceneState | null {
  switch (id) {
    case "reflection-refraction":
      return { kind: "optics", angle: value, reverse: Boolean(second) };
    case "moon-phases":
      return { kind: "moon", angle: value };
    case "orbital-mechanics":
      return {
        kind: "orbit",
        points: orbitModel(value, third).points,
        progress: 0,
      };
    case "solar-system":
      return {
        kind: "solar",
        selected: value,
        earthYears: second / 12,
        mode: third === 2 ? "sizes" : "orbits",
        angles: planets.map(
          (planet) => (second / 12 / planet.years) * Math.PI * 2,
        ),
      };
    case "gravity": {
      const elapsed = second / 10;
      const fallen = Math.min(20, 0.5 * value * elapsed * elapsed);
      return {
        kind: "gravity",
        height: 20,
        gravity: value,
        elapsed,
        mass: fourth,
        referenceGravity: value,
        referenceMass: third,
        distances: [fallen, fallen],
      };
    }
    case "photosynthesis":
      return {
        kind: "leaf",
        light: value,
        water: second,
        carbon: 100,
        rate: productionRate(value, second),
      };
    case "castle-defenses":
      return {
        kind: "castle",
        moat: second ? 22 : 0,
        towers: true,
        gate: Boolean(third),
        inner: false,
        approach: "bridge",
        sight: Boolean(fourth),
        wallHeightMeters: value * 3,
      };
    default:
      return null;
  }
}
