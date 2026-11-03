import { useState } from "react";
import {
  defaultMachineState,
  machineResult,
  normalizeMachine,
  type MachineState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import {
  machineWorkshopBoundary,
  machineWorkshopTrials,
} from "@family-manager/family-api/discovery-models/machine-workshop";
import { createMachineScene } from "@family-manager/discovery-scenes/expansion/mechanics/machineScene";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { MechanicsComparison } from "./MechanicsComparison";
import { useMachineLiftReplay } from "./useMachineLiftReplay";
import "./mechanics.css";
export function MachineWorkshopSimulation() {
  const [state, setState] = useState<MachineState>({ ...defaultMachineState });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const liftReplay = useMachineLiftReplay(state.liftM);
  const set = <K extends keyof MachineState>(
    key: K,
    value: MachineState[K],
  ) => {
    liftReplay.cancel();
    setState((current) => normalizeMachine({ ...current, [key]: value }));
    setComparisonVersion((current) => current + 1);
  };
  const reset = () => {
    liftReplay.cancel();
    setState({ ...defaultMachineState });
    setComparisonVersion((value) => value + 1);
  };
  const applyGuidedState = (next: MachineState) => {
    liftReplay.cancel();
    setState(normalizeMachine(next));
  };
  const visualState = { ...state, liftM: liftReplay.visualLiftM };
  const r = machineResult(state),
    description = `${state.mode} ideal lifting model. Load mass ${r.loadMassKg} kilograms; weight ${r.loadWeightN.toFixed(1)} newtons. Ideal mechanical advantage ${r.ratio}. Input force ${r.idealInputForceN.toFixed(1)} newtons through ${r.inputTravelM.toFixed(2)} meters; load rises ${state.liftM.toFixed(1)} meters and gains ${r.gravitationalEnergyGainJ.toFixed(1)} joules of gravitational energy. Drag the gold lift marker or use the Lift height slider.`;
  return (
    <section className="mechanics-exhibit mechanics-machine">
      <header className="mechanics-heading">
        <span className="mechanics-model-state">Ideal lifting model</span>
        <h2>Test the force–distance trade-off</h2>
        <p>
          Predict first, change one ratio, then compare force, travel and energy
          for the same load and lift.
        </p>
      </header>
      <ExpansionCanvas
        dragSelect
        state={visualState}
        buildScene={createMachineScene}
        description={description}
        onSelect={(value) => set("liftM", value)}
      />
      <div className="mechanics-motion-toolbar">
        <button
          type="button"
          className="mechanics-motion"
          disabled={state.liftM <= 0 || liftReplay.running}
          onClick={liftReplay.replay}
        >
          {liftReplay.running ? "Replaying lift…" : "Replay lift"}
        </button>
        {liftReplay.status && (
          <p className="mechanics-motion-status" role="status">
            {liftReplay.status}
          </p>
        )}
      </div>
      <div className="mechanics-console">
        <div className="mechanics-inputs">
          <div
            className="mechanics-tabs"
            role="group"
            aria-label="Machine type"
          >
            {(["pulley", "lever", "gears"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                aria-pressed={state.mode === mode}
                onClick={() => set("mode", mode)}
              >
                {mode === "gears"
                  ? "Gear winch"
                  : mode === "lever"
                    ? "Lever"
                    : "Pulley"}
              </button>
            ))}
          </div>
          <Slider
            label={
              state.mode === "pulley"
                ? "Supporting rope sections"
                : state.mode === "lever"
                  ? "Effort arm ÷ load arm"
                  : "Driven teeth ÷ driver teeth"
            }
            value={state.advantage}
            min={1}
            max={4}
            onChange={(v) => set("advantage", v)}
          />
          <Slider
            label="Load mass"
            value={state.loadKg}
            min={10}
            max={100}
            step={10}
            unit=" kg"
            onChange={(v) => set("loadKg", v)}
          />
          <Slider
            label="Lift height"
            value={state.liftM}
            min={0}
            max={1}
            step={0.1}
            unit=" m"
            onChange={(v) => set("liftM", v)}
          />
          <button type="button" className="mechanics-reset" onClick={reset}>
            Reset lesson
          </button>
        </div>
        <div
          className="mechanics-results"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="mechanics-measures">
            <div>
              <span>
                {state.mode === "gears"
                  ? "Ideal hand force"
                  : state.mode === "lever"
                    ? "Ideal effort force"
                    : "Ideal pulling force"}
              </span>
              <strong>
                {r.inputForceN.toFixed(1)} <small>N</small>
              </strong>
            </div>
            <div>
              <span>
                {state.mode === "gears"
                  ? "Hand travel"
                  : state.mode === "lever"
                    ? "Effort travel"
                    : "Rope pulled"}
              </span>
              <strong>
                {r.inputDistanceM.toFixed(2)} <small>m</small>
              </strong>
            </div>
          </div>
          <p>
            <strong>{r.loadMassKg} kg mass</strong> has a{" "}
            {r.loadWeightN.toFixed(1)} N weight in this model. The machine
            changes the ideal input force, not the mass or weight.
          </p>
          {state.mode === "gears" && (
            <p>
              <strong>{r.crankTurns.toFixed(2)} input crank turns</strong> ·{" "}
              {r.inputTorqueNm.toFixed(2)} N·m input torque →{" "}
              {r.outputTorqueNm.toFixed(2)} N·m output torque. Torque uses N·m
              because it is a turning effect; work and energy are reported in J.
            </p>
          )}
          <div className="mechanics-work" aria-label="Ideal energy accounting">
            <span>Ideal input work: {r.idealInputWorkJ.toFixed(1)} J</span>
            <span aria-hidden="true">=</span>
            <span>
              Gravitational energy gained:{" "}
              {r.gravitationalEnergyGainJ.toFixed(1)} J
            </span>
            <div className="mechanics-work-line" aria-hidden="true" />
          </div>
          <p>
            One joule (J) is one newton-metre of work. At zero lift, balancing
            still takes force, but zero displacement means zero lifting work and
            zero gravitational energy gain.
          </p>
        </div>
      </div>
      <MechanicsComparison
        key={comparisonVersion}
        experiments={machineWorkshopTrials}
        onApply={applyGuidedState}
      />
      <p className="mechanics-note">
        {machineWorkshopBoundary} In this model, the hand pushes at a right
        angle to the 0.20 m crank, so input torque is hand force × 0.20 m. The
        drum radius is also 0.20 m. The ruler and every load use one scene unit
        per metre of vertical rise; lever effort travel follows the shown arm
        ratio.
      </p>
    </section>
  );
}
