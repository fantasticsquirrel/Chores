import {
  MachineComparisons,
  HeatComparisons,
  PressureComparisons,
} from "./mechanicsComparisons";
import { useState } from "react";
import {
  defaultMachineState,
  defaultHeatState,
  defaultPressureState,
  machineResult,
  heatResult,
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

export function MachineExploration() {
  const [state, setState] = useState(defaultMachineState);
  const result = machineResult(state);
  const label = `Input force ${result.inputForceN.toFixed(1)} N; input distance ${result.inputDistanceM.toFixed(2)} m. Load rises ${state.liftM.toFixed(2)} m.`;
  return (
    <LearningFrame onReset={() => setState(defaultMachineState)}>
      <Diagram
        visualState={{ kind: "machine-workshop", ...state }}
        label={label}
      >
        {(width) => (
          <>
            <Line x={30} y={55} x2={width - 30} y2={55} />
            <Line
              x={width * 0.6}
              y={55}
              x2={width * 0.6}
              y2={200 - state.liftM * 80}
            />
            <Dot
              x={width * 0.6}
              y={200 - state.liftM * 80}
              size={36}
              color="#e3ac5c"
            />
            <DiagramLabel x={18} y={225}>
              {state.loadKg} kg load · ratio {state.advantage}:1
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label} Input work {result.inputWorkJ.toFixed(1)} J; output work{" "}
        {result.outputWorkJ.toFixed(1)} J. A larger mechanical advantage trades
        less force for more input distance; it does not create energy.
      </Explanation>
      <Choice
        label="Machine"
        value={state.mode}
        onChange={(mode) => setState({ ...state, mode })}
        options={[
          { value: "pulley", label: "Pulley" },
          { value: "lever", label: "Lever" },
          { value: "gears", label: "Geared hoist" },
        ]}
      />
      <Control
        label="Load (kg)"
        value={state.loadKg}
        min={10}
        max={100}
        step={10}
        onChange={(loadKg) => setState({ ...state, loadKg })}
      />
      <Control
        label="Mechanical advantage"
        value={state.advantage}
        min={1}
        max={4}
        onChange={(advantage) => setState({ ...state, advantage })}
      />
      <Control
        label="Lift distance (m)"
        value={state.liftM}
        min={0}
        max={1}
        step={0.1}
        onChange={(liftM) => setState({ ...state, liftM })}
      />
      {state.mode === "gears" && (
        <Explanation>
          Input torque {result.inputTorqueNm.toFixed(2)} N·m; output torque{" "}
          {result.outputTorqueNm.toFixed(2)} N·m. The crank turns{" "}
          {result.crankTurns.toFixed(3)} times for this lift.
        </Explanation>
      )}
      <MachineComparisons setState={setState} />
      <ModelNote>
        Ideal slow lifting with no friction, rope stretch, or machine weight.
        The geared hoist converts a rotating crank into lifting motion; the
        reported force is at an equal-radius handle, not a torque measurement.
      </ModelNote>
    </LearningFrame>
  );
}

export function HeatExploration() {
  const [state, setState] = useState(defaultHeatState);
  const result = heatResult(state);
  const label = `Net outward heat transfer: ${result.totalWatts.toFixed(0)} W. Walls ${result.wallWatts.toFixed(0)} W; windows ${result.windowWatts.toFixed(0)} W.`;
  return (
    <LearningFrame onReset={() => setState(defaultHeatState)}>
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
            <DiagramLabel x={18} y={220}>
              Inside {state.insideC}°C · outside {state.outsideC}°C
            </DiagramLabel>
            <DiagramLabel x={18} y={250}>
              {state.insulationCm} cm insulation
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label} Temperature difference: {result.deltaC.toFixed(0)}°C. Insulation
        slows transfer through the walls; it does not produce heat. A watt is
        one joule transferred each second.
      </Explanation>
      <Control
        label="Insulation (cm)"
        value={state.insulationCm}
        min={0}
        max={20}
        onChange={(insulationCm) => setState({ ...state, insulationCm })}
      />
      <Control
        label="Window area (m²)"
        value={state.windowM2}
        min={2}
        max={18}
        step={2}
        onChange={(windowM2) => setState({ ...state, windowM2 })}
      />
      <Choice
        label="Wall material"
        value={state.material}
        onChange={(material) => setState({ ...state, material })}
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
        onChange={(insideC) => setState({ ...state, insideC })}
      />
      <Control
        label="Outside temperature (°C)"
        value={state.outsideC}
        min={-5}
        max={25}
        onChange={(outsideC) => setState({ ...state, outsideC })}
      />
      <HeatComparisons setState={setState} />
      <ModelNote>
        Steady conduction through walls and windows only. Roof, floor, air
        leaks, sunlight, heating controls, and stored heat are omitted. Positive
        watts mean net transfer out; negative watts mean net transfer in.
        Material values describe this teaching house, not an energy-bill
        estimate.
      </ModelNote>
    </LearningFrame>
  );
}

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
