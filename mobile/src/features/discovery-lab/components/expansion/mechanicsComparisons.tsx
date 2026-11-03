import type { Dispatch, SetStateAction } from "react";
import {
  defaultPressureState,
  type PressureState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import { ControlledComparison } from "./ControlledComparison";
type Setter<T> = Dispatch<SetStateAction<T>>;
export function PressureComparisons({
  setState,
}: {
  setState: Setter<PressureState>;
}) {
  return (
    <>
      <ControlledComparison
        title="Water above outlet"
        prediction="Predict: raising the surface from 1 m to 2 m with the outlet at 0.5 m changes the water head by what factor?"
        baseline="Narrow tank, 1 m water depth, outlet 0.5 m above ground."
        change="Only water depth changed to 2 m."
        explain="Compare static gauge pressure and jet speed. Why do they change by different factors?"
        onBaseline={() => setState({ ...defaultPressureState, depthM: 1 })}
        onChange={() => setState(defaultPressureState)}
      />
      <ControlledComparison
        title="Tank width"
        prediction="Predict: will a wider tank give a faster jet when surface and outlet heights stay the same?"
        baseline="Narrow tank, water depth 2 m, outlet height 0.5 m."
        change="Only tank shape changed to wide."
        explain="Compare water volume, head, and jet speed. Which quantity controls static pressure at outlet depth?"
        onBaseline={() => setState(defaultPressureState)}
        onChange={() => setState({ ...defaultPressureState, shape: "wide" })}
      />
    </>
  );
}
