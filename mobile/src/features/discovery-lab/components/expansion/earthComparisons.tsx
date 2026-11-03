import type { Dispatch, SetStateAction } from "react";
import {
  initialMagnetic,
  type MagneticState,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import { ControlledComparison } from "./ControlledComparison";
type Setter<T> = Dispatch<SetStateAction<T>>;
export function MagnetComparisons({
  setState,
}: {
  setState: Setter<MagneticState>;
}) {
  return (
    <>
      <ControlledComparison
        title="Facing poles"
        prediction="Predict: what happens to the interaction and compass when the right magnet is flipped?"
        baseline="Gap 2 diagram units, unflipped right magnet, probe at (0, 2)."
        change="Only the right magnet was flipped."
        explain="Compare attraction or repulsion and the compass direction. Which poles now face each other?"
        onBaseline={() => setState(initialMagnetic)}
        onChange={() => setState({ ...initialMagnetic, flipped: true })}
      />
      <ControlledComparison
        title="Field cancellation"
        prediction="Predict: can two magnets produce no unique compass direction at one particular point?"
        baseline="Like poles face at gap 2, with the probe exactly at (0, 0)."
        change="Only probe depth changed to 2; magnet positions and poles stayed fixed."
        explain="Compare field strength and compass direction. Why does cancellation at the midpoint not mean the magnets have no field elsewhere?"
        onBaseline={() =>
          setState({ ...initialMagnetic, flipped: true, probeZ: 0 })
        }
        onChange={() => setState({ ...initialMagnetic, flipped: true })}
      />
    </>
  );
}
