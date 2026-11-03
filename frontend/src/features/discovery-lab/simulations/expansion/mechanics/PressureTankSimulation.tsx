import { useState } from "react";
import {
  defaultPressureState,
  normalizePressure,
  pressureResult,
  pressureTankBoundary,
  pressureTankTrials,
  type PressureState,
} from "@family-manager/family-api/discovery-models/pressure-tank";
import { createPressureScene } from "@family-manager/discovery-scenes/expansion/mechanics/pressureScene";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { MechanicsComparison } from "./MechanicsComparison";
import { usePressureHeadReplay } from "./usePressureHeadReplay";
import "./mechanics.css";

const formatLiters = (liters: number) =>
  liters.toLocaleString(undefined, { maximumFractionDigits: 0 });

export function PressureTankSimulation() {
  const [state, setState] = useState<PressureState>({
    ...defaultPressureState,
  });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const replay = usePressureHeadReplay(state.depthM, state.outletM);
  const set = <K extends keyof PressureState>(
    key: K,
    value: PressureState[K],
  ) => {
    replay.cancel();
    setState((current) => normalizePressure({ ...current, [key]: value }));
    setComparisonVersion((current) => current + 1);
  };
  const reset = () => {
    replay.cancel();
    setState({ ...defaultPressureState });
    setComparisonVersion((current) => current + 1);
  };
  const applyGuidedState = (next: PressureState) => {
    replay.cancel();
    setState(normalizePressure(next));
  };
  const visualState = { ...state, depthM: replay.visualSurfaceM };
  const result = pressureResult(visualState);
  const description =
    `${state.shape} open water tank in a dimensional hydraulics lab. ` +
    `Surface ${visualState.depthM.toFixed(1)} metres and horizontal outlet ${state.outletM.toFixed(1)} metres above the floor; head ${result.headM.toFixed(1)} metres. ` +
    `The separate closed wall sensor at outlet height has calculated gauge pressure ${(result.gaugePressurePa / 1_000).toFixed(3)} kilopascals and absolute pressure ${(result.absolutePressurePa / 1_000).toFixed(3)} kilopascals. ` +
    `Its net force is ${result.sensorNetForceN.toFixed(2)} newtons on 100 square centimetres because its back face is exposed to atmosphere. ` +
    `A dark insulated electrical cable carries its signal to the remote gauge display; it is not a liquid pressure line. ` +
    `Ideal outlet speed ${result.jetSpeedMps.toFixed(2)} metres per second and floor-level range ${result.rangeM.toFixed(2)} metres. ` +
    `Tank volume ${formatLiters(result.volumeLiters)} litres. Drag the gold surface marker or use the Water surface height slider; exact visual callouts are repeated in text.`;

  return (
    <section className="mechanics-exhibit mechanics-pressure">
      <header className="mechanics-heading">
        <span className="mechanics-model-state">Open-water ideal model</span>
        <h2>Test pressure on a wall sensor</h2>
        <p>
          The closed sensor and separate nozzle share a height. Predict first,
          change one input, then compare pressure and the free jet.
        </p>
      </header>
      <ExpansionCanvas
        dragSelect
        state={visualState}
        buildScene={createPressureScene}
        description={description}
        onSelect={(value) => set("depthM", value)}
      />
      <div className="mechanics-motion-toolbar">
        <button
          type="button"
          className="mechanics-motion"
          disabled={result.headM <= 0 || replay.running}
          onClick={replay.replay}
        >
          {replay.running ? "Replaying pressure rise…" : "Replay pressure rise"}
        </button>
        {replay.status && (
          <p className="mechanics-motion-status" role="status">
            {replay.status}
          </p>
        )}
      </div>
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
            onChange={(value) => set("depthM", value)}
          />
          <Slider
            label="Outlet height above floor"
            value={state.outletM}
            min={0.1}
            max={2.5}
            step={0.1}
            unit=" m"
            onChange={(value) => set("outletM", value)}
          />
          <p className="mechanics-control-note">
            Both heights start at the tank floor. Head is surface height minus
            outlet height when the outlet is underwater.
          </p>
          <button className="mechanics-reset" type="button" onClick={reset}>
            Reset lesson
          </button>
        </div>
        <div
          className="mechanics-results"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="mechanics-measures mechanics-pressure-measures">
            <div>
              <span>Water head</span>
              <strong>
                {result.headM.toFixed(1)} <small>m</small>
              </strong>
            </div>
            <div>
              <span>Wall-sensor gauge pressure</span>
              <strong>
                {(result.gaugePressurePa / 1_000).toFixed(3)} <small>kPa</small>
              </strong>
            </div>
            <div>
              <span>Net force on 100 cm²</span>
              <strong>
                {result.sensorNetForceN.toFixed(2)} <small>N</small>
              </strong>
            </div>
            <div>
              <span>Ideal outlet speed</span>
              <strong>
                {result.jetSpeedMps.toFixed(2)} <small>m/s</small>
              </strong>
            </div>
          </div>
          <div
            className="mechanics-pressure-equation"
            aria-label={`Head ${result.headM.toFixed(1)} metres gives ${(result.gaugePressurePa / 1_000).toFixed(3)} kilopascals gauge pressure and ${result.sensorNetForceN.toFixed(2)} newtons net force on the fixed sensor area.`}
          >
            <span>head h</span>
            <b aria-hidden="true">→</b>
            <span>gauge pressure ρgh</span>
            <b aria-hidden="true">→</b>
            <span>net force = gauge pressure × area</span>
          </div>
          <p>
            Gauge pressure is above the surrounding air pressure. Here it is{" "}
            <strong>{(result.gaugePressurePa / 1_000).toFixed(3)} kPa</strong>;
            adding the fixed 101.325 kPa atmosphere gives{" "}
            <strong>
              {(result.absolutePressurePa / 1_000).toFixed(3)} kPa absolute
            </strong>
            . Because the closed sensor's opposite face is exposed to that
            atmosphere, its net force is{" "}
            <strong>{result.sensorNetForceN.toFixed(1)} N on 100 cm²</strong>.
            The dark insulated cable carries an electrical sensor signal to the
            remote display; it is not a liquid-filled pressure line.
          </p>
          <p>
            {result.outletSubmerged
              ? `The ideal horizontal jet starts at ${result.jetSpeedMps.toFixed(2)} m/s and reaches floor level ${result.rangeM.toFixed(2)} m from the nozzle. Outlet height sets fall time as head sets speed, so the lowest outlet need not give the longest range.`
              : "The sensor and outlet are at or above the water surface. The model gives zero positive water gauge pressure, sensor net force, ideal jet speed and range there."}
          </p>
          <p>
            {state.shape[0].toUpperCase() + state.shape.slice(1)} tank volume at
            this level: <strong>{formatLiters(result.volumeLiters)} L</strong>.
            Volume changes with shape; equal head keeps pressure and ideal speed
            unchanged. The nozzle is separate from the wall sensor; its emerging
            free jet is approximately at atmospheric pressure.
          </p>
        </div>
      </div>
      <MechanicsComparison
        key={comparisonVersion}
        experiments={pressureTankTrials}
        onApply={applyGuidedState}
      />
      <p className="mechanics-note">{pressureTankBoundary}</p>
    </section>
  );
}
