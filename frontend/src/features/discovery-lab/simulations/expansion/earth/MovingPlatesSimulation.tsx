import { useState } from "react";
import {
  advancePlate,
  initialPlate,
  plateResult,
  type PlateBoundary,
  type PlateState,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import { createMovingPlatesScene } from "@family-manager/discovery-scenes/expansion/earth/plates";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { LandscapeInvestigation } from "../../landscape/LandscapeExhibit";
import { EarthExhibit, EarthMetric } from "./EarthExhibit";
export function MovingPlatesSimulation() {
  const [state, setState] = useState<PlateState>(initialPlate),
    result = plateResult(state);
  const boundary = (value: PlateBoundary) =>
    setState({ ...initialPlate, boundary: value, movement: 0 });
  const step = () => setState((s) => advancePlate(s));
  const description = `${result.terrain}. Plates move ${result.motion}. Stored deformation index ${state.stress}; ${state.slips} illustrated slips. Transform surface offsets only when a slip occurs.`;
  return (
    <EarthExhibit
      question="How does plate motion change a boundary?"
      introduction="Earth’s rigid outer plates move over a slowly deforming mantle. Separation can create crust; convergence can carry oceanic crust downward; sideways motion offsets features along faults. Compare the arrows and the cutaway, not just the surface."
      scene={
        <ExpansionCanvas
          state={state}
          buildScene={createMovingPlatesScene}
          description={description}
          onSelect={step}
        />
      }
      controls={
        <>
          <div>
            <strong>Boundary type</strong>
            <div className="earth-buttons">
              {(
                [
                  ["divergent", "Apart"],
                  ["convergent", "Together"],
                  ["transform", "Sideways"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={state.boundary === value}
                  onClick={() => boundary(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {state.boundary !== "transform" && (
            <Slider
              label="Terrain diagram progress"
              value={state.movement}
              min={0}
              max={100}
              unit="%"
              onChange={(movement) => setState((s) => ({ ...s, movement }))}
            />
          )}
          <div className="earth-buttons">
            <button onClick={step}>
              {state.boundary === "transform"
                ? "Add one loading step"
                : "Advance diagram"}
            </button>
            <button
              onClick={() =>
                setState({
                  ...initialPlate,
                  boundary: state.boundary,
                  movement: 0,
                })
              }
            >
              Reset this boundary
            </button>
          </div>
          <p className="earth-control-note">
            Tap a plate to advance one step. Changing boundary resets the
            diagram. In Sideways, the marked road bends while the fault is
            locked, then shifts when it slips.
          </p>
        </>
      }
      evidence={
        <>
          <EarthMetric label="Relative plate motion" value={result.motion} />
          <EarthMetric
            label="Stored deformation · relative index"
            value={`${state.stress} / 60 slip threshold`}
          />
          <EarthMetric
            label="Illustrated fault slips"
            value={`${state.slips}`}
          />
          <p>
            {result.terrain}.{" "}
            {state.boundary === "transform"
              ? state.slips > 0 && state.stress === 12
                ? "The latest slip released stored deformation; the road is now offset."
                : "Loading bends the marked road before the next illustrated slip."
              : "The step count is diagram progress, not elapsed years."}
          </p>
        </>
      }
      investigations={
        <LandscapeInvestigation
          items={[
            {
              label: "Compare directions",
              predict:
                "At equal diagram progress, will pulling apart and pushing together make the same boundary shape?",
              options: ["Same shape", "Different shapes"],
              action:
                "Set up Apart at 40%. Note the central ridge. Choose Together, then return progress to 40%. Compare the same diagram stage; the vertical relief is not a measurement.",
              explain:
                "Which diagram adds crust at the boundary, and which carries oceanic crust beneath another plate? Use the arrows and cutaway as evidence.",
              test: () => setState({ ...initialPlate, movement: 40 }),
              testLabel: "Set Apart to 40%",
            },
            {
              label: "Load, then slip",
              predict:
                "Will the road shift gradually at every loading step, or suddenly after deformation builds?",
              options: [
                "Gradually each step",
                "After stored deformation builds",
              ],
              action:
                "Set up Sideways at zero. Add four loading steps and note the index and road. Add one more step and compare the index, offset and slip count.",
              explain:
                "Why can slowly accumulating plate motion lead to a sudden fault slip? Does this invented repeatable threshold tell us when a real earthquake will occur?",
              test: () =>
                setState({
                  ...initialPlate,
                  boundary: "transform",
                  movement: 0,
                }),
              testLabel: "Reset Sideways loading",
            },
          ]}
        />
      }
      note="Terrain and time are schematic. Together shows oceanic–continental subduction, not every kind of collision. Earthquakes can occur at all three boundary types and within plates; only the Sideways fault has a loading model here. Its threshold, regular repetition and deformation index are invented, not earthquake timing or magnitude predictions. The mantle is mostly solid, not an ocean of liquid magma."
    />
  );
}
