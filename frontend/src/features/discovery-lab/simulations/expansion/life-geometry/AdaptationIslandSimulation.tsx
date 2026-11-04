import { useState, type SetStateAction } from "react";
import {
  defaultAdaptationIslandState,
  islandObservation,
  nextIslandGeneration,
  resetIsland,
  type AdaptationIslandState,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";
import {
  adaptationIslandBoundary,
  adaptationIslandCoreBoundary,
  adaptationIslandTrials,
  advanceIslandGenerations,
} from "@family-manager/family-api/discovery-models/adaptation-island";
import { createAdaptationIslandScene } from "@family-manager/discovery-scenes/expansion/life-geometry/index";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { LifeInvestigations } from "./LifeInvestigations";
import "./life-geometry.css";
function PopulationBar({ label, dark }: { label: string; dark: number }) {
  return (
    <div className="life-population">
      <span>{label}</span>
      <div className="life-population-track" aria-hidden="true">
        <i style={{ width: `${dark}%` }} />
      </div>
      <p>
        Dark {dark.toFixed(1)}% · Pale {(100 - dark).toFixed(1)}%
      </p>
    </div>
  );
}
export function AdaptationIslandSimulation() {
  const [state, setState] = useState<AdaptationIslandState>(
    defaultAdaptationIslandState,
  );
  const [investigationReset, setInvestigationReset] = useState(0);
  const setManualState = (next: SetStateAction<AdaptationIslandState>) => {
    setState(next);
    setInvestigationReset((value) => value + 1);
  };
  const observation = islandObservation(state);
  const run = (next: AdaptationIslandState) => {
    setState({ ...next });
    return islandObservation(next);
  };
  return (
    <section className="life-lesson life-island">
      <header>
        <h2>Which inherited variant becomes more common?</h2>
        <p>
          Predict a population trend, change one selective condition, and use
          five-generation proportions to explain the evidence.
        </p>
      </header>
      <div className="life-workspace">
        <div className="life-visual">
          <ExpansionCanvas
            state={state}
            buildScene={createAdaptationIslandScene}
            description={`A ${state.habitat === "dark" ? "dark rocky" : "pale sandy"} habitat with beetle symbols. Twenty symbols approximate the population’s shell-color shares; each stands for 5 percentage points, not one tracked individual. ${observation}`}
          />
          <p className="life-caption">
            Twenty symbols approximate population shares. The percentages below
            are the calculated evidence, not a count of individual beetles.
          </p>
        </div>
        <div className="life-controls">
          <label>
            Ground color
            <select
              value={state.habitat}
              onChange={(event) =>
                setManualState((previous) => ({
                  ...previous,
                  habitat: event.target
                    .value as AdaptationIslandState["habitat"],
                }))
              }
            >
              <option value="dark">Dark rocky ground</option>
              <option value="light">Pale sandy ground</option>
            </select>
          </label>
          <label className="life-check">
            <input
              type="checkbox"
              checked={state.predators}
              onChange={(event) =>
                setManualState((previous) => ({
                  ...previous,
                  predators: event.target.checked,
                }))
              }
            />
            Include predation
          </label>
          <Slider
            label="Initial dark-shell share"
            value={state.initialDark}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(initialDark) =>
              setManualState((previous) =>
                resetIsland({ ...previous, initialDark }),
              )
            }
          />
          <p className="life-hint">
            Changing the initial share resets generation 0. Changing the ground
            or predation affects only future generations; use Reset population
            for a fair new trial.
          </p>
          <div className="life-actions">
            <button
              type="button"
              disabled={state.generation >= 20}
              onClick={() => setManualState(nextIslandGeneration)}
            >
              Next generation
            </button>
            <button
              type="button"
              disabled={state.generation >= 20}
              onClick={() =>
                setManualState((previous) =>
                  advanceIslandGenerations(previous, 5),
                )
              }
            >
              {state.generation > 15
                ? "Advance to generation 20"
                : "Advance 5 generations"}
            </button>
            <button type="button" onClick={() => setManualState(resetIsland)}>
              Reset population
            </button>
            <button
              type="button"
              onClick={() => setManualState(defaultAdaptationIslandState)}
            >
              Reset adaptation island
            </button>
          </div>
          <div className="life-generation">
            <span>Generation</span>
            <strong>
              {state.generation}
              <small> / 20</small>
            </strong>
          </div>
          <PopulationBar label="Initial proportions" dark={state.initialDark} />
          <PopulationBar label="Current proportions" dark={state.darkCount} />
          <div className="life-part-note">
            <h3>Survival and inheritance</h3>
            <p>
              {state.predators
                ? "Matching shells have relative survival-and-contribution weight 0.9; contrasting shells have weight 0.5."
                : "Without predation, both colors have relative weight 0.9."}{" "}
              Offspring inherit the parental color variant. The next generation
              is normalized to 100%.
            </p>
          </div>
        </div>
      </div>
      <div className="life-evidence" role="status">
        <strong>Expected population proportions</strong>
        <p>{observation}</p>
        {(state.darkCount === 0 || state.lightCount === 0) && (
          <span>
            The missing color cannot appear in this model because mutation and
            migration are absent.
          </span>
        )}
      </div>
      <LifeInvestigations
        resetKey={investigationReset}
        items={adaptationIslandTrials.map((trial) => ({
          label: trial.title,
          predict: trial.question,
          choices: trial.choices,
          correctChoice: trial.correctChoice,
          fixed: trial.controlled,
          cases: [
            [trial.caseLabels[0], () => run(trial.before)],
            [trial.caseLabels[1], () => run(trial.after)],
          ],
          evidence: `${trial.evidence} Changed: ${trial.changed}. Held: ${trial.held.join(", ")}.`,
          explain: trial.explain,
        }))}
      />
      <p className="life-model-note">
        {adaptationIslandCoreBoundary} Twenty symbols round the calculated
        shares; use the percentages as evidence.
      </p>
      <details className="life-boundary">
        <summary>Model boundary</summary>
        <p>{adaptationIslandBoundary}</p>
      </details>
    </section>
  );
}
