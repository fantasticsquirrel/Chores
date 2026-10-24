import { useState } from "react";
import {
  defaultAdaptationIslandState,
  islandObservation,
  nextIslandGeneration,
  resetIsland,
  type AdaptationIslandState,
} from "@family-manager/family-api/discovery-models/expansion-life-geometry";
import { createAdaptationIslandScene } from "@family-manager/discovery-scenes/expansion/life-geometry/index";
import { ExpansionCanvas } from "../ExpansionCanvas";
import { Slider } from "../../SimulationPrimitives";
import { LifeInvestigations } from "./LifeInvestigations";
import "./life-geometry.css";
function fiveGenerations(state: AdaptationIslandState) {
  return Array.from({ length: 5 }).reduce<AdaptationIslandState>(
    (previous) => nextIslandGeneration(previous),
    state,
  );
}
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
  const observation = islandObservation(state);
  const run = (
    habitat: AdaptationIslandState["habitat"],
    predators: boolean,
  ) => {
    const next = fiveGenerations({
      ...defaultAdaptationIslandState,
      habitat,
      predators,
    });
    setState(next);
    return islandObservation(next);
  };
  return (
    <section className="life-lesson life-island">
      <header>
        <h2>Which inherited variant becomes more common?</h2>
        <p>
          Compare shell-color proportions across generations. Change the ground
          or remove predation, then start again from the same population.
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
                setState((previous) => ({
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
                setState((previous) => ({
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
              setState((previous) => resetIsland({ ...previous, initialDark }))
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
              onClick={() => setState(nextIslandGeneration)}
            >
              Next generation
            </button>
            <button
              type="button"
              disabled={state.generation >= 20}
              onClick={() => setState(fiveGenerations)}
            >
              {state.generation > 15
                ? "Advance to generation 20"
                : "Advance 5 generations"}
            </button>
            <button type="button" onClick={() => setState(resetIsland)}>
              Reset population
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
                ? "Matching shells have survival weight 0.9; contrasting shells have weight 0.5."
                : "Without predation, both colors have survival weight 0.9."}{" "}
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
        items={[
          {
            label: "Change the environment",
            predict:
              "Will the same starting variants reach the same proportions on dark and pale ground?",
            choices: ["Same proportions", "Different proportions"],
            fixed:
              "Start with 50% of each inherited variant and predation included. Compare exactly five generations, changing only the ground color. Each button resets the starting population.",
            cases: [
              ["Dark ground · 5 generations", () => run("dark", true)],
              ["Pale ground · 5 generations", () => run("light", true)],
            ],
            explain:
              "Which variant increased in each habitat? Explain how a change in relative survival changes the descendants’ proportions without changing an individual’s shell color.",
          },
          {
            label: "Remove predation",
            predict:
              "Will shell proportions still change when both variants have equal survival?",
            choices: ["Proportions stay fixed", "One color increases"],
            fixed:
              "Use dark ground, 50% of each variant and five generations in both trials. Change only predation; each button resets the same starting population.",
            cases: [
              ["Predation on · 5 generations", () => run("dark", true)],
              ["Predation off · 5 generations", () => run("dark", false)],
            ],
            explain:
              "Compare the initial and current bars. Which difference between variants is necessary for selection to shift their proportions in this model?",
          },
        ]}
      />
      <p className="life-model-note">
        This is a deterministic expected-frequency model, not a sampled
        population or a forecast for real beetles. Survival weights are invented
        teaching values. Reproduction copies the parental variant without
        modeling mating or genes; population size, mutation, migration and
        random drift are omitted. Natural selection changes populations across
        generations, not individuals choosing or acquiring a useful trait.
      </p>
    </section>
  );
}
