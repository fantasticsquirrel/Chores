import type { Dispatch, SetStateAction } from "react";
import {
  initialCloud,
  initialMagnetic,
  type CloudState,
  type MagneticState,
} from "@family-manager/family-api/discovery-models/expansion-earth";
import { ControlledComparison } from "./ControlledComparison";
type Setter<T> = Dispatch<SetStateAction<T>>;
export function CloudComparisons({
  setState,
}: {
  setState: Setter<CloudState>;
}) {
  return (
    <>
      <ControlledComparison
        title="Rising and cooling"
        prediction="Predict: will air lifted farther be warmer or cooler, and when will droplets first appear?"
        baseline="22°C, 10 g/kg vapor, growth index 30, uplift 600 m."
        change="Only uplift changed to 1800 m."
        explain="Compare parcel temperature and cloud presence. Why does the visible cloud mark liquid droplets rather than vapor?"
        onBaseline={() => setState({ ...initialCloud, upliftM: 600 })}
        onChange={() => setState({ ...initialCloud, upliftM: 1800 })}
      />
      <ControlledComparison
        title="Cloud is not always rain"
        prediction="Predict: does any cloud automatically produce rain in this model?"
        baseline="22°C, 10 g/kg vapor, uplift 1400 m, growth index 30."
        change="Only the droplet growth index changed to 90."
        explain="Compare cloud and rain states. What extra condition does falling rain require?"
        onBaseline={() => setState(initialCloud)}
        onChange={() => setState({ ...initialCloud, dropletGrowth: 90 })}
      />
    </>
  );
}
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
