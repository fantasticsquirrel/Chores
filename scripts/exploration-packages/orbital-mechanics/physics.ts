export type Point = { x: number; y: number };
/** Dimensionless two-body model: starting radius and gravitational parameter are 1. */
export function traceOrbit(speed: number, mass = 1) {
  let x = 1,
    y = 0,
    vx = 0,
    vy = speed;
  const points: Point[] = [{ x, y }];
  const dt = 0.008;
  let outcome: "orbit" | "collision" | "escape" =
    speed >= Math.sqrt(2 * mass) ? "escape" : "orbit";
  for (let i = 0; i < 2400; i++) {
    const r = Math.hypot(x, y),
      ax = (-mass * x) / r ** 3,
      ay = (-mass * y) / r ** 3;
    x += vx * dt + (ax * dt * dt) / 2;
    y += vy * dt + (ay * dt * dt) / 2;
    const nextR = Math.hypot(x, y);
    if (nextR <= 0.22) {
      outcome = "collision";
      points.push({ x, y });
      break;
    }
    vx += ((ax - (mass * x) / nextR ** 3) * dt) / 2;
    vy += ((ay - (mass * y) / nextR ** 3) * dt) / 2;
    if (i % 5 === 0) points.push({ x, y });
    if (nextR > 6) break;
  }
  return { points, outcome };
}
export function refract(degrees: number, n1: number, n2: number) {
  const sine = (n1 / n2) * Math.sin((degrees * Math.PI) / 180);
  return {
    tir: sine > 1,
    angle: sine > 1 ? null : (Math.asin(Math.min(1, sine)) * 180) / Math.PI,
  };
}
export function gravityDrop(height: number, g: number) {
  return {
    time: Math.sqrt((2 * height) / g),
    speed: Math.sqrt(2 * height * g),
  };
}
export function illuminatedFraction(angle: number) {
  return (1 - Math.cos((angle * Math.PI) / 180)) / 2;
}
export function photosynthesis(light: number, water: number, carbon: number) {
  const resources = [
    { name: "light", value: light },
    { name: "water", value: water },
    { name: "carbon dioxide", value: carbon },
  ];
  const limiting = resources.reduce((a, b) => (a.value <= b.value ? a : b));
  return {
    rate: (100 * limiting.value) / (limiting.value + 25),
    limiting: limiting.name,
  };
}
