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
  const transformed =
    transform.rotationDegreesClockwise === 0
      ? { x: reflectedX, y: point.y }
      : transform.rotationDegreesClockwise === 90
        ? { x: -point.y, y: reflectedX }
        : transform.rotationDegreesClockwise === 180
          ? { x: -reflectedX, y: -point.y }
          : { x: point.y, y: -reflectedX };
  return {
    x: transformed.x === 0 ? 0 : transformed.x,
    y: transformed.y === 0 ? 0 : transformed.y,
  };
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
  const normalizedStartAngle = ((startAngleDegrees % 360) + 360) % 360;
  const vertices: PatternPoint[] = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;
  for (let index = 0; index < sides - 1; index += 1) {
    const heading =
      ((normalizedStartAngle + (index * 360) / sides) * Math.PI) / 180;
    x += sideLength * Math.cos(heading);
    y += sideLength * Math.sin(heading);
    vertices.push({ x, y });
  }
  return vertices;
}
