import { photosynthesisActivity } from "@family-manager/family-api/discovery-models/photosynthesis";
import { orbitActivity } from "@family-manager/family-api/discovery-models/orbit";
import { SOLAR_PLANETS } from "@family-manager/family-api/discovery-models/solar";

/** Small deterministic native models. Scenes are schematic, not engineering tools. */
export function dropTime(height: number, gravity: number) {
  return Math.sqrt((2 * height) / gravity);
}
export function refractedAngle(angle: number, n1: number, n2: number) {
  const sine = (n1 / n2) * Math.sin((angle * Math.PI) / 180);
  return sine > 1 ? null : (Math.asin(sine) * 180) / Math.PI;
}
export function illumination(angle: number) {
  return (1 - Math.cos((angle * Math.PI) / 180)) / 2;
}
export function productionRate(light: number, water: number, carbon = 100) {
  return photosynthesisActivity({
    light,
    water,
    carbonDioxide: carbon,
  }).activityIndex;
}
export type Point = { x: number; y: number };
export function orbitModel(
  speed: number,
  mass = 1,
): { points: Point[]; outcome: string } {
  const result = orbitActivity({ speed, mass });
  return {
    points: result.points,
    outcome:
      result.outcome === "collision"
        ? "Surface collision"
        : result.outcome === "escape"
          ? "Unbound escape path"
          : "Bound orbit",
  };
}
export const planets = SOLAR_PLANETS.map((planet) => ({
  name: planet.name,
  diameterKm: planet.diameterKm,
  au: planet.meanDistanceAu,
  years: planet.orbitalPeriodYears,
  color: planet.color,
}));

export function orbitPath(speed: number): Point[] {
  return orbitModel(speed).points;
}

/** Illuminated horizontal segment of the Moon as seen from Earth. */
export function moonPhaseStrip(angle: number, y: number, radius: number) {
  const halfWidth = Math.sqrt(Math.max(0, radius ** 2 - y ** 2));
  const cosine = Math.cos((angle * Math.PI) / 180);
  const waxing = ((angle % 360) + 360) % 360 <= 180;
  return {
    left: waxing ? cosine * halfWidth : -halfWidth,
    right: waxing ? halfWidth : -cosine * halfWidth,
  };
}
