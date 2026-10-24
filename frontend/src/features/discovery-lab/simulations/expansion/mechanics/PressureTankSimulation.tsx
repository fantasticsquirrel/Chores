import { useState } from "react";
import {
  defaultPressureState,
  pressureResult,
  normalizePressure,
  type PressureState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import { createPressureScene } from "@family-manager/discovery-scenes/expansion/mechanics/pressureScene";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import {
  MechanicsComparison,
  type MechanicsExperiment,
} from "./MechanicsComparison";
import "./mechanics.css";
const experiments: readonly MechanicsExperiment<PressureState>[] = [
  {
    title: "Raise the water",
    question:
      "If the surface rises from 1 to 2 m while the outlet stays at 0.5 m, what happens to the tank pressure at that height?",
    choices: [
      "Pressure triples",
      "Pressure doubles",
      "Pressure stays the same",
    ],
    controlled:
      "Keep the narrow tank and outlet height of 0.5 m. Compare water surfaces at 1 and 2 m. Measure the vertical depth below the surface, not the outlet’s height above the floor.",
    before: { ...defaultPressureState, depthM: 1 },
    after: { ...defaultPressureState, depthM: 2 },
    change: "Raise surface to 2 m",
    evidence:
      "Head rises from 0.5 to 1.5 m. Tank gauge pressure triples from 4.905 to 14.715 kPa; ideal jet speed rises from 3.13 to 5.42 m/s, not threefold.",
    explain:
      "Why does tripling head triple the pressure but not the jet speed? Compare the head and speed readouts.",
  },
  {
    title: "Change tank shape",
    question:
      "Will a wider tank send the jet faster at the same water level and outlet height?",
    choices: ["Same speed", "Faster", "Slower"],
    controlled:
      "Keep the surface at 2 m and the outlet at 0.5 m. Change only the tank from narrow to wide. This is an instantaneous comparison, not a timed draining test.",
    before: { ...defaultPressureState, shape: "narrow" },
    after: { ...defaultPressureState, shape: "wide" },
    change: "Use the wide tank",
    evidence:
      "Volume increases from 2,000 to 6,480 liters, but the head remains 1.5 m. Static gauge pressure stays 14.715 kPa and ideal jet speed stays 5.42 m/s.",
    explain:
      "Why can the wider tank hold more water without increasing pressure at the same depth? What would differ if both tanks were allowed to drain?",
  },
];
export function PressureTankSimulation() {
  const [state, setState] = useState<PressureState>({
    ...defaultPressureState,
  });
  const set = <K extends keyof PressureState>(
    key: K,
    value: PressureState[K],
  ) => setState((current) => normalizePressure({ ...current, [key]: value }));
  const r = pressureResult(state);
  const description = `${state.shape} open water tank. Surface ${state.depthM.toFixed(1)} meters above the floor; outlet ${state.outletM.toFixed(1)} meters above the floor. Head ${r.headM.toFixed(1)} meters. Static tank gauge pressure ${(r.pressurePa / 1000).toFixed(3)} kilopascals, ideal jet speed ${r.jetSpeedMps.toFixed(2)} meters per second. Drag the gold water-level marker or use the Water surface height slider.`;
  return (
    <section className="mechanics-exhibit mechanics-pressure">
      <header className="mechanics-heading">
        <h2>Does depth or water volume set the pressure?</h2>
        <p>
          Compare the vertical distance from the water surface to the outlet in
          different tanks.
        </p>
      </header>
      <ExpansionCanvas
        dragSelect
        state={state}
        buildScene={createPressureScene}
        description={description}
        onSelect={(value) => set("depthM", value)}
      />
      <div className="mechanics-console">
        <div className="mechanics-inputs">
          <div className="mechanics-tabs" role="group" aria-label="Tank shape">
            {(["narrow", "wide", "tapered"] as const).map((shape) => (
              <button
                type="button"
                key={shape}
                aria-pressed={shape === state.shape}
                onClick={() => set("shape", shape)}
              >
                {shape === "narrow"
                  ? "Narrow"
                  : shape === "wide"
                    ? "Wide"
                    : "Tapered"}
              </button>
            ))}
          </div>
          <Slider
            label="Water surface height"
            value={state.depthM}
            min={0.2}
            max={3}
            step={0.1}
            unit=" m"
            onChange={(v) => set("depthM", v)}
          />
          <Slider
            label="Outlet height above floor"
            value={state.outletM}
            min={0.1}
            max={2.5}
            step={0.1}
            unit=" m"
            onChange={(v) => set("outletM", v)}
          />
          <p className="mechanics-control-note">
            Both heights start at the tank floor. Head is the outlet’s depth
            below the surface, not its height above the floor.
          </p>
          <button
            className="mechanics-reset"
            type="button"
            onClick={() => setState({ ...defaultPressureState })}
          >
            Reset tank
          </button>
        </div>
        <div
          className="mechanics-results"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="mechanics-measures">
            <div>
              <span>Static tank gauge pressure</span>
              <strong>
                {(r.pressurePa / 1000).toFixed(3)} <small>kPa</small>
              </strong>
            </div>
            <div>
              <span>Ideal outlet speed</span>
              <strong>
                {r.jetSpeedMps.toFixed(2)} <small>m/s</small>
              </strong>
            </div>
          </div>
          <p>
            <strong>{r.headM.toFixed(1)} m head</strong> = surface height minus
            outlet height, when the outlet is underwater. Tank volume:{" "}
            {r.volumeLiters.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            L.
          </p>
          <p>
            {r.headM > 0
              ? `The predicted horizontal range is ${r.rangeM.toFixed(2)} m from the nozzle to floor level. Lower outlets have more head but less falling time; the deepest outlet need not throw water farthest.`
              : "The outlet is at or above the water surface. There is no outward water jet and no positive water gauge pressure there."}
          </p>
          <p>
            Gauge pressure is pressure above the surrounding air pressure. The
            tank reading is static pressure at the outlet’s height, not pressure
            inside the emerging free jet, which is approximately atmospheric.
          </p>
        </div>
      </div>
      <MechanicsComparison experiments={experiments} onApply={setState} />
      <details className="mechanics-details">
        <summary>What sets pressure and speed?</summary>
        <p>
          Static gauge pressure = water density × gravitational acceleration ×
          head. Water density is 1,000 kg/m³ and gravitational acceleration is
          9.81 m/s² here. Ideal jet speed = √(2 × gravitational acceleration ×
          head). Pressure grows directly with head; speed grows with its square
          root.
        </p>
      </details>
      <p className="mechanics-note">
        Open tanks and a small horizontal outlet; water is treated as
        incompressible. Each view is an instantaneous snapshot with the level
        held fixed, not an animated draining forecast. Friction, viscosity,
        turbulence, air drag and outlet contraction are omitted. Shape changes
        volume and how the level would fall over time, not static pressure at
        equal head.
      </p>
    </section>
  );
}
