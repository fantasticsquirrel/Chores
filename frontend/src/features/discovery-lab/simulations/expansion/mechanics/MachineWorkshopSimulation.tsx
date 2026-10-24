import { useState } from "react";
import {
  defaultMachineState,
  machineResult,
  normalizeMachine,
  type MachineState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import { createMachineScene } from "@family-manager/discovery-scenes/expansion/mechanics/machineScene";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import {
  MechanicsComparison,
  type MechanicsExperiment,
} from "./MechanicsComparison";
import "./mechanics.css";
const experiments: readonly MechanicsExperiment<MachineState>[] = [
  {
    title: "Rope sections",
    question:
      "With two supporting rope sections instead of one, what happens to the pulling force?",
    choices: ["Less force", "Same force", "More force"],
    controlled:
      "Keep the load at 40 kg and lift it 0.5 m. Compare one supporting section with two. Count the sections lifting the moving load, not the wheels.",
    before: { ...defaultMachineState, advantage: 1 },
    after: { ...defaultMachineState, advantage: 2 },
    change: "Use two sections",
    evidence:
      "Pulling force falls from 392.4 N to 196.2 N; rope pulled increases from 0.5 m to 1.0 m. Input and output work are both 196.2 J.",
    explain:
      "Why must you pull farther when less force lifts the same load through the same height? Use force × distance as evidence.",
  },
  {
    title: "Gear turns",
    question:
      "What happens to the number of crank turns when a 12-tooth driver turns a 48-tooth gear instead of a 12-tooth gear?",
    choices: ["More turns", "Same turns", "Fewer turns"],
    controlled:
      "Keep the load at 40 kg and lift at 0.5 m. Both the crank and rope drum have a 0.2 m radius. Change only the driven gear tooth count.",
    before: { ...defaultMachineState, mode: "gears", advantage: 1 },
    after: { ...defaultMachineState, mode: "gears", advantage: 4 },
    change: "Use 48 driven teeth",
    evidence:
      "Crank turns increase from 0.40 to 1.59; input torque falls from 78.48 to 19.62 N·m. Output torque stays at 78.48 N·m, and work stays at 196.2 J.",
    explain:
      "Torque is a turning effect. Why does a larger driven gear turn less per input turn while providing greater output torque than input torque?",
  },
];
export function MachineWorkshopSimulation() {
  const [state, setState] = useState<MachineState>({ ...defaultMachineState });
  const set = <K extends keyof MachineState>(key: K, value: MachineState[K]) =>
    setState((current) => normalizeMachine({ ...current, [key]: value }));
  const r = machineResult(state),
    description = `${state.mode} lifting model. Load ${state.loadKg} kg. Mechanical advantage ${r.ratio}. Input force ${r.inputForceN.toFixed(1)} newtons over ${r.inputDistanceM.toFixed(2)} meters; load rises ${state.liftM.toFixed(1)} meters. Input and output work ${r.outputWorkJ.toFixed(1)} joules. Drag the gold lift marker or use the Lift height slider.`;
  return (
    <section className="mechanics-exhibit mechanics-machine">
      <header className="mechanics-heading">
        <h2>Can less force lift the same load?</h2>
        <p>
          Compare a pulley, lever and gear-driven winch. Less effort force
          trades for more effort distance.
        </p>
      </header>
      <ExpansionCanvas
        dragSelect
        state={state}
        buildScene={createMachineScene}
        description={description}
        onSelect={(value) => set("liftM", value)}
      />
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
          <button
            type="button"
            className="mechanics-reset"
            onClick={() => setState({ ...defaultMachineState })}
          >
            Reset machine
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
                  ? "Tangential crank force"
                  : state.mode === "lever"
                    ? "Downward effort force"
                    : "Pulling force"}
              </span>
              <strong>
                {r.inputForceN.toFixed(1)} <small>N</small>
              </strong>
            </div>
            <div>
              <span>
                {state.mode === "gears"
                  ? "Crank-hand travel"
                  : state.mode === "lever"
                    ? "Vertical effort travel"
                    : "Rope pulled"}
              </span>
              <strong>
                {r.inputDistanceM.toFixed(2)} <small>m</small>
              </strong>
            </div>
          </div>
          <p>
            The load weighs {r.loadForceN.toFixed(1)} N. Its mass stays{" "}
            {state.loadKg} kg; the machine changes the required effort, not the
            load’s weight.
          </p>
          {state.mode === "gears" && (
            <p>
              <strong>{r.crankTurns.toFixed(2)} crank turns</strong> ·{" "}
              {r.inputTorqueNm.toFixed(2)} N·m input torque →{" "}
              {r.outputTorqueNm.toFixed(2)} N·m output torque.
            </p>
          )}
          <div className="mechanics-work">
            <span>Input work: {r.inputWorkJ.toFixed(1)} J</span>
            <span>Output work: {r.outputWorkJ.toFixed(1)} J</span>
            <div className="mechanics-work-line" />
          </div>
          <p>
            Work is force × distance in the force’s direction. At zero lift,
            balancing the load still takes force, but no displacement means no
            lifting work.
          </p>
        </div>
      </div>
      <MechanicsComparison experiments={experiments} onApply={setState} />
      <p className="mechanics-note">
        Ideal, slow lifting: no friction, rope stretch or machine mass. Real
        machines need extra input work. Gear torque = force × radius; crank and
        drum radii are both 0.2 m. Lever arms and travel are shown at a reduced
        drawing scale. This is not a lifting-equipment design.
      </p>
    </section>
  );
}
