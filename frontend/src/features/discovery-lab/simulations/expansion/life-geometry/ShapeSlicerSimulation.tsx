import { useRef, useState } from "react";
import {
  crossSection,
  defaultShapeSlicerState,
  shapeObservation,
  type ShapeSlicerState,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";
import { createShapeSlicerScene } from "@family-manager/discovery-scenes/expansion/life-geometry/index";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { LifeInvestigations } from "./LifeInvestigations";
import "./life-geometry.css";
const diagonal = {
  solid: "cube" as const,
  tilt: 45,
  turn: 35.26438968,
  offset: 0,
};
export function ShapeSlicerSimulation() {
  const [state, setState] = useState<ShapeSlicerState>(defaultShapeSlicerState),
    dragging = useRef(false);
  const section = crossSection(state),
    observation = shapeObservation(state);
  const set = <K extends keyof ShapeSlicerState>(
    key: K,
    value: ShapeSlicerState[K],
  ) => setState((previous) => ({ ...previous, [key]: value }));
  const moveCut = (value: number) =>
    set("offset", Math.round(Math.max(-1.75, Math.min(1.75, value)) * 20) / 20);
  const run = (next: ShapeSlicerState) => {
    setState(next);
    return shapeObservation(next);
  };
  const points = section.points
    .map((p) => `${130 + p[0] * 52},${130 + p[2] * 52}`)
    .join(" ");
  return (
    <section className="life-lesson life-shape">
      <header>
        <h2>Can a cube make a hexagon?</h2>
        <p>
          A cross-section is the flat region where a plane meets a solid. Rotate
          the solid or move the cutting plane.
        </p>
      </header>
      <div className="life-workspace">
        <div className="life-visual">
          <ExpansionCanvas
            state={state}
            buildScene={createShapeSlicerScene}
            description={`${observation} The amber plane is horizontal. Solid tilt ${state.tilt.toFixed(1)} degrees, turn ${state.turn.toFixed(1)} degrees, cut height ${state.offset.toFixed(2)}.`}
            onSelect={(direction) => moveCut(state.offset + direction * 0.1)}
          />
          <p className="life-caption">
            Drag the view without changing the cut. Tap the small ruler arrows
            to raise or lower the plane.
          </p>
        </div>
        <div className="life-controls">
          <label>
            Solid
            <select
              value={state.solid}
              onChange={(event) =>
                set("solid", event.target.value as ShapeSlicerState["solid"])
              }
            >
              <option value="cube">Cube</option>
              <option value="tetrahedron">Tetrahedron</option>
              <option value="sphere">Sphere</option>
            </select>
          </label>
          <Slider
            label="Solid tilt"
            value={Number(state.tilt.toFixed(1))}
            min={0}
            max={90}
            step={0.1}
            unit="°"
            onChange={(value) => set("tilt", value)}
          />
          <Slider
            label="Solid turn"
            value={Number(state.turn.toFixed(1))}
            min={0}
            max={90}
            step={0.1}
            unit="°"
            onChange={(value) => set("turn", value)}
          />
          <Slider
            label="Cut height"
            value={state.offset}
            min={-1.75}
            max={1.75}
            step={0.05}
            unit=" units"
            onChange={moveCut}
          />
          <div className="life-actions">
            <button type="button" onClick={() => set("offset", 0)}>
              Center the cut
            </button>
            <button type="button" onClick={() => setState(diagonal)}>
              Diagonal cube cut
            </button>
            <button
              type="button"
              onClick={() => setState(defaultShapeSlicerState)}
            >
              Reset solid
            </button>
          </div>
          <div className="life-section-view">
            <strong>Section viewed straight-on</strong>
            <svg
              viewBox="0 0 260 260"
              role="img"
              aria-label={`${section.name}, area ${section.area.toFixed(2)} square units. Same scale in both directions.`}
            >
              <defs>
                <pattern
                  id="life-section-grid"
                  width="26"
                  height="26"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 26 0 L 0 0 0 26"
                    fill="none"
                    stroke="#a5b3bd"
                    strokeOpacity=".16"
                  />
                </pattern>
              </defs>
              <rect width="260" height="260" fill="url(#life-section-grid)" />
              {section.points.length > 2 ? (
                <polygon
                  points={points}
                  fill="#d9b46644"
                  stroke="#eaca85"
                  strokeWidth="2"
                />
              ) : section.points.length === 2 ? (
                <polyline
                  points={points}
                  fill="none"
                  stroke="#eaca85"
                  strokeWidth="2"
                />
              ) : section.points.length === 1 ? (
                <circle
                  cx={130 + section.points[0][0] * 52}
                  cy={130 + section.points[0][2] * 52}
                  r="3"
                  fill="#efcf88"
                />
              ) : null}
              <text
                x="130"
                y="248"
                textAnchor="middle"
                fill="currentColor"
                fontSize="12"
              >
                Grid spacing: 0.5 units
              </text>
            </svg>
          </div>
          <div
            className="life-cut-rail"
            role="slider"
            aria-label="Drag cutting plane"
            aria-valuemin={-1.75}
            aria-valuemax={1.75}
            aria-valuenow={state.offset}
            aria-valuetext={`${state.offset} units`}
            tabIndex={0}
            onKeyDown={(event) => {
              if (
                [
                  "ArrowUp",
                  "ArrowRight",
                  "ArrowDown",
                  "ArrowLeft",
                  "Home",
                  "End",
                ].includes(event.key)
              ) {
                event.preventDefault();
                moveCut(
                  event.key === "Home"
                    ? -1.75
                    : event.key === "End"
                      ? 1.75
                      : state.offset +
                        (["ArrowUp", "ArrowRight"].includes(event.key)
                          ? 0.05
                          : -0.05),
                );
              }
            }}
            onPointerDown={(event) => {
              dragging.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              const rect = event.currentTarget.getBoundingClientRect();
              moveCut(((event.clientX - rect.left) / rect.width) * 3.5 - 1.75);
            }}
            onPointerMove={(event) => {
              if (dragging.current) {
                const rect = event.currentTarget.getBoundingClientRect();
                moveCut(
                  ((event.clientX - rect.left) / rect.width) * 3.5 - 1.75,
                );
              }
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
          >
            <span style={{ left: `${((state.offset + 1.75) / 3.5) * 100}%` }} />
            <small>Drag the plane height</small>
          </div>
        </div>
      </div>
      <div className="life-evidence" role="status">
        <strong>{section.name}</strong>
        <p>{observation}</p>
      </div>
      <LifeInvestigations
        items={[
          {
            label: "Rotate a cube",
            predict: "Does a central cube slice always have four sides?",
            choices: ["Always four", "Can have more"],
            fixed:
              "Keep the same cube and cut through its center. Compare the unrotated cube with the diagonal orientation. The plane does not move.",
            cases: [
              ["Face-parallel cube", () => run(defaultShapeSlicerState)],
              ["Diagonal cube", () => run(diagonal)],
            ],
            explain:
              "Count the solid’s edges touched by each cut. Why can a solid with square faces have a six-sided cross-section?",
          },
          {
            label: "Move through a sphere",
            predict:
              "Will moving a plane away from a sphere’s center change the section’s shape, size, or both?",
            choices: ["Size only", "Shape and size", "Neither"],
            fixed:
              "Keep a sphere of radius 1 and the same orientation. Compare cut height 0 with 0.6 units. Use the straight-on view, not perspective, to compare size.",
            cases: [
              [
                "Sphere · center",
                () => run({ ...defaultShapeSlicerState, solid: "sphere" }),
              ],
              [
                "Sphere · height 0.6",
                () =>
                  run({
                    ...defaultShapeSlicerState,
                    solid: "sphere",
                    offset: 0.6,
                  }),
              ],
            ],
            explain:
              "Compare the two circle radii and areas. Why does the circle shrink before the plane stops meeting the sphere?",
          },
        ]}
      />
      <p className="life-model-note">
        Cube side length: 2 units. Sphere radius: 1 unit. The tetrahedron’s
        vertices lie at alternating corners of that cube. Polygon sections use
        exact edge–plane intersections; sphere areas use πr², not a polygon
        estimate. Readouts are rounded. A tangent cut can be a point or line
        rather than a region with area. Turning the camera changes only your
        view.
      </p>
    </section>
  );
}
