import { gravityDrop, type Point } from "../physics";
import {
  SOLAR_PLANETS,
  planetAngle,
} from "@family-manager/family-api/discovery-models/solar";

/** Compatibility shape for the existing renderer; values come from the shared model. */
export const PLANETS = SOLAR_PLANETS.map((planet) => ({
  name: planet.name,
  distance: planet.meanDistanceAu,
  year: planet.orbitalPeriodYears,
  diameter: planet.diameterKm,
  color: planet.color,
  kind: planet.kind,
}));
export const WORLDS = [
  { name: "Earth", g: 9.81 },
  { name: "Moon", g: 1.62 },
  { name: "Mars", g: 3.71 },
  { name: "Jupiter", g: 24.79 },
] as const;
export { planetAngle };
export function fallAtTime(height: number, g: number, elapsed: number) {
  const time = Math.max(0, elapsed);
  const landed = time >= gravityDrop(height, g).time;
  return {
    distance: Math.min(height, 0.5 * g * time ** 2),
    speed: landed ? 0 : g * time,
    landed,
  };
}
export function trajectoryView(points: Point[]) {
  const xs = [0, ...points.map((p) => p.x)],
    ys = [0, ...points.map((p) => p.y)];
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    extent: Math.max(1.3, (maxX - minX) * 0.62, (maxY - minY) * 0.62),
  };
}
