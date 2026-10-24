import type { Dispatch, SetStateAction } from "react";
import {
  defaultCellExplorerState,
  defaultShapeSlicerState,
  defaultAdaptationIslandState,
  stepCellTransport,
  nextIslandGeneration,
  type CellExplorerState,
  type ShapeSlicerState,
  type AdaptationIslandState,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";
import { ControlledComparison } from "./ControlledComparison";
type Setter<T> = Dispatch<SetStateAction<T>>;
export function CellComparisons({
  setState,
}: {
  setState: Setter<CellExplorerState>;
}) {
  return (
    <>
      <ControlledComparison
        title="Different molecules"
        prediction="Predict: can oxygen and glucose both cross a membrane without a glucose carrier?"
        baseline="Restored outside 12 and inside 4, oxygen, no carrier, then ran one transfer step."
        change="Restored the same concentrations with no carrier, changed only the molecule to glucose, then ran one equal step."
        explain="Compare final concentrations. Why is the membrane selectively permeable?"
        onBaseline={() => setState(stepCellTransport(defaultCellExplorerState))}
        onChange={() =>
          setState(
            stepCellTransport({
              ...defaultCellExplorerState,
              molecule: "glucose",
            }),
          )
        }
      />
      <ControlledComparison
        title="Glucose and carrier"
        prediction="Predict: with the same concentration difference, will glucose cross if its carrier is missing?"
        baseline="Restored outside 12 and inside 4, glucose, no carrier, then ran one step."
        change="Restored the same concentrations, added the carrier, then ran one equal step."
        explain="What evidence shows selective permeability? Is the movement toward lower or higher concentration?"
        onBaseline={() =>
          setState(
            stepCellTransport({
              ...defaultCellExplorerState,
              molecule: "glucose",
            }),
          )
        }
        onChange={() =>
          setState(
            stepCellTransport({
              ...defaultCellExplorerState,
              molecule: "glucose",
              carrier: true,
            }),
          )
        }
      />
    </>
  );
}
export function ShapeComparisons({
  setState,
}: {
  setState: Setter<ShapeSlicerState>;
}) {
  return (
    <>
      <ControlledComparison
        title="Cube orientation"
        prediction="Predict: must every flat slice through a cube have four sides?"
        baseline="Cube with a center slice and no tilt or turn."
        change="Kept the slice centered; tilted the cube 45° and turned it about 35.26°."
        explain="Count the cross-section edges. How can it have more edges than any single cube face?"
        onBaseline={() => setState(defaultShapeSlicerState)}
        onChange={() =>
          setState({ ...defaultShapeSlicerState, tilt: 45, turn: 35.26438968 })
        }
      />
      <ControlledComparison
        title="Sphere slice position"
        prediction="Predict: will a slice away from a sphere's center have a different shape, size, or both?"
        baseline="Sphere of radius 1, center slice at offset 0."
        change="Only the slice offset changed to 0.6 units."
        explain="Compare the radius and area. Why does the shape remain a circle?"
        onBaseline={() =>
          setState({ ...defaultShapeSlicerState, solid: "sphere" })
        }
        onChange={() =>
          setState({ ...defaultShapeSlicerState, solid: "sphere", offset: 0.6 })
        }
      />
    </>
  );
}
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
