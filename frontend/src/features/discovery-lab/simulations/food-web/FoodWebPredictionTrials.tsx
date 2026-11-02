import {
  POND_NUTRIENT_COMPARISON,
  POND_PREDATOR_COMPARISON,
  comparePondScenarios,
  runPondTrial,
  type PondScenario,
} from "@family-manager/family-api/discovery-models/pond";
import type {
  FoodWebLesson,
  NutrientPrediction,
  PredatorPrediction,
} from "./useFoodWebLesson";

const predatorEvidence = POND_PREDATOR_COMPARISON.map((scenario) =>
  runPondTrial(scenario),
);
const nutrientEvidence = POND_NUTRIENT_COMPARISON.map((scenario) =>
  runPondTrial(scenario),
);
const predatorVariables = comparePondScenarios(...POND_PREDATOR_COMPARISON);
const nutrientVariables = comparePondScenarios(...POND_NUTRIENT_COMPARISON);

const predatorChoices: { value: PredatorPrediction; label: string }[] = [
  { value: "cascade", label: "Zooplankton rises and algae falls" },
  { value: "algae-up", label: "Algae and zooplankton both rise" },
  { value: "unchanged", label: "Only fish changes" },
];
const nutrientChoices: { value: NutrientPrediction; label: string }[] = [
  { value: "fish-lower", label: "Fish and oxygen both finish lower" },
  { value: "all-higher", label: "Every index finishes higher" },
  { value: "same", label: "Nutrients make no difference" },
];

function PredictionButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

function readings(label: string, result: (typeof predatorEvidence)[number]) {
  const { state } = result;
  return `${label}: algae ${state.algae.toFixed(1)} · zooplankton ${state.zooplankton.toFixed(1)} · fish ${state.fish.toFixed(1)} · oxygen ${state.oxygen.toFixed(1)} · detritus ${state.detritus.toFixed(1)}`;
}

export function FoodWebPredictionTrials({
  lesson,
  onShowTrial,
  onPredictionChange,
}: {
  lesson: FoodWebLesson;
  onShowTrial: (scenario: PondScenario) => void;
  onPredictionChange: () => void;
}) {
  return (
    <div className="food-web-investigations">
      <fieldset className="food-web-trial">
        <legend>1 · Remove a consumer</legend>
        <p>
          Keep nutrient supply at 50, drought at 0%, and every other starting
          index the same. After 6 model weeks, what changes when fish are
          absent?
        </p>
        <div className="food-web-choices">
          {predatorChoices.map((choice) => (
            <PredictionButton
              key={choice.value}
              selected={lesson.predatorPrediction === choice.value}
              onClick={() => {
                onPredictionChange();
                lesson.choosePredator(choice.value);
              }}
            >
              {choice.label}
            </PredictionButton>
          ))}
        </div>
        <button
          type="button"
          className="food-web-compare"
          disabled={!lesson.predatorPrediction || lesson.predatorComplete}
          onClick={() => {
            lesson.completePredator();
            onShowTrial(POND_PREDATOR_COMPARISON[1]);
          }}
        >
          Compare fish present and absent
        </button>
        {lesson.predatorComplete && (
          <div
            className="food-web-feedback"
            role="status"
            aria-live="polite"
            data-result={
              lesson.predatorPrediction === "cascade" ? "match" : "revise"
            }
            data-testid="food-web-predator-feedback"
          >
            <strong>
              {lesson.predatorPrediction === "cascade"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>{readings("Fish present", predatorEvidence[0])}</span>
            <span>{readings("Fish absent", predatorEvidence[1])}</span>
            <span>
              Changed: {predatorVariables.changed.join(", ")}. Held:{" "}
              {predatorVariables.held.join(" · ")}.
            </span>
            <span>
              With no fish predation, the grazer index rises and grazing pushes
              the algae index lower. This is an indirect response along one
              food-chain path.
            </span>
            <div className="food-web-evidence-actions">
              <button
                type="button"
                onClick={() => onShowTrial(POND_PREDATOR_COMPARISON[0])}
              >
                Show fish-present evidence
              </button>
              <button
                type="button"
                onClick={() => onShowTrial(POND_PREDATOR_COMPARISON[1])}
              >
                Show fish-absent evidence
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="food-web-trial">
        <legend>2 · Increase nutrient supply</legend>
        <p>
          Keep drought at 60%, every population present, and all starting
          indices the same. After 8 model weeks, what changes from nutrient
          index 20 to 100?
        </p>
        <div className="food-web-choices">
          {nutrientChoices.map((choice) => (
            <PredictionButton
              key={choice.value}
              selected={lesson.nutrientPrediction === choice.value}
              onClick={() => {
                onPredictionChange();
                lesson.chooseNutrient(choice.value);
              }}
            >
              {choice.label}
            </PredictionButton>
          ))}
        </div>
        <button
          type="button"
          className="food-web-compare"
          disabled={!lesson.nutrientPrediction || lesson.nutrientComplete}
          onClick={() => {
            lesson.completeNutrient();
            onShowTrial(POND_NUTRIENT_COMPARISON[1]);
          }}
        >
          Compare low and high nutrients
        </button>
        {lesson.nutrientComplete && (
          <div
            className="food-web-feedback"
            role="status"
            aria-live="polite"
            data-result={
              lesson.nutrientPrediction === "fish-lower" ? "match" : "revise"
            }
            data-testid="food-web-nutrient-feedback"
          >
            <strong>
              {lesson.nutrientPrediction === "fish-lower"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>{readings("Low nutrients", nutrientEvidence[0])}</span>
            <span>{readings("High nutrients", nutrientEvidence[1])}</span>
            <span>
              Changed: {nutrientVariables.changed.join(", ")}. Held:{" "}
              {nutrientVariables.held.join(" · ")}.
            </span>
            <span>
              In this model, added nutrients support more algae, while algal
              turnover and detritus are linked to lower net oxygen. The lower
              fish result is a model response, not a forecast for a real pond.
            </span>
            <div className="food-web-evidence-actions">
              <button
                type="button"
                onClick={() => onShowTrial(POND_NUTRIENT_COMPARISON[0])}
              >
                Show low-nutrient evidence
              </button>
              <button
                type="button"
                onClick={() => onShowTrial(POND_NUTRIENT_COMPARISON[1])}
              >
                Show high-nutrient evidence
              </button>
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}
