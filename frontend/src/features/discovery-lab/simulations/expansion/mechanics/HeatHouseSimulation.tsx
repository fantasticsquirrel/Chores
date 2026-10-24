import { useState } from "react";
import {
  defaultHeatState,
  heatResult,
  heatWallMaterials,
  normalizeHeat,
  type HeatState,
} from "@family-manager/family-api/discovery-models/expansion-mechanics";
import { createHeatScene } from "@family-manager/discovery-scenes/expansion/mechanics/heatScene";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import {
  MechanicsComparison,
  type MechanicsExperiment,
} from "./MechanicsComparison";
import "./mechanics.css";
const baseline = { ...defaultHeatState, insulationCm: 0 };
const bare = heatResult(baseline),
  insulated = heatResult({ ...baseline, insulationCm: 10 });
const small = heatResult({
    ...defaultHeatState,
    insulationCm: 10,
    windowM2: 2,
  }),
  large = heatResult({ ...defaultHeatState, insulationCm: 10, windowM2: 18 });
const experiments: readonly MechanicsExperiment<HeatState>[] = [
  {
    title: "Add wall insulation",
    question:
      "Will adding wall insulation reduce the heat transfer through unchanged windows?",
    choices: [
      "Window transfer falls",
      "Window transfer stays the same",
      "Window transfer rises",
    ],
    controlled:
      "Keep brick walls, 8 m² of windows, 20°C inside and 0°C outside. Compare no added insulation with 10 cm. Both temperatures are held steady.",
    before: baseline,
    after: { ...baseline, insulationCm: 10 },
    change: "Add 10 cm insulation",
    evidence: `Wall transfer falls from ${bare.wallWatts.toFixed(0)} W to ${insulated.wallWatts.toFixed(0)} W. Window transfer stays ${bare.windowWatts.toFixed(0)} W. Combined transfer falls from ${bare.totalWatts.toFixed(0)} W to ${insulated.totalWatts.toFixed(0)} W.`,
    explain:
      "Why does extra wall insulation reduce only one heat-transfer path in this comparison? What else would need to change to reduce the window transfer?",
  },
  {
    title: "Change window area",
    question:
      "With insulated walls, what happens to heat loss if windows replace more of the wall area?",
    choices: ["Heat loss rises", "Heat loss stays the same", "Heat loss falls"],
    controlled:
      "Keep 10 cm of added insulation, brick, 20°C inside and 0°C outside. Increase windows from 2 to 18 m² within the same 60 m² wall envelope.",
    before: { ...defaultHeatState, insulationCm: 10, windowM2: 2 },
    after: { ...defaultHeatState, insulationCm: 10, windowM2: 18 },
    change: "Use 18 m² windows",
    evidence: `Opaque wall area falls from 58 to 42 m². Combined transfer rises from ${small.totalWatts.toFixed(0)} W to ${large.totalWatts.toFixed(0)} W because these windows transfer more heat per square meter than these insulated walls.`,
    explain:
      "Why must window area replace wall area for a fair comparison? Would every real window and wall have this same result?",
  },
];
export function HeatHouseSimulation() {
  const [state, setState] = useState<HeatState>({ ...defaultHeatState });
  const set = <K extends keyof HeatState>(key: K, value: HeatState[K]) =>
    setState((current) => normalizeHeat({ ...current, [key]: value }));
  const r = heatResult(state),
    magnitude = Math.abs(r.totalWatts),
    direction =
      r.deltaC > 0
        ? "leaves the house"
        : r.deltaC < 0
          ? "enters the house"
          : "has no net transfer";
  const wallShare =
    magnitude > 0 ? (Math.abs(r.wallWatts) / magnitude) * 100 : 0;
  const description = `Cutaway house, ${state.insulationCm} centimeters of added insulation, ${state.windowM2} square meters of windows. Indoor temperature held at ${state.insideC} degrees Celsius; outside ${state.outsideC}. Net outward wall heat transfer ${r.wallWatts.toFixed(0)} watts; window heat transfer ${r.windowWatts.toFixed(0)} watts. Drag the sample thickness marker or use the insulation slider.`;
  return (
    <section className="mechanics-exhibit mechanics-heat">
      <header className="mechanics-heading">
        <h2>Which path transfers more heat?</h2>
        <p>
          Hold temperatures steady and change one wall or window property at a
          time.
        </p>
      </header>
      <ExpansionCanvas
        dragSelect
        state={state}
        buildScene={createHeatScene}
        description={description}
        onSelect={(value) => set("insulationCm", value)}
      />
      <div className="mechanics-console">
        <div className="mechanics-inputs">
          <label className="mechanics-select">
            Base wall material
            <select
              value={state.material}
              onChange={(e) =>
                set("material", e.target.value as HeatState["material"])
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
            onChange={(v) => set("insulationCm", v)}
          />
          <Slider
            label="Window area"
            value={state.windowM2}
            min={2}
            max={18}
            unit=" m²"
            onChange={(v) => set("windowM2", v)}
          />
          <div className="mechanics-temperature">
            <Slider
              label="Indoor temperature"
              value={state.insideC}
              min={16}
              max={24}
              unit="°C"
              onChange={(v) => set("insideC", v)}
            />
            <Slider
              label="Outdoor temperature"
              value={state.outsideC}
              min={-5}
              max={25}
              unit="°C"
              onChange={(v) => set("outsideC", v)}
            />
          </div>
          <button
            className="mechanics-reset"
            type="button"
            onClick={() => setState({ ...defaultHeatState })}
          >
            Reset house
          </button>
        </div>
        <div
          className="mechanics-results"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="mechanics-measures">
            <div>
              <span>Opaque walls</span>
              <strong>
                {r.wallWatts.toFixed(0)} <small>W</small>
              </strong>
            </div>
            <div>
              <span>Windows</span>
              <strong>
                {r.windowWatts.toFixed(0)} <small>W</small>
              </strong>
            </div>
          </div>
          <div className="mechanics-heatbar" aria-hidden="true">
            <span style={{ width: `${wallShare}%` }} />
            <i style={{ width: `${magnitude === 0 ? 0 : 100 - wallShare}%` }} />
          </div>
          <p>
            <strong>{magnitude.toFixed(0)} W</strong> of thermal energy{" "}
            {direction}. Signed readings are outward: a negative value means
            heat enters.
          </p>
          <p>
            {r.wallAreaM2} m² opaque wall + {r.windowAreaM2} m² windows = 60 m².
            A watt is one joule transferred each second, not a temperature.
          </p>
          <p>
            {r.deltaC === 0
              ? "Equal indoor and outdoor temperatures give zero net transfer in this model, whatever the insulation."
              : `The temperature difference is ${Math.abs(r.deltaC)}°C. Insulation slows transfer; it does not supply heat.`}
          </p>
        </div>
      </div>
      <MechanicsComparison experiments={experiments} onApply={setState} />
      <details className="mechanics-details">
        <summary>How this comparison is calculated</summary>
        <p>
          Transfer rate = U × area × temperature difference. U measures how
          easily a square meter of an assembly transfers heat, in W/(m²·K). This
          wall’s U is {r.wallU.toFixed(2)}; the fixed window U is 2.8. A
          temperature difference of 1°C equals a difference of 1 K.
        </p>
        <p>
          The base wall is 20 cm thick. Representative conductivities: brick
          0.6, wood 0.12 and insulated panel 0.04 W/(m·K); added insulation 0.04
          W/(m·K). A fixed surface resistance of 0.17 m²·K/W is included. These
          are teaching values, not product ratings.
        </p>
      </details>
      <p className="mechanics-note">
        Steady wall-and-window comparison, not a whole-house heating bill.
        Temperatures are maintained; no cooling timer. Roof, floor, drafts,
        sunlight, moisture and construction joints are omitted. The facade and
        cutaway are schematic; numerical areas define the comparison. Arrows
        show direction and relative transfer per square meter.
      </p>
    </section>
  );
}
