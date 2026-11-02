export type PatternPoint = Readonly<{ x: number; y: number }>;

export type PatternVertexFit = Readonly<{
  sides: number;
  copies: number;
  interiorAngle: number;
  occupiedAngle: number;
  gapAngle: number;
  overlapAngle: number;
  relation: "gap" | "exact" | "overlap";
}>;

export type PatternRigidTransform = Readonly<{
  rotationDegreesClockwise: number;
  reflectAcrossVertical: boolean;
}>;

const MAX_POLYGON_SIDES = 12;
const MAX_VERTEX_COPIES = 12;
const MAX_SIDE_LENGTH = 1_000;

const boundedInteger = (value: number, minimum: number, maximum: number) =>
  Number.isSafeInteger(value) && value >= minimum && value <= maximum;

export const PATTERN_MARKER: PatternPoint = Object.freeze({ x: -30, y: -18 });

export function patternVertexFit(
  sides: number,
  copies: number,
): PatternVertexFit | null {
  if (
    !boundedInteger(sides, 3, MAX_POLYGON_SIDES) ||
    !boundedInteger(copies, 1, MAX_VERTEX_COPIES)
  )
    return null;
  const interiorAngle = (180 * (sides - 2)) / sides;
  const occupiedAngle = interiorAngle * copies;
  const gapAngle = Math.max(0, 360 - occupiedAngle);
  const overlapAngle = Math.max(0, occupiedAngle - 360);
  return {
    sides,
    copies,
    interiorAngle,
    occupiedAngle,
    gapAngle,
    overlapAngle,
    relation: gapAngle > 0 ? "gap" : overlapAngle > 0 ? "overlap" : "exact",
  };
}

export function rigidTransformPoint(
  point: PatternPoint,
  transform: PatternRigidTransform,
): PatternPoint | null {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    !boundedInteger(transform.rotationDegreesClockwise, 0, 359) ||
    transform.rotationDegreesClockwise % 90 !== 0 ||
    typeof transform.reflectAcrossVertical !== "boolean"
  )
    return null;
  const reflectedX = transform.reflectAcrossVertical ? -point.x : point.x;
  const angle = (transform.rotationDegreesClockwise * Math.PI) / 180;
  const x = reflectedX * Math.cos(angle) - point.y * Math.sin(angle);
  const y = reflectedX * Math.sin(angle) + point.y * Math.cos(angle);
  const normalize = (value: number) => {
    const rounded = Math.round(value * 1_000_000) / 1_000_000;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  return { x: normalize(x), y: normalize(y) };
}

export function patternMarkerComparison() {
  return {
    original: PATTERN_MARKER,
    quarterTurnClockwise: rigidTransformPoint(PATTERN_MARKER, {
      rotationDegreesClockwise: 90,
      reflectAcrossVertical: false,
    })!,
    reflected: rigidTransformPoint(PATTERN_MARKER, {
      rotationDegreesClockwise: 0,
      reflectAcrossVertical: true,
    })!,
  } as const;
}

/**
 * Builds a regular polygon from a shared vertex at (0, 0). The first edge
 * follows startAngleDegrees; the final adjacent edge is one interior angle
 * counterclockwise from it in mathematical coordinates.
 */
export function regularPolygonVertices(
  sides: number,
  sideLength: number,
  startAngleDegrees = 0,
): PatternPoint[] | null {
  if (
    !boundedInteger(sides, 3, MAX_POLYGON_SIDES) ||
    !Number.isFinite(sideLength) ||
    sideLength <= 0 ||
    sideLength > MAX_SIDE_LENGTH ||
    !Number.isFinite(startAngleDegrees)
  )
    return null;
  const vertices: PatternPoint[] = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;
  for (let index = 0; index < sides - 1; index += 1) {
    const heading =
      ((startAngleDegrees + (index * 360) / sides) * Math.PI) / 180;
    x += sideLength * Math.cos(heading);
    y += sideLength * Math.sin(heading);
    vertices.push({ x, y });
  }
  return vertices;
}
