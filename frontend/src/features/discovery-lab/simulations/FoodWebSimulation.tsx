import { useEffect, useState } from "react";
import {
  POND_DEFAULT_CONDITIONS,
  POND_INITIAL_STATE,
  advancePondWeek,
  normalizePondConditions,
  pondStateAtPhase,
  runPondTrial,
  type PondScenario,
  type PondState,
} from "@family-manager/family-api/discovery-models/pond";
import { Slider } from "./SimulationPrimitives";
import { FoodWebPredictionTrials } from "./food-web/FoodWebPredictionTrials";
import { useFoodWebLesson } from "./food-web/useFoodWebLesson";
import {
  LandscapeExhibit,
  LandscapeMetric,
} from "./landscape/LandscapeExhibit";
import { PondTrend } from "./landscape/PondTrend";
import "./food-web/food-web.css";

const species = [
  { key: "algae", name: "Algae" },
  { key: "zooplankton", name: "Zooplankton" },
  { key: "fish", name: "Fish" },
] as const;

type Trial = { week: number; pond: PondState; trail: PondState[] };
const freshTrial = (): Trial => ({
  week: 0,
  pond: { ...POND_INITIAL_STATE },
  trail: [{ ...POND_INITIAL_STATE }],
});

export function FoodWebSimulation() {
  const [conditions, setConditions] = useState({ ...POND_DEFAULT_CONDITIONS });
  const [trial, setTrial] = useState<Trial>(freshTrial);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lesson = useFoodWebLesson();
  const sceneState = pondStateAtPhase(trial.pond, conditions, phase);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setPhase((current) => (current + 0.08) % 1),
      280,
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

  const stopMarkers = () => {
    setPhase(0);
    setPlaying(false);
  };
  const showTrial = (scenario: PondScenario) => {
    const result = runPondTrial(scenario);
    setConditions({ ...result.conditions });
    setTrial({ week: result.week, pond: result.state, trail: result.trail });
    stopMarkers();
  };
  const step = () => {
    setTrial((current) => {
      const next = advancePondWeek(current.pond, conditions).state;
      return {
        week: current.week + 1,
        pond: next,
        trail: [...current.trail.slice(-20), next],
      };
    });
    setPlaying(false);
  };
  const setCondition = (key: keyof typeof conditions, value: number) => {
    setConditions((current) =>
      normalizePondConditions({ ...current, [key]: value }),
    );
    setPlaying(false);
  };
  const toggleSpecies = (key: (typeof species)[number]["key"]) => {
    if (!lesson.freeExploration) return;
    setTrial((current) => {
      const pond = {
        ...current.pond,
        [key]: current.pond[key] > 0 ? 0 : POND_INITIAL_STATE[key],
      };
      return { ...current, pond, trail: [...current.trail.slice(0, -1), pond] };
    });
    setPlaying(false);
  };
  const reset = () => {
    setConditions({ ...POND_DEFAULT_CONDITIONS });
    setTrial(freshTrial());
    stopMarkers();
    lesson.resetLesson();
  };

  const description = [
    `Dimensional pond cutaway at model week ${trial.week}.`,
    `Algae ${trial.pond.algae.toFixed(1)}, zooplankton ${trial.pond.zooplankton.toFixed(1)}, fish ${trial.pond.fish.toFixed(1)}, oxygen ${trial.pond.oxygen.toFixed(1)}, and detritus ${trial.pond.detritus.toFixed(1)}; all are relative indices from 0 to 100.`,
    `Nutrient supply index ${conditions.nutrients.toFixed(0)} and drought severity ${conditions.drought.toFixed(0)} percent.`,
    "Gold arrows run from algae to grazers to fish: resource or prey toward consumer, showing modeled energy flow rather than organism movement.",
    `Static energy-flow markers are at ${Math.round(phase * 100)} percent.`,
  ].join(" ");

  return (
    <LandscapeExhibit
      title="Trace a change through the pond"
      introduction="Predict first, then compare trials that change one factor while holding the others fixed. Read the indices as model evidence—not real population forecasts."
      state={{ kind: "pond", ...sceneState }}
      description={description}
      controls={
        <FoodWebPredictionTrials
          lesson={lesson}
          onShowTrial={showTrial}
          onPredictionChange={stopMarkers}
        />
      }
      evidence={
        <>
          <div className="landscape-metrics food-web-metrics">
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
              label="Net oxygen index"
              value={trial.pond.oxygen.toFixed(1)}
            />
            <LandscapeMetric
              label="Detritus index"
              value={trial.pond.detritus.toFixed(1)}
            />
          </div>
          <p className="landscape-observation" role="status">
            <strong>Week {trial.week}</strong> · Algae → zooplankton → fish.
            Arrows point from resource or prey to consumer because they trace
            energy transfer. They do not show animals traveling along a path.{" "}
            {trial.pond.oxygen < 50
              ? "The net oxygen index is below 50 in this trial."
              : "Population responses appear only when model time advances."}
          </p>
          <PondTrend trail={trial.trail} week={trial.week} />
        </>
      }
      investigations={
        <div className="food-web-explore">
          <div className="food-web-explore-heading">
            <div>
              <strong>
                {lesson.freeExploration
                  ? "3 · Explore one variable"
                  : "Complete both comparisons to unlock exploration"}
              </strong>
              <p>
                {lesson.freeExploration
                  ? "Reset the pond before a new comparison, change one input, then advance equal numbers of weeks."
                  : "The fixed trials keep their starting state, settings, and duration visible so the evidence is fair."}
              </p>
            </div>
            <button type="button" onClick={reset}>
              Reset lesson
            </button>
          </div>
          {lesson.freeExploration && (
            <div className="food-web-free-controls">
              <Slider
                label="Nutrient supply index"
                value={conditions.nutrients}
                min={0}
                max={100}
                onChange={(value) => setCondition("nutrients", value)}
              />
              <Slider
                label="Drought severity"
                value={conditions.drought}
                min={0}
                max={100}
                unit="%"
                onChange={(value) => setCondition("drought", value)}
              />
              <fieldset className="landscape-switches">
                <legend>Populations present</legend>
                {species.map(({ key, name }) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      aria-label={`${name} present`}
                      checked={trial.pond[key] > 0}
                      onChange={() => toggleSpecies(key)}
                    />
                    {name}
                    {key === "zooplankton" ? " · tiny grazers" : ""}
                  </label>
                ))}
              </fieldset>
              <div className="food-web-time-controls">
                <strong>Advance the model</strong>
                <p>Settings take effect on the next illustrative week.</p>
                <button type="button" onClick={step}>
                  Advance one week
                </button>
              </div>
              <div className="food-web-marker-controls">
                <Slider
                  label="Energy-flow marker phase"
                  value={Math.round(phase * 100)}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(value) => {
                    setPhase(value / 100);
                    setPlaying(false);
                  }}
                />
                <div className="landscape-actions">
                  <button
                    type="button"
                    onClick={() => setPlaying((current) => !current)}
                  >
                    {playing ? "Pause energy flow" : "Play energy flow"}
                  </button>
                  <button type="button" onClick={stopMarkers}>
                    Start markers
                  </button>
                </div>
                <p>
                  Motion is optional and starts paused. Markers show direction
                  only—not energy amount, animal speed, or organism movement.
                </p>
              </div>
            </div>
          )}
        </div>
      }
      note="Model boundary: this is one algae–grazer–fish chain inside a much larger food web. The 0–100 population, nutrient, oxygen, and detritus indices; weekly step; and coefficients are invented, bounded teaching quantities—not counts, concentrations, measured rates, or forecasts. The oxygen index represents a simplified net balance involving algal biomass, respiration, decomposition, and drought. Real outcomes also depend on temperature, light, mixing, nutrient form, species, and many other processes."
    />
  );
}
