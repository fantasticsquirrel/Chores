import { photosynthesisActivity } from "@family-manager/family-api/discovery-models/photosynthesis";
import { orbitActivity } from "@family-manager/family-api/discovery-models/orbit";

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
export const planets = [
  {
    name: "Mercury",
    diameterKm: 4879,
    au: 0.387,
    years: 0.241,
    color: "#c9b7a2",
  },
  {
    name: "Venus",
    diameterKm: 12104,
    au: 0.723,
    years: 0.615,
    color: "#f1be7b",
  },
  { name: "Earth", diameterKm: 12756, au: 1, years: 1, color: "#63d8f2" },
  { name: "Mars", diameterKm: 6792, au: 1.524, years: 1.881, color: "#ef8b70" },
  {
    name: "Jupiter",
    diameterKm: 142984,
    au: 5.203,
    years: 11.86,
    color: "#e8bd96",
  },
  {
    name: "Saturn",
    diameterKm: 120536,
    au: 9.537,
    years: 29.45,
    color: "#e9dba1",
  },
  {
    name: "Uranus",
    diameterKm: 51118,
    au: 19.19,
    years: 84.02,
    color: "#9ce9e5",
  },
  {
    name: "Neptune",
    diameterKm: 49528,
    au: 30.07,
    years: 164.8,
    color: "#748df7",
  },
];

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
