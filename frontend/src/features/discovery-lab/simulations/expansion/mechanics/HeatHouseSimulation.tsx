import { useState } from "react";
import {
  defaultHeatState,
  heatHouseBoundary,
  heatHouseTrials,
  heatResult,
  heatWallMaterials,
  normalizeHeat,
  type HeatState,
} from "@family-manager/family-api/discovery-models/heat-house";
import { createHeatScene } from "@family-manager/discovery-scenes/expansion/mechanics/heatScene";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { MechanicsComparison } from "./MechanicsComparison";
import { useHeatTransferReplay } from "./useHeatTransferReplay";
import "./mechanics.css";

const formatHours = (hours: number) =>
  Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1);

export function HeatHouseSimulation() {
  const [state, setState] = useState<HeatState>({ ...defaultHeatState });
  const [comparisonVersion, setComparisonVersion] = useState(0);
  const replay = useHeatTransferReplay(state.elapsedHours);
  const set = <K extends keyof HeatState>(key: K, value: HeatState[K]) => {
    replay.cancel();
    setState((current) => normalizeHeat({ ...current, [key]: value }));
    setComparisonVersion((current) => current + 1);
  };
  const reset = () => {
    replay.cancel();
    setState({ ...defaultHeatState });
    setComparisonVersion((current) => current + 1);
  };
  const applyGuidedState = (next: HeatState) => {
    replay.cancel();
    setState(normalizeHeat(next));
  };
  const visualState = { ...state, elapsedHours: replay.visualHours };
  const result = heatResult(visualState);
  const magnitudeWatts = Math.abs(result.totalWatts);
  const magnitudeKWh = Math.abs(result.totalEnergyKWh);
  const magnitudeMJ = Math.abs(result.totalEnergyJ) / 1_000_000;
  const direction =
    result.direction === "outward"
      ? "out of the house"
      : result.direction === "inward"
        ? "into the house"
        : "with no net direction";
  const wallShare =
    magnitudeWatts > 0
      ? (Math.abs(result.wallWatts) / magnitudeWatts) * 100
      : 0;
  const description =
    "Dimensional cutaway teaching house. " +
    state.insulationCm +
    " centimeters of added wall insulation and " +
    state.windowM2 +
    " square meters of windows. Indoor temperature held at " +
    state.insideC +
    " degrees Celsius and outdoor temperature held at " +
    state.outsideC +
    ". Signed outward heat-transfer power: walls " +
    result.wallWatts.toFixed(0) +
    " watts, windows " +
    result.windowWatts.toFixed(0) +
    " watts, combined " +
    result.totalWatts.toFixed(0) +
    " watts. Over " +
    formatHours(replay.visualHours) +
    " hours, " +
    magnitudeKWh.toFixed(2) +
    " kilowatt-hours transfer " +
    direction +
    ". Use the insulation slider or thickness marker; authored callouts repeat every visual result in text.";

  return (
    <section className="mechanics-exhibit mechanics-heat">
      <header className="mechanics-heading">
        <span className="mechanics-model-state">Steady-temperature model</span>
        <h2>Compare heat-transfer paths</h2>
        <p>
          Predict first, change one wall or window input, then compare power and
          energy for equal elapsed time.
        </p>
      </header>
      <ExpansionCanvas
        dragSelect
        state={visualState}
        buildScene={createHeatScene}
        description={description}
        onSelect={(value) => set("insulationCm", value)}
      />
      <div className="mechanics-motion-toolbar">
        <button
          type="button"
          className="mechanics-motion"
          disabled={state.elapsedHours <= 0 || replay.running}
          onClick={replay.replay}
        >
          {replay.running
            ? "Replaying energy transfer…"
            : "Replay energy transfer"}
        </button>
        {replay.status && (
          <p className="mechanics-motion-status" role="status">
            {replay.status}
          </p>
        )}
      </div>
      <div className="mechanics-console">
        <div className="mechanics-inputs">
          <label className="mechanics-select">
            Base wall material
            <select
              value={state.material}
              onChange={(event) =>
                set("material", event.target.value as HeatState["material"])
              }
            >
              {(["brick", "wood", "insulation"] as const).map((key) => (
                <option key={key} value={key}>
                  {heatWallMaterials[key].label}
                </option>
              ))}
            </select>
          </label>
          <Slider
            label="Added insulation"
            value={state.insulationCm}
            min={0}
            max={20}
            unit=" cm"
            onChange={(value) => set("insulationCm", value)}
          />
          <Slider
            label="Window area"
            value={state.windowM2}
            min={2}
            max={18}
            unit=" m²"
            onChange={(value) => set("windowM2", value)}
          />
          <div className="mechanics-temperature">
            <Slider
              label="Indoor temperature"
              value={state.insideC}
              min={16}
              max={24}
              unit="°C"
              onChange={(value) => set("insideC", value)}
            />
            <Slider
              label="Outdoor temperature"
              value={state.outsideC}
              min={-5}
              max={25}
              unit="°C"
              onChange={(value) => set("outsideC", value)}
            />
          </div>
          <Slider
            label="Elapsed time"
            value={state.elapsedHours}
            min={0}
            max={24}
            unit=" h"
            onChange={(value) => set("elapsedHours", value)}
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
          <div className="mechanics-measures mechanics-heat-measures">
            <div>
              <span>Opaque-wall power</span>
              <strong>
                {result.wallWatts.toFixed(0)} <small>W</small>
              </strong>
            </div>
            <div>
              <span>Window power</span>
              <strong>
                {result.windowWatts.toFixed(0)} <small>W</small>
              </strong>
            </div>
            <div>
              <span>Combined power</span>
              <strong>
                {result.totalWatts.toFixed(0)} <small>W</small>
              </strong>
            </div>
          </div>
          <div className="mechanics-heatbar" aria-hidden="true">
            <span style={{ width: wallShare + "%" }} />
            <i
              style={{
                width:
                  (magnitudeWatts === 0 ? 0 : 100 - wallShare).toFixed(2) + "%",
              }}
            />
          </div>
          <div className="mechanics-energy-total">
            <span>
              Energy transferred over {formatHours(replay.visualHours)} h
            </span>
            <strong>
              {magnitudeKWh.toFixed(2)} kWh{" "}
              <small>({magnitudeMJ.toFixed(2)} MJ)</small>
            </strong>
          </div>
          <p>
            At a steady <strong>{magnitudeWatts.toFixed(0)} W</strong>, thermal
            energy transfers {direction}. Power is energy each second: 1 W = 1
            J/s. Energy accumulates with time: 1 kWh = 3.6 MJ.
          </p>
          <p>
            {result.wallAreaM2} m² opaque wall + {result.windowAreaM2} m²
            windows = 60 m². Signed values are outward; negative values mean
            transfer inward.
          </p>
          <p>
            {result.deltaC === 0
              ? "Equal indoor and outdoor temperatures give zero net transfer in this model, so elapsed energy also stays zero."
              : "The temperature difference is " +
                Math.abs(result.deltaK) +
                " K (the same size as " +
                Math.abs(result.deltaC) +
                "°C). Insulation raises resistance; it does not generate thermal energy."}
          </p>
        </div>
      </div>
      <MechanicsComparison
        key={comparisonVersion}
        experiments={heatHouseTrials}
        onApply={applyGuidedState}
      />
      <details className="mechanics-details">
        <summary>Read the model equation and heat-transfer paths</summary>
        <p>
          Heat-transfer power = U × area × temperature difference. U describes a
          whole assembly in W/(m²·K). This wall U-factor is{" "}
          {result.wallU.toFixed(2)} W/(m²·K); the teaching window U-factor is{" "}
          {result.windowU.toFixed(1)} W/(m²·K). Lower U means less transfer for
          the same area and temperature difference.
        </p>
        <p>
          Conduction transfers energy through materials, convection transfers
          energy with moving fluids such as air, and radiation transfers energy
          by electromagnetic waves. The fixed U-factors lump assembly effects
          together; this model does not calculate the three mechanisms
          separately.
        </p>
      </details>
      <p className="mechanics-note">{heatHouseBoundary}</p>
    </section>
  );
}
