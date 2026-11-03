import { MagnetComparisons } from "./earthComparisons";
import { useState } from "react";
import {
  initialMagnetic,
  magneticResult,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import { ActionButton } from "../../../../components/ActionButton";
import { Control, Dot, Line } from "../Primitives";
import {
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  ModelNote,
} from "../LearningPrimitives";

export function MagnetExploration() {
  const [state, setState] = useState(initialMagnetic);
  const result = magneticResult(state);
  const label = `Facing poles ${result.interaction}. ${result.insideMagnet ? "Probe is inside a magnet; exterior-field direction is not reported." : result.direction === null ? "Fields cancel at the probe; no unique compass direction." : `Compass north end points ${result.direction.toFixed(0)}° from +x toward +z in the diagram.`} Relative field strength ${result.strength.toFixed(3)}.`;
  return (
    <LearningFrame onReset={() => setState(initialMagnetic)}>
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
              Probe ({state.probeX}, {state.probeZ}) · {result.interaction}
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label} Outside a magnet, the compass north-seeking end follows the
        combined field direction. Field lines show directions, not physical
        strings.
      </Explanation>
      <Control
        label="Magnet gap (diagram units)"
        value={state.gap}
        min={0.5}
        max={4.5}
        step={0.5}
        onChange={(gap) => setState({ ...state, gap })}
      />
      <ActionButton
        label="Flip right magnet"
        onPress={() => setState({ ...state, flipped: !state.flipped })}
      />
      <Control
        label="Probe horizontal position (x)"
        value={state.probeX}
        min={-6}
        max={6}
        step={0.5}
        onChange={(probeX) => setState({ ...state, probeX })}
      />
      <Control
        label="Probe depth position (z)"
        value={state.probeZ}
        min={-4}
        max={4}
        step={0.5}
        onChange={(probeZ) => setState({ ...state, probeZ })}
      />
      <MagnetComparisons setState={setState} />
      <ModelNote>
        Paired softened-pole approximation for exterior directions. Real magnets
        do not contain isolated magnetic monopoles; fields continue through
        magnets in loops. Strength and spacing are relative diagram values, not
        tesla or measured force.
      </ModelNote>
    </LearningFrame>
  );
}
