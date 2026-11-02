import { describe, expect, it } from "vitest";
import {
  PATTERN_MARKER,
  patternMarkerComparison,
  patternVertexFit,
  regularPolygonVertices,
  rigidTransformPoint,
} from "./patterns";

const quarterTurns = [0, 90, 180, 270] as const;
const reflections = [false, true] as const;
const finitePoints = [
  { x: 13.25, y: -91.5 },
  { x: 1e-9, y: -Number.MIN_VALUE },
  { x: Number.MAX_VALUE, y: -Number.MAX_VALUE / 2 },
] as const;

const exactQuarterTurn = (
  point: (typeof finitePoints)[number],
  rotationDegreesClockwise: (typeof quarterTurns)[number],
  reflectAcrossVertical: boolean,
) => {
  const x = reflectAcrossVertical ? -point.x : point.x;
  const y = point.y;
  const transformed =
    rotationDegreesClockwise === 0
      ? { x, y }
      : rotationDegreesClockwise === 90
        ? { x: -y, y: x }
        : rotationDegreesClockwise === 180
          ? { x: -x, y: -y }
          : { x: y, y: -x };
  return {
    x: transformed.x === 0 ? 0 : transformed.x,
    y: transformed.y === 0 ? 0 : transformed.y,
  };
};

describe("pattern geometry model", () => {
  it("rejects invalid and out-of-bound polygon inputs", () => {
    for (const [sides, copies] of [
      [2, 3],
      [13, 3],
      [4.5, 4],
      [4, 0],
      [4, 13],
      [Number.NaN, 4],
    ])
      expect(patternVertexFit(sides, copies)).toBeNull();
    for (const [sides, sideLength, startAngle] of [
      [2, 80, 0],
      [13, 80, 0],
      [4.5, 80, 0],
      [4, 0, 0],
      [4, -1, 0],
      [4, 1_000.001, 0],
      [4, Number.NaN, 0],
      [4, Number.POSITIVE_INFINITY, 0],
      [4, 80, Number.NaN],
      [4, 80, Number.NEGATIVE_INFINITY],
      [4, 80, Number.POSITIVE_INFINITY],
    ])
      expect(regularPolygonVertices(sides, sideLength, startAngle)).toBeNull();

    for (const sideLength of [Number.MIN_VALUE, 1_000]) {
      const vertices = regularPolygonVertices(12, sideLength, 0);
      expect(vertices).toHaveLength(12);
      expect(
        vertices!.every(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
        ),
      ).toBe(true);
    }
  });

  it("computes exact regular-polygon corner fits and boundaries", () => {
    expect(patternVertexFit(3, 6)).toEqual({
      sides: 3,
      copies: 6,
      interiorAngle: 60,
      occupiedAngle: 360,
      gapAngle: 0,
      overlapAngle: 0,
      relation: "exact",
    });
    expect(patternVertexFit(5, 3)).toMatchObject({
      interiorAngle: 108,
      occupiedAngle: 324,
      gapAngle: 36,
      overlapAngle: 0,
      relation: "gap",
    });
    expect(patternVertexFit(5, 4)).toMatchObject({
      occupiedAngle: 432,
      gapAngle: 0,
      overlapAngle: 72,
      relation: "overlap",
    });
    expect(patternVertexFit(12, 12)).toMatchObject({
      interiorAngle: 150,
      occupiedAngle: 1800,
      overlapAngle: 1440,
    });
  });

  it("places each regular polygon at the claimed interior wedge", () => {
    for (const sides of [3, 4, 5, 6, 8, 12]) {
      const vertices = regularPolygonVertices(sides, 80, -90);
      expect(vertices).not.toBeNull();
      expect(vertices).toHaveLength(sides);
      const first = vertices![1];
      const last = vertices!.at(-1)!;
      const start = (Math.atan2(first.y, first.x) * 180) / Math.PI;
      const end = (Math.atan2(last.y, last.x) * 180) / Math.PI;
      expect(start).toBeCloseTo(-90, 8);
      expect(end - start).toBeCloseTo(
        patternVertexFit(sides, 1)!.interiorAngle,
        8,
      );
    }

    for (const startAngle of [
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
      Number.MAX_SAFE_INTEGER,
      -Number.MAX_SAFE_INTEGER,
    ]) {
      const normalizedAngle = ((startAngle % 360) + 360) % 360;
      const vertices = regularPolygonVertices(12, 1_000, startAngle);
      expect(vertices).toEqual(
        regularPolygonVertices(12, 1_000, normalizedAngle),
      );
      expect(
        vertices!.every(
          (point) => Number.isFinite(point.x) && Number.isFinite(point.y),
        ),
      ).toBe(true);
    }
  });

  it("distinguishes a clockwise quarter-turn from a vertical reflection", () => {
    expect(PATTERN_MARKER).toEqual({ x: -30, y: -18 });
    expect(patternMarkerComparison()).toEqual({
      original: { x: -30, y: -18 },
      quarterTurnClockwise: { x: 18, y: -30 },
      reflected: { x: 30, y: -18 },
    });
    expect(
      rigidTransformPoint(PATTERN_MARKER, {
        rotationDegreesClockwise: 90,
        reflectAcrossVertical: false,
      }),
    ).toEqual({ x: 18, y: -30 });
    expect(
      rigidTransformPoint(PATTERN_MARKER, {
        rotationDegreesClockwise: 0,
        reflectAcrossVertical: true,
      }),
    ).toEqual({ x: 30, y: -18 });
    expect(
      rigidTransformPoint(PATTERN_MARKER, {
        rotationDegreesClockwise: 45.5,
        reflectAcrossVertical: false,
      }),
    ).toBeNull();
    for (const point of [
      { x: Number.NaN, y: 0 },
      { x: 0, y: Number.NaN },
      { x: Number.POSITIVE_INFINITY, y: 0 },
      { x: 0, y: Number.NEGATIVE_INFINITY },
    ])
      expect(
        rigidTransformPoint(point, {
          rotationDegreesClockwise: 0,
          reflectAcrossVertical: false,
        }),
      ).toBeNull();
    for (const rotationDegreesClockwise of [
      -90,
      45,
      90.5,
      360,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])
      expect(
        rigidTransformPoint(
          { x: 1, y: 2 },
          {
            rotationDegreesClockwise,
            reflectAcrossVertical: false,
          },
        ),
      ).toBeNull();
    expect(
      rigidTransformPoint(
        { x: 1, y: 2 },
        {
          rotationDegreesClockwise: 0,
          reflectAcrossVertical: 1 as unknown as boolean,
        },
      ),
    ).toBeNull();
  });

  it("preserves lengths and angles while reflection reverses orientation", () => {
    const motif = [
      { x: -30, y: -18 },
      { x: 26, y: -12 },
      { x: 8, y: 31 },
    ];
    const distance = (a: (typeof motif)[number], b: (typeof motif)[number]) =>
      Math.hypot(b.x - a.x, b.y - a.y);
    const signedArea = (points: typeof motif) =>
      points.reduce(
        (sum, point, index) =>
          sum +
          point.x * points[(index + 1) % points.length].y -
          point.y * points[(index + 1) % points.length].x,
        0,
      ) / 2;
    const turn = motif.map(
      (point) =>
        rigidTransformPoint(point, {
          rotationDegreesClockwise: 90,
          reflectAcrossVertical: false,
        })!,
    );
    const reflection = motif.map(
      (point) =>
        rigidTransformPoint(point, {
          rotationDegreesClockwise: 0,
          reflectAcrossVertical: true,
        })!,
    );
    for (const transformed of [turn, reflection])
      for (let index = 0; index < motif.length; index += 1)
        expect(
          distance(
            transformed[index],
            transformed[(index + 1) % transformed.length],
          ),
        ).toBeCloseTo(
          distance(motif[index], motif[(index + 1) % motif.length]),
          8,
        );
    expect(Math.sign(signedArea(turn))).toBe(Math.sign(signedArea(motif)));
    expect(Math.sign(signedArea(reflection))).toBe(
      -Math.sign(signedArea(motif)),
    );

    const transforms = quarterTurns.flatMap((rotationDegreesClockwise) =>
      reflections.map((reflectAcrossVertical) => ({
        rotationDegreesClockwise,
        reflectAcrossVertical,
      })),
    );
    const coordinateMagnitudes = (point: { x: number; y: number }) =>
      [Math.abs(point.x), Math.abs(point.y)].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0,
      );

    for (const point of finitePoints) {
      for (const transform of transforms) {
        const transformed = rigidTransformPoint(point, transform)!;
        expect(transformed).toEqual(
          exactQuarterTurn(
            point,
            transform.rotationDegreesClockwise,
            transform.reflectAcrossVertical,
          ),
        );
        expect(Number.isFinite(transformed.x)).toBe(true);
        expect(Number.isFinite(transformed.y)).toBe(true);
        expect(Object.is(transformed.x, -0)).toBe(false);
        expect(Object.is(transformed.y, -0)).toBe(false);
        expect(coordinateMagnitudes(transformed)).toEqual(
          coordinateMagnitudes(point),
        );

        const inverse = transform.reflectAcrossVertical
          ? transform
          : {
              rotationDegreesClockwise: ((360 -
                transform.rotationDegreesClockwise) %
                360) as (typeof quarterTurns)[number],
              reflectAcrossVertical: false,
            };
        expect(rigidTransformPoint(transformed, inverse)).toEqual(point);
      }

      for (const first of transforms) {
        for (const second of transforms) {
          const sequential = rigidTransformPoint(
            rigidTransformPoint(point, first)!,
            second,
          );
          const composedRotation = ((second.rotationDegreesClockwise +
            (second.reflectAcrossVertical
              ? -first.rotationDegreesClockwise
              : first.rotationDegreesClockwise) +
            360) %
            360) as (typeof quarterTurns)[number];
          expect(sequential).toEqual(
            rigidTransformPoint(point, {
              rotationDegreesClockwise: composedRotation,
              reflectAcrossVertical:
                first.reflectAcrossVertical !== second.reflectAcrossVertical,
            }),
          );
        }
      }
    }
  });
});
