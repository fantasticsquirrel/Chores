import { describe, expect, it } from "vitest";
import {
  PATTERN_MARKER,
  patternMarkerComparison,
  patternVertexFit,
  regularPolygonVertices,
  rigidTransformPoint,
} from "./patterns";

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
    expect(regularPolygonVertices(4, 0, 0)).toBeNull();
    expect(regularPolygonVertices(4, Number.POSITIVE_INFINITY, 0)).toBeNull();
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
  });
});
