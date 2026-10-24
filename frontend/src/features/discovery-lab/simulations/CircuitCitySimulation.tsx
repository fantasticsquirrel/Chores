import { useId, useState } from "react";
import {
  circuit,
  type CircuitMode,
} from "@family-manager/family-api/discovery-models/physical-world";
import { Slider } from "./SimulationPrimitives";
import { CircuitDrawing } from "./CircuitDrawing";
import {
  PhysicalLayout,
  PhysicalStage,
} from "./physical-exhibits/PhysicalStage";
import "./physical-exhibits/physical-exhibits.css";
export function CircuitCitySimulation() {
  const modeId = useId(),
    [mode, setMode] = useState<CircuitMode>("series"),
    [voltage, setVoltage] = useState(12),
    [switches, setSwitches] = useState([true, true, true]);
  const result = circuit(mode, voltage, switches);
  const toggle = (index: number) =>
    setSwitches((current) => current.map((on, i) => (i === index ? !on : on)));
  return (
    <PhysicalLayout
      question="Predict what will happen when House 2’s switch opens. Test it in series, then change to parallel without changing the battery or switches. Which houses still receive energy?"
      explanation={
        mode === "series"
          ? "One complete path carries the same current through all three loads. Battery voltage is shared between them. Opening any switch interrupts the whole path; charge is not used up in a house."
          : "Each parallel branch is a complete path across the battery. Opening one branch leaves the other paths intact. Every closed branch receives the full battery voltage; branch currents add at the battery."
      }
      caveat="Each house represents a fixed 12 Ω resistor and one switch. Ideal battery and wires; window glow follows relative electrical power. Arrows indicate conventional current. Charge is conserved while the battery transfers energy. Real homes use parallel AC wiring with protective devices, not this low-voltage model."
      controls={
        <>
          <div className="dl-physical-control-group">
            <div>
              <label className="dl-physical-select-label" htmlFor={modeId}>
                Wiring
              </label>
              <select
                id={modeId}
                value={mode}
                onChange={(event) => setMode(event.target.value as CircuitMode)}
              >
                <option value="series">Series · one path</option>
                <option value="parallel">Parallel · three paths</option>
              </select>
            </div>
            <Slider
              label="Battery voltage"
              value={voltage}
              min={0}
              max={18}
              unit=" V"
              onChange={setVoltage}
            />
          </div>
          <fieldset className="dl-physical-switches">
            <legend>Close a switch to connect it</legend>
            {switches.map((on, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  aria-label={`House ${i + 1} switch`}
                  checked={on}
                  onChange={() => toggle(i)}
                />
                House {i + 1} · {on ? "closed" : "open"}
              </label>
            ))}
          </fieldset>
          <div className="dl-physical-control-group">
            <div className="dl-physical-number">
              <strong>{(voltage * result.totalCurrent).toFixed(1)} W</strong>
              <small>power supplied by the {voltage} V battery</small>
            </div>
            <div className="dl-actions">
              <button
                type="button"
                onClick={() => {
                  setMode("series");
                  setVoltage(12);
                  setSwitches([true, true, true]);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </>
      }
      readout={
        <>
          <span>
            Battery current: <strong>{result.totalCurrent.toFixed(2)} A</strong>
          </span>
          <span>
            Each load: <strong>12 Ω</strong>
          </span>
          <span>I = V ÷ R · Power = V × I</span>
          <span>
            {mode === "parallel"
              ? `${result.houseCurrent.map((value) => value.toFixed(2)).join(" + ")} = ${result.totalCurrent.toFixed(2)} A at the battery`
              : result.totalCurrent > 0
                ? `${result.houseVoltage.map((value) => value.toFixed(1)).join(" + ")} = ${voltage.toFixed(1)} V across the loads`
                : "Open path: no current anywhere in the series loop."}
          </span>
        </>
      }
    >
      <PhysicalStage
        state={{
          kind: "circuit",
          mode,
          switches,
          power: result.housePower,
          current: result.houseCurrent,
          voltage,
        }}
        onAction={(action) => {
          if (action.type === "switch") toggle(action.index);
        }}
        description={`${mode} circuit town connected by visible wires to a ${voltage} volt battery. ${switches.map((on, i) => `House ${i + 1} switch ${on ? "closed" : "open"}, current ${result.houseCurrent[i].toFixed(2)} amperes`).join(". ")}. Click a switch or use the matching labeled controls.`}
        fallback={
          <CircuitDrawing
            mode={mode}
            voltage={voltage}
            switches={switches}
            result={result}
          />
        }
        header={
          <div className="dl-physical-header">
            <div>
              <h3>
                {mode === "series"
                  ? "One path through three loads"
                  : "Three independent paths"}
              </h3>
              <p>
                Click a switch or house to open its connection. Follow the wires
                back to the battery.
              </p>
            </div>
            <div className="dl-physical-number">
              <strong>{result.totalCurrent.toFixed(2)} A</strong>
              <small>current from the battery</small>
            </div>
          </div>
        }
      >
        <div className="dl-physical-strip dl-physical-houses">
          {switches.map((on, i) => (
            <button
              type="button"
              className="dl-physical-house"
              key={i}
              aria-label={`Toggle House ${i + 1}`}
              aria-pressed={on}
              aria-describedby={`${modeId}-house-${i}`}
              data-lit={result.housePower[i] > 0}
              onClick={() => toggle(i)}
            >
              <div className="dl-physical-house-heading">
                <strong>House {i + 1}</strong>
                <span>
                  {on
                    ? result.housePower[i] > 0
                      ? "CLOSED · ON"
                      : "CLOSED · NO CURRENT"
                    : "OPEN"}
                </span>
              </div>
              <div
                className="dl-physical-house-reading"
                id={`${modeId}-house-${i}`}
              >
                <output aria-label={`House ${i + 1} current`}>
                  {result.houseCurrent[i].toFixed(2)} A
                </output>
                <small>
                  {result.houseVoltage[i].toFixed(1)} V ·{" "}
                  {result.housePower[i].toFixed(1)} W
                </small>
              </div>
            </button>
          ))}
        </div>
      </PhysicalStage>
    </PhysicalLayout>
  );
}
