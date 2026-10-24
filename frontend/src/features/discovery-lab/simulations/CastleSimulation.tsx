import { lazy, Suspense, useState } from "react";
import { Slider } from "./SimulationPrimitives";
import { CastleInvestigation } from "./castle/CastleInvestigation";
import {
  castleObservation,
  defaultCastleState,
  type CastleState,
} from "./castle/castleState";
import "./castle/castle.css";
import "./castle/castleResponsive.css";
const CastleCanvas = lazy(() =>
  import("./castle/CastleCanvas").then((module) => ({
    default: module.CastleCanvas,
  })),
);
export function CastleSimulation() {
  const [state, setState] = useState<CastleState>(defaultCastleState);
  const set = <K extends keyof CastleState>(key: K, value: CastleState[K]) =>
    setState((current) => ({ ...current, [key]: value }));
  const observation = castleObservation(state);
  const description = `Three-dimensional English-inspired castle. ${state.moat} meter ditch; ${state.gate ? "closed" : "raised"} portcullis at the bridge entrance; ${state.towers ? "four projecting corner towers" : "no projecting corner towers"}; ${state.inner ? "an additional inner wall" : "one outer wall"}. The ${state.approach} route ${observation}. ${state.towers ? "Towers provide views along adjoining outer wall faces." : "Flat-wall observers have less wall-side visibility."} Drag or use arrow keys to turn the view; camera buttons provide fixed views.`;
  return (
    <div className="castle-exhibit">
      <div className="castle-visual">
        <div className="castle-heading">
          <h2>What blocks the approach?</h2>
          <p>Compare the entrance with a route toward a solid wall.</p>
        </div>
        <Suspense
          fallback={
            <div className="castle-loading">Loading castle geometry…</div>
          }
        >
          <CastleCanvas state={state} description={description} />
        </Suspense>
        <div className="castle-route-key">
          <i aria-hidden="true" />{" "}
          {state.approach === "bridge" ? "Bridge route" : "North route"}{" "}
          <span>· {observation}</span>
        </div>
      </div>
      <div className="castle-console">
        <div className="castle-route-controls">
          <label htmlFor="castle-approach">Approach route</label>
          <select
            id="castle-approach"
            value={state.approach}
            onChange={(event) =>
              set("approach", event.target.value as CastleState["approach"])
            }
          >
            <option value="bridge">Bridge and gate</option>
            <option value="north">Across the north ditch</option>
          </select>
          <Slider
            label="Ditch width"
            value={state.moat}
            min={0}
            max={36}
            unit=" m"
            onChange={(value) => set("moat", value)}
          />
        </div>
        <div className="castle-features">
          {(
            [
              [
                "gate",
                "Close gate",
                "Lower the portcullis across the entrance.",
              ],
              [
                "towers",
                "Projecting towers",
                "Compare views along the wall faces.",
              ],
              ["inner", "Inner wall", "Add another barrier around the keep."],
              [
                "sight",
                "Sight-line overlay (not structures)",
                "Dashed viewing directions, not cables or structures.",
              ],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key}>
              <input
                type="checkbox"
                aria-label={label}
                checked={state[key]}
                onChange={(event) => set(key, event.target.checked)}
              />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </label>
          ))}
        </div>
        <button
          className="castle-reset"
          type="button"
          onClick={() => setState({ ...defaultCastleState })}
        >
          Reset design
        </button>
      </div>
      <div className="castle-observation" role="status">
        <strong>{observation}</strong>.{" "}
        {state.towers
          ? "Projecting towers give views along adjoining walls."
          : "Without projecting towers, wall-side visibility is reduced."}{" "}
        {state.inner &&
          "The inner wall adds another barrier; it does not make the castle invincible."}
      </div>
      <CastleInvestigation state={state} onChange={setState} />
      <p className="castle-model-note">
        13th-century English-inspired composite, not a reconstruction.
        Dimensions are schematic; ditch width is compressed in the view. Ditches
        could be wet or dry. Sight lines illustrate positions, not weapon
        ranges. Routes and visibility do not predict a siege result.
      </p>
    </div>
  );
}
