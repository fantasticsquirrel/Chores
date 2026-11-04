import type { Dispatch, SetStateAction } from "react";
import {
  defaultAdaptationIslandState,
  nextIslandGeneration,
  type AdaptationIslandState,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";
import { ControlledComparison } from "./ControlledComparison";
type Setter<T> = Dispatch<SetStateAction<T>>;
const generations = (state: AdaptationIslandState) =>
  Array.from({ length: 5 }).reduce<AdaptationIslandState>(
    (next) => nextIslandGeneration(next),
    state,
  );
export function AdaptationComparisons({
  setState,
}: {
  setState: Setter<AdaptationIslandState>;
}) {
  return (
    <>
      <ControlledComparison
        title="Habitat and survival"
        prediction="Predict: will the same shell variant increase on dark and light ground when visual predators are present?"
        baseline="Restored 50% dark and 50% pale shells, dark ground, predators present; advanced five generations."
        change="Restored the same starting shares and predators, changed ground to light, and advanced five generations."
        explain="Compare expected shares. Why does the advantageous inherited variant depend on the environment?"
        onBaseline={() => setState(generations(defaultAdaptationIslandState))}
        onChange={() =>
          setState(
            generations({ ...defaultAdaptationIslandState, habitat: "light" }),
          )
        }
      />
      <ControlledComparison
        title="Predation and selection"
        prediction="Predict: will dark shells increase on dark ground without a survival difference between variants?"
        baseline="Restored 50/50 shares on dark ground with predators; advanced five generations."
        change="Restored the same shares and ground, removed predators, and advanced five generations."
        explain="Compare proportions. Why is dark ground alone insufficient in this model?"
        onBaseline={() => setState(generations(defaultAdaptationIslandState))}
        onChange={() =>
          setState(
            generations({ ...defaultAdaptationIslandState, predators: false }),
          )
        }
      />
    </>
  );
}
