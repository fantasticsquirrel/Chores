import { useState } from "react";
import {
  initialPond,
  pondWeek,
  type PondState,
} from "@family-manager/family-api/discovery-models/physical-world";
import { Slider } from "./SimulationPrimitives";
import {
  LandscapeExhibit,
  LandscapeInvestigation,
  LandscapeMetric,
} from "./landscape/LandscapeExhibit";
import { PondTrend } from "./landscape/PondTrend";
const species = [
  { key: "algae", name: "Algae" },
  { key: "zooplankton", name: "Zooplankton" },
  { key: "fish", name: "Fish" },
] as const;
const fresh = () => ({ week: 0, pond: initialPond, trail: [initialPond] });
export function FoodWebSimulation() {
  const [nutrients, setNutrients] = useState(50),
    [drought, setDrought] = useState(0),
    [trial, setTrial] = useState(fresh);
  const step = () =>
    setTrial((current) => {
      const next = pondWeek(current.pond, { nutrients, drought });
      return {
        week: current.week + 1,
        pond: next,
        trail: [...current.trail.slice(-20), next],
      };
    });
  const toggleSpecies = (key: keyof Omit<PondState, "oxygen">) =>
    setTrial((current) => {
      const pond = {
        ...current.pond,
        [key]: current.pond[key] > 0 ? 0 : initialPond[key],
      };
      return { ...current, pond, trail: [...current.trail.slice(0, -1), pond] };
    });
  const reset = () => {
    setNutrients(50);
    setDrought(0);
    setTrial(fresh());
  };
  return (
    <LandscapeExhibit
      title="What changes when one consumer disappears?"
      introduction="Follow food from algae to grazers to fish. Advance equal numbers of weeks to compare the effects."
      state={{ kind: "pond", ...trial.pond, drought, nutrients }}
      description={`Pond cutaway. Week ${trial.week}. Algae ${trial.pond.algae.toFixed(1)}, zooplankton ${trial.pond.zooplankton.toFixed(1)}, fish ${trial.pond.fish.toFixed(1)} and oxygen ${trial.pond.oxygen.toFixed(1)}: all relative indices. Drought preview ${drought} percent. Population effects occur when a week is advanced.`}
      controls={
        <>
          <Slider
            label="Nutrient supply"
            value={nutrients}
            min={0}
            max={100}
            onChange={setNutrients}
          />
          <Slider
            label="Drought severity"
            value={drought}
            min={0}
            max={100}
            unit="%"
            onChange={setDrought}
          />
          <fieldset className="landscape-switches">
            <legend>Species in this pond</legend>
            {species.map(({ key, name }) => (
              <label key={key}>
                <input
                  type="checkbox"
                  aria-label={`${name} present`}
                  checked={trial.pond[key] > 0}
                  onChange={() => toggleSpecies(key)}
                />
                {name}
                {key === "zooplankton" ? " (tiny grazers)" : ""}
              </label>
            ))}
          </fieldset>
          <div className="landscape-actions">
            <button type="button" onClick={step}>
              Advance one week
            </button>
            <button type="button" onClick={reset}>
              Reset
            </button>
          </div>
        </>
      }
      evidence={
        <>
          <div className="landscape-metrics">
            {species.map(({ key, name }) => (
              <div key={key} className="landscape-metric">
                <span>{name} population index</span>
                <strong>
                  <output aria-label={`${name} population index`}>
                    {trial.pond[key].toFixed(1)}
                  </output>
                </strong>
              </div>
            ))}
            <LandscapeMetric
              label="Available oxygen index"
              value={`${trial.pond.oxygen.toFixed(1)} / 100`}
            />
          </div>
          <p className="landscape-observation" role="status">
            <strong>Week {trial.week}</strong> · Algae → zooplankton → fish.
            Arrows mean food passes from prey to consumer.{" "}
            {trial.pond.oxygen < 40
              ? "Oxygen below 40 adds stress to fish and grazers in this model."
              : "Changing one population can affect the others over several weeks."}
          </p>
          <PondTrend trail={trial.trail} week={trial.week} />
        </>
      }
      investigations={
        <LandscapeInvestigation
          items={[
            {
              label: "Remove fish",
              predict:
                "Without fish, which group will change first through reduced predation?",
              options: ["Algae", "Zooplankton"],
              action:
                "Reset to nutrient supply 50 and drought 0. Remove fish and advance five weeks. Record the grazer and algae indices. Reset again, leave all species present at those same settings, and advance five weeks.",
              explain:
                "Fish eat zooplankton; zooplankton eat algae. How can removing a consumer affect a producer indirectly? Use the five-week trends, not only the first week.",
              test: () => {
                reset();
                setTrial({
                  week: 0,
                  pond: { ...initialPond, fish: 0 },
                  trail: [{ ...initialPond, fish: 0 }],
                });
              },
              testLabel: "Start without fish",
            },
            {
              label: "Add nutrients",
              predict:
                "Does extra nutrient supply necessarily help every population?",
              options: ["Yes", "No"],
              action:
                "With all species and no drought, compare five weeks at nutrient supply 20 with five weeks at 100. Reset before each trial.",
              explain:
                "Nutrients raise algae's growth limit. Grazing and oxygen can change the outcome for other groups. Which trend contradicts the idea that more nutrients always help?",
              test: () => {
                reset();
                setNutrients(20);
              },
              testLabel: "Start low-nutrient trial",
            },
          ]}
        />
      }
      note="One three-group chain within a larger food web. Populations, oxygen and weeks use bounded illustrative indices and rates, not field measurements or forecasts. Algae make oxygen in daylight; the oxygen calculation represents a net balance including respiration and decomposition. Species and bubbles are magnified symbols, not counts or dissolved-gas measurements. Drought previews a lower water level; biological changes require advancing time."
    />
  );
}
