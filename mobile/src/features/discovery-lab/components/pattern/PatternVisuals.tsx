import {
  patternVertexFit,
  regularPolygonVertices,
  rigidTransformPoint,
  PATTERN_MARKER,
} from "@family-manager/family-api/discovery-models/patterns";
import { Dot, Line } from "../Primitives";
import { Diagram, DiagramLabel } from "../LearningPrimitives";

export function PatternTileDiagram({
  sides,
  copies,
}: {
  sides: number;
  copies: number;
}) {
  const fit = patternVertexFit(sides, copies)!;
  return (
    <Diagram
      visualState={{
        kind: "pattern",
        sides,
        copies,
        rotation: 0,
        reflected: false,
        view: "tiles",
      }}
      label={`${copies} regular ${sides}-sided tiles at one point. Each corner is ${fit.interiorAngle} degrees; the total is ${fit.occupiedAngle} degrees, leaving ${fit.gapAngle} degrees of gap and ${fit.overlapAngle} degrees of overlap.`}
    >
      {(width) => (
        <>
          {Array.from({ length: copies }, (_, tile) => {
            const points = regularPolygonVertices(
              sides,
              42,
              tile * fit.interiorAngle - 90,
            )!;
            return points.map((point, index) => (
              <Line
                key={`${tile}-${index}`}
                x={width / 2 + point.x}
                y={140 + point.y}
                x2={width / 2 + points[(index + 1) % points.length].x}
                y2={140 + points[(index + 1) % points.length].y}
                color={["#91ede4", "#ffe49b", "#d4b5ff"][tile % 3]}
              />
            ));
          })}
          <Dot x={width / 2} y={140} size={8} color="#fff9ef" />
          <DiagramLabel x={15} y={12}>
            Shared corner · full turn 360°
          </DiagramLabel>
        </>
      )}
    </Diagram>
  );
}

export function PatternMotifDiagram({
  rotation,
  reflected,
  label,
}: {
  rotation: 0 | 90 | 180 | 270;
  reflected: boolean;
  label: string;
}) {
  const vertices = [
    { x: -24, y: -24 },
    { x: 24, y: -24 },
    { x: 24, y: 18 },
    { x: 5, y: 7 },
  ].map(
    (point) =>
      rigidTransformPoint(point, {
        rotationDegreesClockwise: rotation,
        reflectAcrossVertical: reflected,
      })!,
  );
  const marker = rigidTransformPoint(PATTERN_MARKER, {
    rotationDegreesClockwise: rotation,
    reflectAcrossVertical: reflected,
  })!;
  return (
    <Diagram
      visualState={{
        kind: "pattern",
        sides: 5,
        copies: 3,
        rotation,
        reflected,
        view: "motif",
      }}
      height={170}
      label={`${label}. Point M is ${Math.abs(marker.x)} units ${marker.x < 0 ? "left" : "right"} and ${Math.abs(marker.y)} units ${marker.y < 0 ? "up" : "down"} from center.`}
    >
      {(width) => (
        <>
          <Line x={width / 2} y={20} x2={width / 2} y2={150} color="#788bad" />
          {vertices.map((point, index) => (
            <Line
              key={index}
              x={width / 2 + point.x * 1.8}
              y={85 + point.y * 1.8}
              x2={width / 2 + vertices[(index + 1) % vertices.length].x * 1.8}
              y2={85 + vertices[(index + 1) % vertices.length].y * 1.8}
              color="#ffe49b"
            />
          ))}
          <Dot
            x={width / 2 + marker.x * 1.8}
            y={85 + marker.y * 1.8}
            size={10}
            color="#f38768"
          />
          <DiagramLabel
            x={width / 2 + marker.x * 1.8 - 4}
            y={85 + marker.y * 1.8 - 8}
          >
            M
          </DiagramLabel>
          <DiagramLabel x={14} y={12}>
            {label}
          </DiagramLabel>
        </>
      )}
    </Diagram>
  );
}
