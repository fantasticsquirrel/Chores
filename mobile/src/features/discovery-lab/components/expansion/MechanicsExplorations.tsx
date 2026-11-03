import { PressureComparisons } from "./mechanicsComparisons";
import { useState } from "react";
import {
  defaultPressureState,
  pressureResult,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import { Control, Dot, Line } from "../Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  ModelNote,
} from "../LearningPrimitives";

export { MachineExploration } from "./machine/MachineExploration";
export { HeatExploration } from "./heat/HeatExploration";

export function PressureExploration() {
  const [state, setState] = useState(defaultPressureState);
  const result = pressureResult(state);
  const label = `Water above outlet: ${result.headM.toFixed(2)} m. Static gauge pressure at outlet depth ${result.pressurePa.toFixed(0)} Pa. Jet speed ${result.jetSpeedMps.toFixed(2)} m/s; range ${result.rangeM.toFixed(2)} m.`;
  return (
    <LearningFrame onReset={() => setState(defaultPressureState)}>
      <Diagram visualState={{ kind: "pressure-tank", ...state }} label={label}>
        {(width) => (
          <>
            <Line x={35} y={35} x2={35} y2={245} />
            <Line x={35} y={245} x2={width * 0.55} y2={245} />
            <Line x={width * 0.55} y={245} x2={width * 0.55} y2={35} />
            <Line
              x={35}
              y={245 - state.depthM * 60}
              x2={width * 0.55}
              y2={245 - state.depthM * 60}
              color="#87dbf5"
            />
            <Dot
              x={width * 0.55}
              y={245 - state.outletM * 60}
              size={12}
              color="#e3ac5c"
            />
            {result.headM > 0 && (
              <Line
                x={width * 0.55}
                y={245 - state.outletM * 60}
                x2={Math.min(width - 10, width * 0.55 + result.rangeM * 22)}
                y2={245}
                color="#87dbf5"
              />
            )}
            <DiagramLabel x={18} y={270}>
              {state.shape} tank · {result.volumeLiters.toFixed(0)} L
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label}{" "}
        {result.headM > 0
          ? "Static pressure inside the tank at outlet depth depends on depth below the surface, not total water volume."
          : "The outlet is at or above the water surface, so this model has no jet."}
      </Explanation>
      <Control
        label="Water depth (m)"
        value={state.depthM}
        min={0.2}
        max={3}
        step={0.1}
        onChange={(depthM) => setState({ ...state, depthM })}
      />
      <Control
        label="Outlet height (m)"
        value={state.outletM}
        min={0.1}
        max={2.5}
        step={0.1}
        onChange={(outletM) => setState({ ...state, outletM })}
      />
      <Choice
        label="Tank shape"
        value={state.shape}
        onChange={(shape) => setState({ ...state, shape })}
        options={[
          { value: "narrow", label: "Narrow" },
          { value: "wide", label: "Wide" },
          { value: "tapered", label: "Tapered" },
        ]}
      />
      <PressureComparisons setState={setState} />
      <ModelNote>
        Open tank with fresh water and equal air pressure inside and outside.
        The instantaneous jet neglects friction, air drag, and falling water
        level. Pressure shown is static pressure inside the tank above
        atmospheric pressure. The emerging jet is approximately at atmospheric
        pressure; do not pressurize a real container.
      </ModelNote>
    </LearningFrame>
  );
}
