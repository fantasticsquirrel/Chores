import { gravityDrop, type Point } from "./physics";
/** Rounded planetary data; see assets/SOURCES.md. Orbit radii in the exhibit are schematic. */
export const PLANETS = [
  {
    name: "Mercury",
    distance: 0.39,
    year: 0.24,
    diameter: 4879,
    color: "#b9afac",
    kind: "Rocky planet",
  },
  {
    name: "Venus",
    distance: 0.72,
    year: 0.62,
    diameter: 12104,
    color: "#e8ba7c",
    kind: "Rocky planet",
  },
  {
    name: "Earth",
    distance: 1,
    year: 1,
    diameter: 12756,
    color: "#73b9e8",
    kind: "Rocky planet",
  },
  {
    name: "Mars",
    distance: 1.52,
    year: 1.88,
    diameter: 6792,
    color: "#e18d73",
    kind: "Rocky planet",
  },
  {
    name: "Jupiter",
    distance: 5.2,
    year: 11.86,
    diameter: 142984,
    color: "#dcb695",
    kind: "Gas giant",
  },
  {
    name: "Saturn",
    distance: 9.58,
    year: 29.46,
    diameter: 120536,
    color: "#e4d4a0",
    kind: "Gas giant",
  },
  {
    name: "Uranus",
    distance: 19.2,
    year: 84,
    diameter: 51118,
    color: "#8cdbde",
    kind: "Ice giant",
  },
  {
    name: "Neptune",
    distance: 30.1,
    year: 165,
    diameter: 49528,
    color: "#7299f2",
    kind: "Ice giant",
  },
] as const;
export const WORLDS = [
  { name: "Earth", g: 9.81 },
  { name: "Moon", g: 1.62 },
  { name: "Mars", g: 3.71 },
  { name: "Jupiter", g: 24.79 },
] as const;
export function planetAngle(index: number, earthYears: number) {
  return (earthYears / PLANETS[index].year) * Math.PI * 2 + index * 0.8;
}
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
