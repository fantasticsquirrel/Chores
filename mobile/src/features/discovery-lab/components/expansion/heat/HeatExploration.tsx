import { useState } from "react";
import {
  defaultHeatState,
  heatHouseBoundary,
  heatResult,
  normalizeHeat,
  type HeatState,
} from "@family-manager/family-api/discovery-models/heat-house";
import { Control, Dot, Line } from "../../Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  ModelNote,
} from "../../LearningPrimitives";
import { HeatComparison } from "./HeatComparison";

export function HeatExploration() {
  const [state, setState] = useState<HeatState>({ ...defaultHeatState });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const update = (next: HeatState) => {
    setState(normalizeHeat(next));
    setComparisonVersion((value) => value + 1);
  };
  const reset = () => {
    setState({ ...defaultHeatState });
    setComparisonVersion((value) => value + 1);
  };
  const result = heatResult(state);
  const energyKWh = Math.abs(result.totalEnergyKWh);
  const direction =
    result.direction === "outward"
      ? "out of the house"
      : result.direction === "inward"
        ? "into the house"
        : "with no net direction";
  const label =
    "Net outward heat-transfer power: " +
    result.totalWatts.toFixed(0) +
    " W. Walls " +
    result.wallWatts.toFixed(0) +
    " W; windows " +
    result.windowWatts.toFixed(0) +
    " W. Over " +
    state.elapsedHours +
    " h, " +
    energyKWh.toFixed(2) +
    " kWh transfers " +
    direction +
    ".";
  return (
    <LearningFrame onReset={reset} resetLabel="Reset lesson">
      <Diagram visualState={{ kind: "heat-house", ...state }} label={label}>
        {(width) => (
          <>
            <Line x={45} y={185} x2={45} y2={90} />
            <Line x={45} y={90} x2={width / 2} y2={45} />
            <Line x={width / 2} y={45} x2={width - 45} y2={90} />
            <Line x={width - 45} y={90} x2={width - 45} y2={185} />
            <Line x={45} y={185} x2={width - 45} y2={185} />
            <Dot
              x={width / 2}
              y={135}
              size={35 + state.windowM2 * 2}
              color="#a5d8eb"
            />
            <Line
              x={35}
              y={215}
              x2={35 + (Math.min(state.elapsedHours, 24) / 24) * (width - 70)}
              y2={215}
              color="#e3ac5c"
            />
            <DiagramLabel x={18} y={238}>
              Inside {state.insideC}°C · outside {state.outsideC}°C
            </DiagramLabel>
            <DiagramLabel x={18} y={264}>
              {state.insulationCm} cm insulation · {state.elapsedHours} h
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label} Power is energy transferred each second: 1 W = 1 J/s. At fixed
        power, energy grows with elapsed time; 1 kWh = 3.6 MJ. Insulation raises
        resistance through the wall path; it does not generate thermal energy.
      </Explanation>
      <Control
        label="Insulation (cm)"
        value={state.insulationCm}
        min={0}
        max={20}
        onChange={(insulationCm) => update({ ...state, insulationCm })}
      />
      <Control
        label="Window area (m²)"
        value={state.windowM2}
        min={2}
        max={18}
        step={2}
        onChange={(windowM2) => update({ ...state, windowM2 })}
      />
      <Choice
        label="Wall material"
        value={state.material}
        onChange={(material) => update({ ...state, material })}
        options={[
          { value: "brick", label: "Brick" },
          { value: "wood", label: "Wood" },
          { value: "insulation", label: "Insulating panel" },
        ]}
      />
      <Control
        label="Inside temperature (°C)"
        value={state.insideC}
        min={16}
        max={24}
        onChange={(insideC) => update({ ...state, insideC })}
      />
      <Control
        label="Outside temperature (°C)"
        value={state.outsideC}
        min={-5}
        max={25}
        onChange={(outsideC) => update({ ...state, outsideC })}
      />
      <Control
        label="Elapsed time (h)"
        value={state.elapsedHours}
        min={0}
        max={24}
        onChange={(elapsedHours) => update({ ...state, elapsedHours })}
      />
      <HeatComparison key={comparisonVersion} onApply={setState} />
      <ModelNote>{heatHouseBoundary}</ModelNote>
    </LearningFrame>
  );
}
