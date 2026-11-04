import { useRef, useState, type SetStateAction } from "react";
import {
  crossSection,
  defaultShapeSlicerState,
  shapeObservation,
  type ShapeSlicerState,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";
import {
  diagonalCubeState,
  shapeSlicerBoundary,
  shapeSlicerCoreBoundary,
  shapeSlicerTrials,
} from "@family-manager/family-api/discovery-models/shape-slicer";
import { createShapeSlicerScene } from "@family-manager/discovery-scenes/expansion/life-geometry/index";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { LifeInvestigations } from "./LifeInvestigations";
import "./life-geometry.css";
export function ShapeSlicerSimulation() {
  const [state, setState] = useState<ShapeSlicerState>(defaultShapeSlicerState),
    [investigationReset, setInvestigationReset] = useState(0),
    dragging = useRef(false);
  const setManualState = (next: SetStateAction<ShapeSlicerState>) => {
    setState(next);
    setInvestigationReset((value) => value + 1);
  };
  const section = crossSection(state),
    observation = shapeObservation(state);
  const set = <K extends keyof ShapeSlicerState>(
    key: K,
    value: ShapeSlicerState[K],
  ) => setManualState((previous) => ({ ...previous, [key]: value }));
  const moveCut = (value: number) =>
    set("offset", Math.round(Math.max(-1.75, Math.min(1.75, value)) * 20) / 20);
  const run = (next: ShapeSlicerState) => {
    setState({ ...next });
    return shapeObservation(next);
  };
  const points = section.points
    .map((p) => `${130 + p[0] * 52},${130 + p[2] * 52}`)
    .join(" ");
  return (
    <section className="life-lesson life-shape">
      <header>
        <h2>How does a plane make a cross-section?</h2>
        <p>
          Predict the section, change only orientation or plane height, and use
          side, radius and area evidence to explain the result.
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
            <button
              type="button"
              onClick={() => setManualState(diagonalCubeState)}
            >
              Diagonal cube cut
            </button>
            <button
              type="button"
              onClick={() => setManualState(defaultShapeSlicerState)}
            >
              Reset shape slicer
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
        resetKey={investigationReset}
        items={shapeSlicerTrials.map((trial) => ({
          label: trial.title,
          predict: trial.question,
          choices: trial.choices,
          correctChoice: trial.correctChoice,
          fixed: trial.controlled,
          cases: [
            [trial.caseLabels[0], () => run(trial.before)],
            [trial.caseLabels[1], () => run(trial.after)],
          ],
          evidence: `${trial.evidence} Changed: ${trial.changed}. Held: ${trial.held.join(", ")}.`,
          explain: trial.explain,
        }))}
      />
      <p className="life-model-note">
        {shapeSlicerCoreBoundary} Use the equal-scale straight-on section for
        size comparisons; camera perspective does not change the model result.
      </p>
      <details className="life-boundary">
        <summary>Model boundary</summary>
        <p>{shapeSlicerBoundary}</p>
      </details>
    </section>
  );
}
