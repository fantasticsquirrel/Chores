import type { Dispatch, SetStateAction } from "react";
import {
  defaultMachineState,
  defaultHeatState,
  defaultPressureState,
  type MachineState,
  type HeatState,
  type PressureState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import { ControlledComparison } from "./ControlledComparison";
type Setter<T> = Dispatch<SetStateAction<T>>;
export function MachineComparisons({
  setState,
}: {
  setState: Setter<MachineState>;
}) {
  return (
    <>
      <ControlledComparison
        title="Supporting strands"
        prediction="Predict: if two rope strands support the same load instead of one, what happens to effort and pulling distance?"
        baseline="Pulley, 40 kg, 0.5 m lift, advantage 1."
        change="Only advantage changed to 2."
        explain="Compare force, distance, and work. Why is reduced force not free energy?"
        onBaseline={() => setState({ ...defaultMachineState, advantage: 1 })}
        onChange={() => setState({ ...defaultMachineState, advantage: 2 })}
      />
      <ControlledComparison
        title="Gear ratio"
        prediction="Predict: will a 4:1 geared hoist need fewer crank turns or less input torque than a 1:1 hoist?"
        baseline="Geared hoist, 40 kg, 0.5 m lift, ratio 1:1."
        change="Only the ratio changed to 4:1."
        explain="Compare crank torque and turns. How does work stay the same?"
        onBaseline={() =>
          setState({ ...defaultMachineState, mode: "gears", advantage: 1 })
        }
        onChange={() =>
          setState({ ...defaultMachineState, mode: "gears", advantage: 4 })
        }
      />
    </>
  );
}
export function HeatComparisons({ setState }: { setState: Setter<HeatState> }) {
  return (
    <>
      <ControlledComparison
        title="Wall insulation"
        prediction="Predict: will adding wall insulation reduce heat transfer equally through walls and windows?"
        baseline="Brick, 8 m² windows, 20°C inside, 0°C outside, no extra insulation."
        change="Only insulation changed to 10 cm."
        explain="Compare wall and window watts. Which path changed, and why?"
        onBaseline={() => setState({ ...defaultHeatState, insulationCm: 0 })}
        onChange={() => setState({ ...defaultHeatState, insulationCm: 10 })}
      />
      <ControlledComparison
        title="Window area"
        prediction="Predict: with the house area fixed, how will replacing insulated wall with more window change transfer?"
        baseline="Brick, 10 cm insulation, 2 m² windows, 20°C inside and 0°C outside."
        change="Only window area changed to 18 m²; windows replace wall area."
        explain="Compare total watts. Why cannot wall insulation stop transfer through windows?"
        onBaseline={() =>
          setState({ ...defaultHeatState, insulationCm: 10, windowM2: 2 })
        }
        onChange={() =>
          setState({ ...defaultHeatState, insulationCm: 10, windowM2: 18 })
        }
      />
    </>
  );
}
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
