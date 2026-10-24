import { useState } from "react";
import {
  regularTile,
  transformPoint,
  vertexFit,
} from "@family-manager/family-api/discovery-models/math-life";
import { ActionButton } from "../../../components/ActionButton";
import { Control, Dot, Line } from "./Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";

export function PatternExploration() {
  const [shape, setShape] = useState("4");
  const [copies, setCopies] = useState(4);
  const [rotation, setRotation] = useState(0);
  const [reflected, setReflected] = useState(false);
  const sides = Number(shape),
    fit = vertexFit(sides, copies);
  const motif = [
    { x: -20, y: -20 },
    { x: 20, y: -20 },
    { x: 20, y: 15 },
    { x: 5, y: 5 },
  ].map((point) => transformPoint(point.x, point.y, rotation, reflected));
  return (
    <LearningFrame
      onReset={() => {
        setShape("4");
        setCopies(4);
        setRotation(0);
        setReflected(false);
      }}
    >
      <Diagram
        visualState={{
          kind: "pattern",
          sides,
          copies,
          rotation,
          reflected,
          view: "tiles",
        }}
        label={`${copies} regular ${sides}-sided tiles at one vertex. ${fit.gap.toFixed(0)} degrees gap and ${fit.overlap.toFixed(0)} degrees overlap.`}
      >
        {(width) => (
          <>
            {Array.from({ length: copies }, (_, tile) => {
              const points = regularTile(sides, 42, tile * fit.angle);
              return points.map((point, i) => (
                <Line
                  key={`${tile}-${i}`}
                  x={width / 2 + point.x}
                  y={120 + point.y}
                  x2={width / 2 + points[(i + 1) % points.length].x}
                  y2={120 + points[(i + 1) % points.length].y}
                  color={["#91ede4", "#ffe49b", "#d4b5ff"][tile % 3]}
                />
              ));
            })}
            <Dot x={width / 2} y={120} size={8} color="#fff9ef" />
            <DiagramLabel x={15} y={12}>
              Tiles meet at the white vertex
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        Each interior angle is {fit.angle.toFixed(0)}°. {copies} ×{" "}
        {fit.angle.toFixed(0)}° = {(copies * fit.angle).toFixed(0)}°.{" "}
        {fit.gap > 0
          ? `A ${fit.gap.toFixed(0)}° gap remains.`
          : fit.overlap > 0
            ? `The tiles overlap by ${fit.overlap.toFixed(0)}°.`
            : "The angles fill 360° exactly, with no gap or overlap."}
      </Explanation>
      <Choice
        label="Regular tile"
        value={shape}
        onChange={setShape}
        options={[
          { value: "3", label: "Triangle" },
          { value: "4", label: "Square" },
          { value: "5", label: "Pentagon" },
          { value: "6", label: "Hexagon" },
        ]}
      />
      <Control
        label="Tiles around a vertex"
        value={copies}
        min={1}
        max={8}
        onChange={setCopies}
      />
      <Diagram
        visualState={{
          kind: "pattern",
          sides,
          copies,
          rotation,
          reflected,
          view: "motif",
        }}
        height={150}
        label={`Asymmetric motif, rotated ${rotation} degrees, ${reflected ? "reflected across its vertical axis before rotation" : "not reflected"}.`}
      >
        {(width) => (
          <>
            <Line
              x={width / 2}
              y={20}
              x2={width / 2}
              y2={130}
              color="#788bad"
            />
            {motif.map((point, i) => (
              <Line
                key={i}
                x={width / 2 + point.x * 1.8}
                y={75 + point.y * 1.8}
                x2={width / 2 + motif[(i + 1) % motif.length].x * 1.8}
                y2={75 + motif[(i + 1) % motif.length].y * 1.8}
                color="#ffe49b"
              />
            ))}
            <Dot
              x={width / 2 + motif[0].x * 1.8}
              y={75 + motif[0].y * 1.8}
              size={9}
              color="#c5b4ff"
            />
          </>
        )}
      </Diagram>
      <Explanation>
        Motif rotation: {rotation}°. Reflection: {reflected ? "on" : "off"}. The
        marked dot helps track orientation. Both transformations preserve side
        lengths and angles.
      </Explanation>
      <ActionButton
        label="Rotate a quarter turn"
        onPress={() => setRotation((rotation + 90) % 360)}
      />
      <ActionButton
        label={reflected ? "Remove reflection" : "Reflect motif"}
        variant="secondary"
        onPress={() => setReflected(!reflected)}
      />
      <ModelNote>
        The vertex test checks whether copies of one regular polygon fit
        locally. It is not a proof that any arbitrary collection tiles the whole
        plane. Reflection happens before rotation in this diagram.
      </ModelNote>
    </LearningFrame>
  );
}
