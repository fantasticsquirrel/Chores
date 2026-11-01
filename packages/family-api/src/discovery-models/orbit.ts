export type OrbitInputs = {
  speed: number;
  mass: number;
};

export type OrbitPoint = { x: number; y: number };
export type OrbitOutcome = "collision" | "orbit" | "escape";

export const ORBIT_SPEED_COMPARISON = [
  { speed: 0.6, mass: 1 },
  { speed: 1, mass: 1 },
  { speed: 1.42, mass: 1 },
] as const satisfies readonly OrbitInputs[];

export const ORBIT_MASS_COMPARISON = [
  { speed: 1, mass: 1 },
  { speed: 1, mass: 2 },
] as const satisfies readonly OrbitInputs[];

const PLANET_RADIUS = 0.22;
const ESCAPE_TRACE_RADIUS = 6;
const STEP_SECONDS = 0.008;
const MAX_STEPS = 2400;

function bound(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

export function normalizeOrbitInputs(inputs: OrbitInputs): OrbitInputs {
  return {
    speed: bound(inputs.speed, 0, 1.8, 1),
    mass: bound(inputs.mass, 0.5, 2, 1),
  };
}

export function orbitGravity(mass: number, radius: number) {
  const safeMass = bound(mass, 0.5, 2, 1);
  const safeRadius = bound(radius, PLANET_RADIUS, ESCAPE_TRACE_RADIUS, 1);
  return safeMass / safeRadius ** 2;
}

/**
 * Direction of travel at a sampled point. At the final sample there is no
 * forward sample, so preserve the incoming tangent instead of returning a
 * zero-length direction.
 */
export function orbitTangentAt(
  points: readonly OrbitPoint[],
  index: number,
): OrbitPoint {
  const safeIndex = Math.max(0, Math.min(points.length - 1, index));
  const point = points[safeIndex];
  if (!point || points.length < 2) return { x: 0, y: 0 };
  if (safeIndex === points.length - 1) {
    const previous = points[safeIndex - 1];
    return { x: point.x - previous.x, y: point.y - previous.y };
  }
  const next = points[safeIndex + 1];
  return { x: next.x - point.x, y: next.y - point.y };
}

/**
 * Dimensionless, fixed-step, two-body classroom model. The starting center
 * distance and the baseline gravitational parameter are both 1. The orbiting
 * body has no influence on the central body.
 */
export function orbitActivity(raw: OrbitInputs) {
  const inputs = normalizeOrbitInputs(raw);
  let x = 1;
  let y = 0;
  let vx = 0;
  let vy = inputs.speed;
  const points: OrbitPoint[] = [{ x, y }];
  let outcome: OrbitOutcome =
    inputs.speed >= Math.sqrt(2 * inputs.mass) ? "escape" : "orbit";

  for (let index = 0; index < MAX_STEPS; index += 1) {
    const radius = Math.hypot(x, y);
    const ax = (-inputs.mass * x) / radius ** 3;
    const ay = (-inputs.mass * y) / radius ** 3;
    x += vx * STEP_SECONDS + (ax * STEP_SECONDS ** 2) / 2;
    y += vy * STEP_SECONDS + (ay * STEP_SECONDS ** 2) / 2;
    const nextRadius = Math.hypot(x, y);
    if (nextRadius <= PLANET_RADIUS) {
      outcome = "collision";
      points.push({ x, y });
      break;
    }
    const nextAx = (-inputs.mass * x) / nextRadius ** 3;
    const nextAy = (-inputs.mass * y) / nextRadius ** 3;
    vx += ((ax + nextAx) * STEP_SECONDS) / 2;
    vy += ((ay + nextAy) * STEP_SECONDS) / 2;
    if (index % 5 === 0) points.push({ x, y });
    if (nextRadius > ESCAPE_TRACE_RADIUS) break;
  }

  const radii = points.map((point) => Math.hypot(point.x, point.y));
  return {
    inputs,
    points,
    outcome,
    closestRadius: Math.min(...radii),
    farthestRadius: Math.max(...radii),
    circularSpeed: Math.sqrt(inputs.mass),
    escapeSpeed: Math.sqrt(2 * inputs.mass),
    planetRadius: PLANET_RADIUS,
  };
}

/** Compatibility helper for existing web callers. */
export function traceOrbit(speed: number, mass = 1) {
  const activity = orbitActivity({ speed, mass });
  return {
    points: activity.points,
    outcome: activity.outcome,
    closestRadius: activity.closestRadius,
    farthestRadius: activity.farthestRadius,
  };
}

export function compareOrbitInputs(first: OrbitInputs, second: OrbitInputs) {
  const a = normalizeOrbitInputs(first);
  const b = normalizeOrbitInputs(second);
  const changed: string[] = [];
  const held: string[] = [];
  for (const [name, equal] of [
    ["launch speed", a.speed === b.speed],
    ["central mass", a.mass === b.mass],
  ] as const) {
    (equal ? held : changed).push(name);
  }
  return { changed, held };
}
