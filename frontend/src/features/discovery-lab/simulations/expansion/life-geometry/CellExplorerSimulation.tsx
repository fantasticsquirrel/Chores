import { useState } from "react";
import {
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
  const set = <K extends keyof CellExplorerState>(
    key: K,
    value: CellExplorerState[K],
  ) => setState((previous) => ({ ...previous, [key]: value }));
  const selectPart = (part: CellPart) => {
    if (state.cellType === "plant" || !cellParts[part].plantOnly)
      set("selected", part);
  };
  const run = (molecule: CellExplorerState["molecule"], carrier: boolean) => {
    const next = stepCellTransport({
      ...state,
      outside: 12,
      inside: 4,
      molecule,
      carrier,
    });
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
          Select a cell part, then compare oxygen and glucose moving between
          equal-sized compartments.
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
                setState((previous) => ({
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
            <button type="button" onClick={() => setState(stepCellTransport)}>
              Transfer one step
            </button>
            <button
              type="button"
              onClick={() =>
                setState((previous) => ({
                  ...previous,
                  outside: 12,
                  inside: 4,
                }))
              }
            >
              Reset concentrations
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
        items={[
          {
            label: "Compare molecules",
            predict:
              "With no carrier, will both molecules enter at the same rate?",
            choices: ["Same transfer", "Different transfer"],
            fixed:
              "Start both trials at outside 12 and inside 4. Keep the cell type and carrier off. Change only the molecule, then take one step.",
            cases: [
              ["Oxygen · one step", () => run("oxygen", false)],
              ["Glucose · one step", () => run("glucose", false)],
            ],
            explain:
              "Which trial changed the inside concentration? What does that show about a selectively permeable membrane?",
          },
          {
            label: "Add a carrier",
            predict:
              "Can a carrier change glucose transfer without changing the concentration difference?",
            choices: ["Transfer changes", "No change"],
            fixed:
              "Use glucose in both trials, outside 12 and inside 4. Change only whether the glucose carrier is present. Compare one step each.",
            cases: [
              ["No carrier · one step", () => run("glucose", false)],
              ["Carrier · one step", () => run("glucose", true)],
            ],
            explain:
              "Compare the amounts on each side and their total. Does a carrier create glucose, or provide a path across the membrane?",
          },
        ]}
      />
      <p className="life-model-note">
        Organelles are enlarged and arranged for inspection, not to scale.
        Concentrations are relative units in two equal volumes. Each step shows
        net transfer, not individual molecular motion or real elapsed time. Only
        passive oxygen diffusion and carrier-mediated glucose diffusion are
        modeled; active transport and reactions are omitted. A cell wall does
        not replace a cell membrane. Molecule symbols are rounded; use the
        numeric concentrations for comparisons.
      </p>
    </section>
  );
}
