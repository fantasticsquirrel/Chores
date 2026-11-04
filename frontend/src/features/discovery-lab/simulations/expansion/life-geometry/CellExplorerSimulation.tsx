import { useState, type SetStateAction } from "react";
import {
  cellExplorerBoundary,
  cellExplorerCoreBoundary,
  cellExplorerTrials,
  cellObservation,
  cellParts,
  defaultCellExplorerState,
  stepCellTransport,
  type CellExplorerState,
  type CellPart,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";
import {
  createCellExplorerScene,
  cellPartOrder,
} from "@family-manager/discovery-scenes/expansion/life-geometry/index";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { LifeInvestigations } from "./LifeInvestigations";
import "./life-geometry.css";
export function CellExplorerSimulation() {
  const [state, setState] = useState<CellExplorerState>(
    defaultCellExplorerState,
  );
  const [investigationReset, setInvestigationReset] = useState(0);
  const setManualState = (next: SetStateAction<CellExplorerState>) => {
    setState(next);
    setInvestigationReset((value) => value + 1);
  };
  const set = <K extends keyof CellExplorerState>(
    key: K,
    value: CellExplorerState[K],
  ) => setManualState((previous) => ({ ...previous, [key]: value }));
  const selectPart = (part: CellPart) => {
    if (state.cellType === "plant" || !cellParts[part].plantOnly)
      set("selected", part);
  };
  const run = (next: CellExplorerState) => {
    setState(next);
    return cellObservation(next);
  };
  const observation = cellObservation(state),
    part = cellParts[state.selected];
  return (
    <section className="life-lesson life-cell">
      <header>
        <h2>What can cross a cell membrane?</h2>
        <p>
          Predict which substance can cross, change one variable, and use the
          concentration evidence to explain selective permeability.
        </p>
      </header>
      <div className="life-workspace">
        <div className="life-visual">
          <ExpansionCanvas
            state={state}
            buildScene={createCellExplorerScene}
            description={`${state.cellType === "plant" ? "Cutaway photosynthetic plant cell with a wall, membrane, central vacuole and chloroplasts" : "Cutaway animal cell with no wall or chloroplasts"}. Both have a nucleus and mitochondria. The separate enlarged membrane diagram shows ${observation}`}
            onSelect={(index) => selectPart(cellPartOrder[index])}
          />
          <p className="life-caption">
            Tap a cell part to inspect it, or use the labeled buttons.
          </p>
        </div>
        <div className="life-controls">
          <label>
            Cell type
            <select
              value={state.cellType}
              onChange={(event) => {
                const cellType = event.target
                  .value as CellExplorerState["cellType"];
                setManualState((previous) => ({
                  ...previous,
                  cellType,
                  selected:
                    cellType === "animal" &&
                    cellParts[previous.selected].plantOnly
                      ? "membrane"
                      : previous.selected,
                }));
              }}
            >
              <option value="plant">Photosynthetic plant cell</option>
              <option value="animal">Animal cell</option>
            </select>
          </label>
          <div className="life-parts" aria-label="Cell parts">
            {cellPartOrder.map((key) => (
              <button
                key={key}
                type="button"
                disabled={
                  state.cellType === "animal" && cellParts[key].plantOnly
                }
                aria-pressed={state.selected === key}
                onClick={() => selectPart(key)}
              >
                {cellParts[key].name}
              </button>
            ))}
          </div>
          <div className="life-part-note">
            <h3>{part.name}</h3>
            <p>{part.function}</p>
          </div>
          <label>
            Molecule
            <select
              value={state.molecule}
              onChange={(event) =>
                set(
                  "molecule",
                  event.target.value as CellExplorerState["molecule"],
                )
              }
            >
              <option value="oxygen">Oxygen</option>
              <option value="glucose">Glucose</option>
            </select>
          </label>
          <label className="life-check">
            <input
              type="checkbox"
              checked={state.carrier}
              onChange={(event) => set("carrier", event.target.checked)}
            />
            Glucose carrier
          </label>
          <Slider
            label="Outside concentration"
            value={state.outside}
            min={0}
            max={20}
            step={0.5}
            onChange={(value) => set("outside", value)}
          />
          <Slider
            label="Inside concentration"
            value={state.inside}
            min={0}
            max={20}
            step={0.5}
            onChange={(value) => set("inside", value)}
          />
          <div className="life-actions">
            <button
              type="button"
              onClick={() => setManualState(stepCellTransport)}
            >
              Transfer one step
            </button>
            <button
              type="button"
              onClick={() =>
                setManualState((previous) => ({
                  ...previous,
                  outside: 12,
                  inside: 4,
                }))
              }
            >
              Reset concentrations
            </button>
            <button
              type="button"
              onClick={() => setManualState(defaultCellExplorerState)}
            >
              Reset cell explorer
            </button>
          </div>
        </div>
      </div>
      <div className="life-evidence" role="status">
        <strong>Net transfer</strong>
        <p>{observation}</p>
        <span>
          Total concentration units in equal volumes:{" "}
          {(state.inside + state.outside).toFixed(1)}. A transfer step conserves
          this total.
        </span>
      </div>
      <LifeInvestigations
        resetKey={investigationReset}
        items={cellExplorerTrials.map((trial) => ({
          label: trial.title,
          predict: trial.question,
          choices: trial.choices,
          correctChoice: trial.correctChoice,
          fixed: trial.controlled,
          cases: [
            [trial.caseLabels[0], () => run({ ...trial.before })],
            [trial.caseLabels[1], () => run({ ...trial.after })],
          ],
          evidence: `${trial.evidence} Changed: ${trial.changed}. Held: ${trial.held.join(", ")}.`,
          explain: trial.explain,
        }))}
      />
      <p className="life-model-note">
        {cellExplorerCoreBoundary} A cell wall does not replace a cell membrane.
        Use the numeric concentrations, not the rounded molecule symbols, for
        comparisons.
      </p>
      <details className="life-boundary">
        <summary>Model boundary</summary>
        <p>{cellExplorerBoundary}</p>
      </details>
    </section>
  );
}
