import { useEffect, useId, useState } from "react";
import {
  CIRCUIT_DEFAULT_INPUTS,
  circuitStateAtPhase,
  normalizeCircuitInputs,
  type CircuitInputs,
  type CircuitMode,
  type CircuitSwitches,
} from "@family-manager/family-api/discovery-models/circuit";
import { Slider } from "./SimulationPrimitives";
import { CircuitDrawing } from "./CircuitDrawing";
import { CircuitEvidenceSummary } from "./circuit/CircuitEvidenceSummary";
import { CircuitPredictionTrials } from "./circuit/CircuitPredictionTrials";
import { useCircuitLesson } from "./circuit/useCircuitLesson";
import { PhysicalStage } from "./physical-exhibits/PhysicalStage";
import "./physical-exhibits/physical-exhibits.css";
import "./circuit/circuit-city.css";

const freshInputs = (): CircuitInputs => ({
  ...CIRCUIT_DEFAULT_INPUTS,
  switches: [...CIRCUIT_DEFAULT_INPUTS.switches],
});

export function CircuitCitySimulation() {
  const modeId = useId();
  const [inputs, setInputs] = useState<CircuitInputs>(freshInputs);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lesson = useCircuitLesson();
  const result = circuitStateAtPhase(inputs, phase);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setPhase((current) => (current + 0.06) % 1),
      240,
    );
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", stopWhenHidden);
  }, []);

  const showTrial = (trial: CircuitInputs) => {
    const normalized = normalizeCircuitInputs(trial);
    setInputs({ ...normalized, switches: [...normalized.switches] });
    setPhase(0);
    setPlaying(false);
  };
  const relockMotion = () => {
    setPhase(0);
    setPlaying(false);
  };
  const reset = () => {
    setInputs(freshInputs());
    setPhase(0);
    setPlaying(false);
    lesson.resetLesson();
  };
  const setMode = (mode: CircuitMode) => {
    setInputs((current) => ({ ...current, mode }));
    setPhase(0);
    setPlaying(false);
  };
  const setVoltage = (sourceVoltageVolts: number) => {
    setInputs((current) => ({ ...current, sourceVoltageVolts }));
    setPhase(0);
    setPlaying(false);
  };
  const toggle = (index: number) => {
    if (!lesson.freeExploration) return;
    setInputs((current) => ({
      ...current,
      switches: current.switches.map((closed, currentIndex) =>
        currentIndex === index ? !closed : closed,
      ) as unknown as CircuitSwitches,
    }));
    setPhase(0);
    setPlaying(false);
  };
  const legacyResult = {
    totalCurrent: result.totalCurrentAmperes,
    houseCurrent: result.houseCurrentAmperes,
    houseVoltage: result.houseVoltageVolts,
    housePower: result.housePowerWatts,
  };
  const description = [
    result.mode +
      " ideal direct-current circuit on a dimensional teaching board.",
    "Source " + result.sourceVoltageVolts.toFixed(1) + " volts.",
    "Total current " +
      result.totalCurrentAmperes.toFixed(2) +
      " amperes and source power " +
      result.sourcePowerWatts.toFixed(1) +
      " watts.",
    result.switches
      .map(
        (closed, index) =>
          "House " +
          (index + 1) +
          " switch " +
          (closed ? "closed" : "open") +
          ", load current " +
          result.houseCurrentAmperes[index].toFixed(2) +
          " amperes, voltage " +
          result.houseVoltageVolts[index].toFixed(1) +
          " volts and power " +
          result.housePowerWatts[index].toFixed(1) +
          " watts",
      )
      .join(". ") + ".",
    "Conventional-current markers are at phase " +
      Math.round(result.visualPhase * 100) +
      " percent; measurements do not depend on marker motion.",
  ].join(" ");

  return (
    <section className="dl-physical dl-circuit">
      <PhysicalStage
        state={{
          kind: "circuit",
          mode: result.mode,
          switches: [...result.switches],
          power: result.housePowerWatts,
          current: result.houseCurrentAmperes,
          voltage: result.sourceVoltageVolts,
          phase: result.visualPhase,
        }}
        onAction={(action) => {
          if (action.type === "switch") toggle(action.index);
        }}
        description={description}
        fallback={
          <CircuitDrawing
            mode={result.mode}
            voltage={result.sourceVoltageVolts}
            switches={[...result.switches]}
            result={legacyResult}
          />
        }
        header={
          <div className="dl-physical-header dl-circuit-header">
            <div>
              <h3>
                {result.mode === "series"
                  ? "One path through three 12 Ω loads"
                  : "Three independent 12 Ω branches"}
              </h3>
              <p>
                Follow the copper paths. Window light is tied to calculated
                power; the readings provide the evidence.
              </p>
            </div>
            <div className="dl-physical-number">
              <strong>
                <output aria-label="Source current">
                  {result.totalCurrentAmperes.toFixed(2)} A
                </output>
              </strong>
              <small>
                {result.sourceVoltageVolts.toFixed(1)} V ideal source ·{" "}
                {result.sourcePowerWatts.toFixed(1)} W
              </small>
            </div>
          </div>
        }
      >
        <div className="dl-physical-strip dl-physical-houses">
          {result.switches.map((closed, index) => (
            <button
              type="button"
              className="dl-physical-house"
              key={index}
              aria-label={"Toggle House " + (index + 1)}
              aria-pressed={closed}
              aria-describedby={modeId + "-house-" + index}
              data-lit={result.housePowerWatts[index] > 0}
              disabled={!lesson.freeExploration}
              onClick={() => toggle(index)}
            >
              <div className="dl-physical-house-heading">
                <strong>House {index + 1}</strong>
                <span>
                  {closed
                    ? result.housePowerWatts[index] > 0
                      ? "CLOSED · ON"
                      : "CLOSED · NO CURRENT"
                    : "OPEN"}
                </span>
              </div>
              <div
                className="dl-physical-house-reading"
                id={modeId + "-house-" + index}
              >
                <output aria-label={"House " + (index + 1) + " current"}>
                  {result.houseCurrentAmperes[index].toFixed(2)} A
                </output>
                <small>
                  {result.houseVoltageVolts[index].toFixed(1)} V ·{" "}
                  {result.housePowerWatts[index].toFixed(1)} W
                </small>
              </div>
            </button>
          ))}
        </div>
      </PhysicalStage>

      <div className="dl-circuit-stage-readouts">
        <div>
          <span>Equivalent resistance</span>
          <strong>
            {result.equivalentResistanceOhms !== null
              ? result.equivalentResistanceOhms.toFixed(1) + " Ω"
              : "Open path"}
          </strong>
        </div>
        <div>
          <span>Source current</span>
          <strong>{result.totalCurrentAmperes.toFixed(2)} A</strong>
        </div>
        <div>
          <span>Source power</span>
          <strong>{result.sourcePowerWatts.toFixed(1)} W</strong>
        </div>
        <div>
          <span>Energy in 10 s</span>
          <strong>{result.sourceEnergyJoules.toFixed(1)} J</strong>
        </div>
      </div>

      <div className="dl-circuit-controls">
        <CircuitPredictionTrials
          lesson={lesson}
          onShowTrial={showTrial}
          onPredictionChange={relockMotion}
        />
        <div className="dl-circuit-explore">
          <strong>
            {lesson.freeExploration
              ? "3 · Explore one variable"
              : "Reset the investigation"}
          </strong>
          {lesson.freeExploration ? (
            <>
              <p>
                Change one input at a time. Compare readings at steady state;
                reset before starting another controlled trial.
              </p>
              <label className="dl-circuit-select-label" htmlFor={modeId}>
                Wiring
              </label>
              <select
                id={modeId}
                value={result.mode}
                onChange={(event) => setMode(event.target.value as CircuitMode)}
              >
                <option value="series">Series · one path</option>
                <option value="parallel">Parallel · three branches</option>
              </select>
              <Slider
                label="Battery voltage"
                value={result.sourceVoltageVolts}
                min={0}
                max={18}
                unit=" V"
                onChange={setVoltage}
              />
              <fieldset className="dl-circuit-switches">
                <legend>House switches</legend>
                {result.switches.map((closed, index) => (
                  <label key={index}>
                    <input
                      type="checkbox"
                      aria-label={"House " + (index + 1) + " switch"}
                      checked={closed}
                      onChange={() => toggle(index)}
                    />
                    House {index + 1} · {closed ? "closed" : "open"}
                  </label>
                ))}
              </fieldset>
              <Slider
                label="Conventional-current marker phase"
                value={Math.round(result.visualPhase * 100)}
                min={0}
                max={100}
                unit="%"
                onChange={(value) => {
                  setPhase(value / 100);
                  setPlaying(false);
                }}
              />
              <div className="dl-circuit-actions">
                <button
                  type="button"
                  onClick={() => setPlaying((current) => !current)}
                >
                  {playing
                    ? "Pause conventional current"
                    : "Play conventional current"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase(0);
                    setPlaying(false);
                  }}
                >
                  Start markers
                </button>
              </div>
              <p className="dl-circuit-motion-note">
                Moving arrows are slowed direction markers, not individual
                charges, drift speed or energy. The phase slider gives the same
                positions without motion.
              </p>
            </>
          ) : (
            <p>
              Reset clears both predictions and restores a 12 V series circuit
              with all switches closed.
            </p>
          )}
          <div className="dl-circuit-actions">
            <button type="button" onClick={reset}>
              Reset lesson
            </button>
          </div>
        </div>
      </div>

      <CircuitEvidenceSummary result={result} />
    </section>
  );
}
