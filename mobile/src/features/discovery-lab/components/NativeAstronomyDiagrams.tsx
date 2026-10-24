import { View } from "react-native";
import { Dot, Line } from "./Primitives";
import { DiagramLabel } from "./LearningPrimitives";
import { moonPhaseStrip, planets } from "../lib/models";

/** Earth-view illuminated disk, sampled in narrow horizontal strips. */
export function MoonDisk({
  angle,
  x,
  y,
  radius = 24,
}: {
  angle: number;
  x: number;
  y: number;
  radius?: number;
}) {
  const rows = 40;
  return (
    <>
      <Dot x={x} y={y} size={radius * 2} color="#344565" />
      {Array.from({ length: rows }, (_, i) => {
        const localY = -radius + ((i + 0.5) * radius * 2) / rows;
        const { left, right } = moonPhaseStrip(angle, localY, radius);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: x + left,
              top: y + localY - radius / rows,
              width: Math.max(0, right - left),
              height: (radius * 2) / rows + 0.2,
              backgroundColor: "#e8edf8",
            }}
          />
        );
      })}
    </>
  );
}

export function PlanetDiameterComparison({
  index,
  width,
}: {
  index: number;
  width: number;
}) {
  const planet = planets[index];
  const earth = planets[2];
  const maxDiameter = Math.max(earth.diameterKm, planet.diameterKm);
  const scale = Math.min(110, (width - 50) / 2) / maxDiameter;
  return (
    <>
      <DiagramLabel x={15} y={15}>
        Equatorial diameters on one scale
      </DiagramLabel>
      <Dot
        x={width * 0.27}
        y={115}
        size={earth.diameterKm * scale}
        color={earth.color}
      />
      <Dot
        x={width * 0.73}
        y={115}
        size={planet.diameterKm * scale}
        color={planet.color}
      />
      <DiagramLabel x={width * 0.27 - 20} y={180}>
        Earth
      </DiagramLabel>
      <DiagramLabel x={width * 0.73 - 25} y={180}>
        {planet.name}
      </DiagramLabel>
      <Line x={20} y={212} x2={width - 20} y2={212} color="#67749a" />
    </>
  );
}
