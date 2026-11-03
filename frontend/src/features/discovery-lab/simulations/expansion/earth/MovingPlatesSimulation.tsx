import { useState } from "react";
import {
  advanceFaultLoading,
  defaultPlateState,
  FAULT_SLIP_LIMIT,
  movingPlatesBoundary,
  normalizePlate,
  plateResult,
  type PlateBoundary,
  type PlateState,
} from "@family-manager/family-api/discovery-models/moving-plates";
import { createMovingPlatesScene } from "@family-manager/discovery-scenes/expansion/earth/plates";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { MovingPlatesComparison } from "./MovingPlatesComparison";
import { formatPlateTime, usePlateMotionReplay } from "./usePlateMotionReplay";
import "../mechanics/mechanics.css";
import "./moving-plates.css";

const formatMotion = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 1 });

export function MovingPlatesSimulation() {
  const [state, setState] = useState<PlateState>({ ...defaultPlateState });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const replay = usePlateMotionReplay(state.elapsedMillionYears);
  const visualState = {
    ...state,
    elapsedMillionYears: replay.visualElapsedMillionYears,
  };
  const result = plateResult(visualState);
  const update = (next: PlateState) => {
    replay.cancel();
    setState(normalizePlate(next));
    setComparisonVersion((value) => value + 1);
  };
  const setBoundary = (boundary: PlateBoundary) =>
    update({ ...state, boundary, loadingStep: 0, slips: 0 });
  const loadFault = () => {
    replay.cancel();
    setState((current) => advanceFaultLoading(current));
    setComparisonVersion((value) => value + 1);
  };
  const resetBoundary = () => update({ ...state, loadingStep: 0, slips: 0 });
  const reset = () => update({ ...defaultPlateState });
  const description =
    `${result.summary} Plates move ${result.motion}. ` +
    `${state.rateCmPerYear.toFixed(0)} centimetres per year over ${formatPlateTime(visualState.elapsedMillionYears)} million years gives ${formatMotion(result.relativeMotionKm)} kilometres of relative motion. ` +
    `The plates are lithosphere, which includes crust and rigid uppermost mantle. The asthenosphere below is hot, slowly deforming solid rock. ` +
    `Elastic-loading index ${result.elasticLoadingPercent} percent; ${state.slips} illustrated ${state.slips === 1 ? "slip" : "slips"}. ` +
    "Arrows, labels and the front cutaway identify the motion and materials; scene distances and relief are schematic.";

  return (
    <section className="plates-exhibit">
      <header className="plates-heading">
        <h2>Compare plate boundaries</h2>
        <p>
          Predict first, then compare equal rates and times. Use the motion
          arrows and the lithosphere cutaway to explain each boundary.
        </p>
      </header>
      <ExpansionCanvas
        state={visualState}
        buildScene={createMovingPlatesScene}
        description={description}
        onSelect={state.boundary === "transform" ? loadFault : undefined}
      />
      <div className="plates-motion-toolbar">
        <button
          type="button"
          disabled={state.elapsedMillionYears <= 0 || replay.running}
          onClick={replay.replay}
        >
          {replay.running
            ? "Replaying relative-motion sweep…"
            : "Replay relative-motion sweep"}
        </button>
        {replay.status && (
          <p className="plates-motion-status" role="status">
            {replay.status}
          </p>
        )}
      </div>
      <div className="plates-console">
        <div className="plates-inputs">
          <div>
            <strong>Boundary motion</strong>
            <div
              className="plates-tabs"
              role="group"
              aria-label="Boundary motion"
            >
              {(
                [
                  ["divergent", "Apart"],
                  ["convergent", "Together"],
                  ["transform", "Sideways"],
                ] as const
              ).map(([boundary, label]) => (
                <button
                  type="button"
                  key={boundary}
                  aria-pressed={state.boundary === boundary}
                  onClick={() => setBoundary(boundary)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label="Relative plate rate"
            value={state.rateCmPerYear}
            min={1}
            max={10}
            step={1}
            unit=" cm/yr"
            onChange={(rateCmPerYear) => update({ ...state, rateCmPerYear })}
          />
          <Slider
            label="Elapsed model time"
            value={state.elapsedMillionYears}
            min={0}
            max={5}
            step={0.25}
            unit=" million yr"
            onChange={(elapsedMillionYears) =>
              update({ ...state, elapsedMillionYears })
            }
          />
          {state.boundary === "transform" && (
            <div className="plates-fault-control">
              <strong>Locked-fault illustration</strong>
              <button
                type="button"
                onClick={loadFault}
                disabled={state.slips >= FAULT_SLIP_LIMIT}
              >
                {state.slips >= FAULT_SLIP_LIMIT
                  ? "Slip display limit reached"
                  : "Add one loading step"}
              </button>
              <p>
                The fifth step illustrates a slip. Steps have no time or
                magnitude units.
              </p>
            </div>
          )}
          <div className="plates-reset-row">
            <button type="button" onClick={resetBoundary}>
              Reset this boundary
            </button>
            <button type="button" onClick={reset}>
              Reset lesson
            </button>
          </div>
        </div>
        <div className="plates-results" aria-live="polite" aria-atomic="true">
          <div className="plates-measures">
            <div>
              <span>Relative rate</span>
              <strong>
                {state.rateCmPerYear.toFixed(0)} <small>cm/yr</small>
              </strong>
            </div>
            <div>
              <span>Elapsed model time</span>
              <strong>
                {formatPlateTime(visualState.elapsedMillionYears)}{" "}
                <small>million yr</small>
              </strong>
            </div>
            <div>
              <span>Calculated relative motion</span>
              <strong>
                {formatMotion(result.relativeMotionKm)} <small>km</small>
              </strong>
            </div>
            <div>
              <span>Invented fault loading</span>
              <strong>
                {result.elasticLoadingPercent} <small>%</small>
              </strong>
            </div>
          </div>
          <div
            className="plates-equation"
            aria-label={`${state.rateCmPerYear} centimetres per year times ${formatPlateTime(visualState.elapsedMillionYears)} million years equals ${formatMotion(result.relativeMotionKm)} kilometres of relative motion.`}
          >
            <span>rate</span>
            <b aria-hidden="true">×</b>
            <span>geologic time</span>
            <b aria-hidden="true">→</b>
            <span>relative motion</span>
          </div>
          <h3>{result.feature}</h3>
          <p>{result.summary}</p>
          <p>
            <strong>Crust/lithosphere result:</strong> {result.crustChange}. The
            calculated {formatMotion(result.relativeMotionKm)} km is a
            relative-motion comparison; the drawing is not to that spatial
            scale.
          </p>
          {state.boundary === "transform" && (
            <p>
              Invented elastic-loading index:{" "}
              <strong>{result.elasticLoadingPercent}%</strong>. Illustrated
              slips: <strong>{state.slips}</strong>. The marker bends while the
              fault is locked and gains a schematic offset only on a modeled
              slip.
            </p>
          )}
        </div>
      </div>
      <MovingPlatesComparison
        key={comparisonVersion}
        onApply={(next) => {
          replay.cancel();
          setState(normalizePlate(next));
        }}
      />
      <p className="plates-note">{movingPlatesBoundary}</p>
    </section>
  );
}
