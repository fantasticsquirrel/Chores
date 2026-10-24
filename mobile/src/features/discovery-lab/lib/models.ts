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
export function productionRate(light: number, water: number) {
  return Math.min(light / (light + 25), water / (water + 25)) * 100;
}
export type Point = { x: number; y: number };
export function orbitModel(
  speed: number,
  mass = 1,
): { points: Point[]; outcome: string } {
  let x = 1,
    y = 0,
    vx = 0,
    vy = speed;
  const dt = 0.008,
    points: Point[] = [];
  for (let i = 0; i < 2400; i++) {
    const r = Math.hypot(x, y);
    if (r < 0.18 || r > 5) break;
    const ax = (-mass * x) / r ** 3,
      ay = (-mass * y) / r ** 3;
    x += vx * dt + (ax * dt * dt) / 2;
    y += vy * dt + (ay * dt * dt) / 2;
    const next = Math.max(0.1, Math.hypot(x, y));
    vx += ((ax - (mass * x) / next ** 3) * dt) / 2;
    vy += ((ay - (mass * y) / next ** 3) * dt) / 2;
    if (i % 6 === 0) points.push({ x, y });
  }
  return {
    points,
    outcome:
      Math.hypot(x, y) < 0.18
        ? "Surface collision"
        : speed >= Math.sqrt(2 * mass)
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
