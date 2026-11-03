import { useState } from "react";
import {
  defaultMachineState,
  machineResult,
  normalizeMachine,
  type MachineState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import { machineWorkshopBoundary } from "@family-manager/family-api/discovery-models/machine-workshop";
import { Control, Dot, Line } from "../../Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  ModelNote,
} from "../../LearningPrimitives";
import { MachineComparison } from "./MachineComparison";

export function MachineExploration() {
  const [state, setState] = useState<MachineState>({ ...defaultMachineState });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const update = (next: MachineState) => {
    setState(normalizeMachine(next));
    setComparisonVersion((value) => value + 1);
  };
  const reset = () => {
    setState({ ...defaultMachineState });
    setComparisonVersion((value) => value + 1);
  };
  const result = machineResult(state);
  const arrangement =
    state.mode === "pulley"
      ? `${state.advantage} supporting rope ${state.advantage === 1 ? "section" : "sections"}`
      : state.mode === "lever"
        ? `effort arm divided by load arm ${state.advantage} to 1`
        : `driven teeth divided by driver teeth ${state.advantage} to 1`;
  const advantageLabel =
    state.mode === "pulley"
      ? "Supporting rope sections"
      : state.mode === "lever"
        ? "Effort arm divided by load arm"
        : "Driven teeth divided by driver teeth";
  const label = `${state.mode} ideal lifting model with ${arrangement}. ${result.loadMassKg} kg mass weighs ${result.loadWeightN.toFixed(1)} N. Ideal input force ${result.idealInputForceN.toFixed(1)} N through ${result.inputTravelM.toFixed(2)} m; load rises ${state.liftM.toFixed(1)} m and gains ${result.gravitationalEnergyGainJ.toFixed(1)} J of gravitational energy.`;
  return (
    <LearningFrame onReset={reset} resetLabel="Reset lesson">
      <Diagram
        visualState={{ kind: "machine-workshop", ...state }}
        label={label}
      >
        {(width) => (
          <>
            {state.mode === "pulley" ? (
              <>
                <Line x={30} y={48} x2={width - 30} y2={48} />
                {Array.from({ length: state.advantage }, (_, index) => {
                  const x = width * 0.42 + index * 18;
                  return (
                    <Line
                      key={index}
                      x={x}
                      y={48}
                      x2={x}
                      y2={190 - state.liftM * 70}
                    />
                  );
                })}
              </>
            ) : state.mode === "lever" ? (
              <>
                <Line
                  x={35}
                  y={165 - state.liftM * 45}
                  x2={width - 25}
                  y2={90 + state.liftM * state.advantage * 22}
                />
                <Dot x={width * 0.42} y={130} size={18} color="#8fb0b7" />
              </>
            ) : (
              <>
                <Dot x={width * 0.38} y={75} size={32} color="#b7d4d7" />
                <Dot
                  x={width * 0.58}
                  y={75}
                  size={32 + state.advantage * 14}
                  color="#c99b4f"
                />
                <Line
                  x={width * 0.58}
                  y={110}
                  x2={width * 0.58}
                  y2={190 - state.liftM * 70}
                />
              </>
            )}
            <Dot
              x={width * 0.58}
              y={190 - state.liftM * 70}
              size={36}
              color="#e3ac5c"
            />
            <DiagramLabel x={18} y={224}>
              Position-only fallback · exact values below
            </DiagramLabel>
            <DiagramLabel x={18} y={250}>
              {state.loadKg} kg load · ratio {state.advantage}:1
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {label} Ideal input work is {result.idealInputWorkJ.toFixed(1)} J, equal
        to the load&apos;s energy gain in this model. Less ideal input force
        requires more input travel; the machine does not create energy.
      </Explanation>
      <Choice
        label="Machine type"
        value={state.mode}
        onChange={(mode) => update({ ...state, mode })}
        options={[
          { value: "pulley", label: "Pulley" },
          { value: "lever", label: "Lever" },
          { value: "gears", label: "Gear winch" },
        ]}
      />
      <Control
        label="Load mass (kg)"
        value={state.loadKg}
        min={10}
        max={100}
        step={10}
        onChange={(loadKg) => update({ ...state, loadKg })}
      />
      <Control
        label={advantageLabel}
        value={state.advantage}
        min={1}
        max={4}
        onChange={(advantage) => update({ ...state, advantage })}
      />
      <Control
        label="Lift height (m)"
        value={state.liftM}
        min={0}
        max={1}
        step={0.1}
        onChange={(liftM) => update({ ...state, liftM })}
      />
      {state.mode === "gears" && (
        <Explanation>
          Input torque {result.inputTorqueNm.toFixed(2)} N·m; output torque{" "}
          {result.outputTorqueNm.toFixed(2)} N·m. The input crank turns{" "}
          {result.crankTurns.toFixed(2)} times. Torque uses N·m because it is a
          turning effect; work and energy are reported in J. For this fixed load
          and drum, required output torque stays fixed. At ratio{" "}
          {state.advantage}:1, output torque is {state.advantage} times input
          torque.
        </Explanation>
      )}
      <MachineComparison key={comparisonVersion} onApply={setState} />
      <ModelNote>
        {machineWorkshopBoundary} The rich scene and its ruler use one scene
        unit per metre of load rise. Gear results assume 0.20 m crank and drum
        radii with a perpendicular hand force. If the rich scene is unavailable,
        the simpler diagram is position-only; use the exact values and controls.
        Use the lift-height control to move the apparatus.
      </ModelNote>
    </LearningFrame>
  );
}
