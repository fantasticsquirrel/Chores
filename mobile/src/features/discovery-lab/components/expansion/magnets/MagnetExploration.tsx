import { useState } from "react";
import {
  defaultMagneticState,
  magneticFieldsBoundary,
  magneticResult,
  normalizeMagnetic,
  type MagneticState,
} from "@family-manager/family-api/discovery-models/magnetic-fields";
import { ActionButton } from "../../../../../components/ActionButton";
import { Control, Dot, Line } from "../../Primitives";
import {
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "../../LearningPrimitives";
import { MagnetComparison } from "./MagnetComparison";

export function MagnetExploration() {
  const [state, setState] = useState<MagneticState>({
    ...defaultMagneticState,
  });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const result = magneticResult(state);
  const update = (next: MagneticState) => {
    setState(normalizeMagnetic(next));
    setComparisonVersion((value) => value + 1);
  };
  const reset = () => update({ ...defaultMagneticState });
  const label =
    `Facing ${result.facingPoles} poles ${result.interaction}. ` +
    (result.insideMagnet
      ? "Probe is inside a bar, outside the exterior-field model domain."
      : result.directionDegrees === null
        ? `At probe (${state.probeX.toFixed(1)}, ${state.probeZ.toFixed(1)}), two nonzero contribution indices ${result.leftContributionIndex} and ${result.rightContributionIndex} oppose; normalized combined field index 0 and no preferred compass direction.`
        : `At probe (${state.probeX.toFixed(1)}, ${state.probeZ.toFixed(1)}), the north-seeking end points ${result.directionLabel}; normalized field index ${result.relativeFieldIndex} out of 100.`);

  return (
    <LearningFrame onReset={reset} resetLabel="Reset lesson">
      <Diagram
        visualState={{ kind: "magnetic-fields", ...state }}
        label={label}
      >
        {(width) => (
          <>
            <Line
              x={30}
              y={140}
              x2={width / 2 - state.gap * 8}
              y2={140}
              color="#ee8c82"
            />
            <Line
              x={width / 2 + state.gap * 8}
              y={140}
              x2={width - 30}
              y2={140}
              color="#83bbeb"
            />
            <Dot
              x={width / 2 + state.probeX * 16}
              y={140 - state.probeZ * 20}
              size={20}
              color="#f4d578"
            />
            <DiagramLabel x={18} y={230}>
              Probe ({state.probeX}, {state.probeZ}) · {result.facingPoles} ·{" "}
              {result.interaction}
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label} A compass is a small magnet; its north-seeking end aligns with
        the vector sum of both local fields. Outside each bar, conventional
        field direction runs from north toward south.
      </Explanation>
      <Control
        label="Gap between bars (diagram units)"
        value={state.gap}
        min={0.5}
        max={4.5}
        step={0.5}
        onChange={(gap) => update({ ...state, gap })}
      />
      <ActionButton
        label="Flip right magnet"
        onPress={() => update({ ...state, flipped: !state.flipped })}
      />
      <Control
        label="Compass x position (diagram units)"
        value={state.probeX}
        min={-6}
        max={6}
        step={0.5}
        onChange={(probeX) => update({ ...state, probeX })}
      />
      <Control
        label="Compass z position (diagram units)"
        value={state.probeZ}
        min={-4}
        max={4}
        step={0.5}
        onChange={(probeZ) => update({ ...state, probeZ })}
      />
      <Meter
        label="Normalized combined field index"
        value={result.relativeFieldIndex ?? 0}
        detail={
          result.relativeFieldIndex === null
            ? "outside model"
            : `${result.relativeFieldIndex} / 100`
        }
      />
      <Explanation>
        Left-bar contribution index {result.leftContributionIndex} / 100;
        right-bar contribution index {result.rightContributionIndex} / 100.
        These are normalized comparisons, not tesla, force measurements or
        evidence that a weak local sum means weak magnets.
      </Explanation>
      <MagnetComparison
        key={comparisonVersion}
        onApply={(next) => setState(normalizeMagnetic(next))}
      />
      <ModelNote>{magneticFieldsBoundary}</ModelNote>
    </LearningFrame>
  );
}
