import { useState } from "react";
import {
  advanceFaultLoading,
  defaultPlateState,
  FAULT_SLIP_LIMIT,
  movingPlatesBoundary,
  normalizePlate,
  plateResult,
  type PlateState,
} from "@family-manager/family-api/discovery-models/moving-plates";
import { ActionButton } from "../../../../../components/ActionButton";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "../../LearningPrimitives";
import { Control, Line } from "../../Primitives";
import { PlatesComparison } from "./PlatesComparison";

const motion = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 1 });

export function PlatesExploration() {
  const [state, setState] = useState<PlateState>({ ...defaultPlateState });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const result = plateResult(state);
  const update = (next: PlateState) => {
    setState(normalizePlate(next));
    setComparisonVersion((value) => value + 1);
  };
  const reset = () => update({ ...defaultPlateState });
  const label =
    `${result.summary} ${state.rateCmPerYear.toFixed(0)} cm/yr over ${state.elapsedMillionYears.toFixed(2).replace(/0$/, "")} million years gives ${motion(result.relativeMotionKm)} km of relative motion. ` +
    `Elastic-loading index ${result.elasticLoadingPercent}%; ${state.slips} illustrated ${state.slips === 1 ? "slip" : "slips"}. The plate cutaway includes crust and rigid uppermost mantle above slowly deforming, solid asthenosphere.`;
  return (
    <LearningFrame onReset={reset} resetLabel="Reset lesson">
      <Diagram visualState={{ kind: "moving-plates", ...state }} label={label}>
        {(width) => {
          const middle = width / 2;
          return (
            <>
              <Line
                x={24}
                y={118}
                x2={middle - 18}
                y2={state.boundary === "convergent" ? 135 : 118}
                color="#84c5d7"
              />
              <Line
                x={middle + 18}
                y={state.boundary === "convergent" ? 160 : 118}
                x2={width - 24}
                y2={118}
                color="#e7bc7b"
              />
              <Line
                x={middle}
                y={state.boundary === "transform" ? 55 : 155}
                x2={middle}
                y2={state.boundary === "transform" ? 225 : 205}
                color="#ec8a66"
              />
              <DiagramLabel x={18} y={238}>
                {result.feature} · {motion(result.relativeMotionKm)} km relative
                motion
              </DiagramLabel>
            </>
          );
        }}
      </Diagram>
      <Explanation>
        {label} {result.crustChange}. The arrows show relative direction; the
        scene's relief and distances are schematic, not a cross-section to
        scale.
      </Explanation>
      <Choice
        label="Boundary motion"
        value={state.boundary}
        onChange={(boundary) =>
          update({ ...state, boundary, loadingStep: 0, slips: 0 })
        }
        options={[
          { value: "divergent", label: "Apart" },
          { value: "convergent", label: "Together" },
          { value: "transform", label: "Sideways" },
        ]}
      />
      <Control
        label="Relative plate rate (cm/yr)"
        value={state.rateCmPerYear}
        min={1}
        max={10}
        step={1}
        onChange={(rateCmPerYear) => update({ ...state, rateCmPerYear })}
      />
      <Control
        label="Elapsed time (million years)"
        value={state.elapsedMillionYears}
        min={0}
        max={5}
        step={0.25}
        onChange={(elapsedMillionYears) =>
          update({ ...state, elapsedMillionYears })
        }
      />
      {state.boundary === "transform" && (
        <ActionButton
          label={
            state.slips >= FAULT_SLIP_LIMIT
              ? "Slip display limit reached"
              : "Add one loading step"
          }
          disabled={state.slips >= FAULT_SLIP_LIMIT}
          onPress={() => update(advanceFaultLoading(state))}
        />
      )}
      <Meter
        label="Invented elastic-loading index"
        value={result.elasticLoadingPercent}
      />
      <Explanation>
        Calculated relative motion: {motion(result.relativeMotionKm)} km.
        Illustrated slips: {state.slips}. Fault-loading steps have no time or
        magnitude units.
      </Explanation>
      <PlatesComparison
        key={comparisonVersion}
        onApply={(next) => setState(normalizePlate(next))}
      />
      <ModelNote>{movingPlatesBoundary}</ModelNote>
    </LearningFrame>
  );
}
