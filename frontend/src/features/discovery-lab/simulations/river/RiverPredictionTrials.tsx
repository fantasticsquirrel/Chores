import {
  RIVER_SLOPE_COMPARISON,
  RIVER_VEGETATION_COMPARISON,
  compareRiverTrials,
  riverActivity,
  type RiverInputs,
} from "@family-manager/family-api/discovery-models/river";
import type {
  RiverLesson,
  SlopePrediction,
  VegetationPrediction,
} from "./useRiverLesson";

const vegetationEvidence = RIVER_VEGETATION_COMPARISON.map((inputs) =>
  riverActivity(inputs),
);
const slopeEvidence = RIVER_SLOPE_COMPARISON.map((inputs) =>
  riverActivity(inputs),
);
const vegetationVariables = compareRiverTrials(...RIVER_VEGETATION_COMPARISON);
const slopeVariables = compareRiverTrials(...RIVER_SLOPE_COMPARISON);

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

const vegetationChoices: {
  value: VegetationPrediction;
  label: string;
}[] = [
  { value: "both", label: "Runoff and soil export both decrease" },
  { value: "runoff-only", label: "Only runoff decreases" },
  { value: "neither", label: "Neither decreases" },
];

const slopeChoices: { value: SlopePrediction; label: string }[] = [
  { value: "both", label: "Runoff and soil moved both increase" },
  { value: "soil-only", label: "Only soil moved increases" },
  { value: "neither", label: "Neither increases" },
];

function formatEvidence(
  label: string,
  evidence: ReturnType<typeof riverActivity>,
) {
  return `${label}: runoff ${evidence.runoffCubicMeters.toFixed(1)} m³ · infiltration ${evidence.infiltrationCubicMeters.toFixed(1)} m³ · soil moved ${evidence.soilMovedKilograms.toFixed(1)} kg · deposited ${evidence.depositedKilograms.toFixed(1)} kg · exported ${evidence.exportedKilograms.toFixed(1)} kg`;
}

export function RiverPredictionTrials({
  lesson,
  onShowTrial,
  onPredictionChange,
}: {
  lesson: RiverLesson;
  onShowTrial: (trial: RiverInputs) => void;
  onPredictionChange: () => void;
}) {
  return (
    <>
      <fieldset className="dl-river-trial">
        <legend>1 · Add vegetation</legend>
        <p>
          Change only vegetation from 0% to 100%. What happens during the same
          40 mm storm on the same 8% slope?
        </p>
        <div className="dl-river-choices">
          {vegetationChoices.map((choice) => (
            <PredictionButton
              key={choice.value}
              selected={lesson.vegetationPrediction === choice.value}
              onClick={() => {
                onPredictionChange();
                lesson.chooseVegetation(choice.value);
              }}
            >
              {choice.label}
            </PredictionButton>
          ))}
        </div>
        <button
          type="button"
          className="dl-river-compare"
          disabled={!lesson.vegetationPrediction || lesson.vegetationComplete}
          onClick={() => {
            lesson.completeVegetation();
            onShowTrial(RIVER_VEGETATION_COMPARISON[1]);
          }}
        >
          Compare vegetation cover
        </button>
        {lesson.vegetationComplete && (
          <div
            className="dl-river-feedback"
            role="status"
            aria-live="polite"
            data-result={
              lesson.vegetationPrediction === "both" ? "match" : "revise"
            }
            data-testid="river-vegetation-feedback"
          >
            <strong>
              {lesson.vegetationPrediction === "both"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>{formatEvidence("Bare", vegetationEvidence[0])}</span>
            <span>{formatEvidence("100% cover", vegetationEvidence[1])}</span>
            <span>
              Changed: {vegetationVariables.changed.join(", ")}. Held:{" "}
              {vegetationVariables.held.join(" · ")}.
            </span>
            <span>
              In this model, cover increases infiltration and protects soil, so
              less water runs off and less sediment leaves downstream.
            </span>
            <div className="dl-river-evidence-actions">
              <button
                type="button"
                onClick={() => onShowTrial(RIVER_VEGETATION_COMPARISON[0])}
              >
                Show bare-ground evidence
              </button>
              <button
                type="button"
                onClick={() => onShowTrial(RIVER_VEGETATION_COMPARISON[1])}
              >
                Show covered evidence
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="dl-river-trial">
        <legend>2 · Steepen the slope</legend>
        <p>
          Change only catchment slope from 2% to 20%. What changes with 40 mm
          rain and 40% vegetation fixed?
        </p>
        <div className="dl-river-choices">
          {slopeChoices.map((choice) => (
            <PredictionButton
              key={choice.value}
              selected={lesson.slopePrediction === choice.value}
              onClick={() => {
                onPredictionChange();
                lesson.chooseSlope(choice.value);
              }}
            >
              {choice.label}
            </PredictionButton>
          ))}
        </div>
        <button
          type="button"
          className="dl-river-compare"
          disabled={!lesson.slopePrediction || lesson.slopeComplete}
          onClick={() => {
            lesson.completeSlope();
            onShowTrial(RIVER_SLOPE_COMPARISON[1]);
          }}
        >
          Compare catchment slopes
        </button>
        {lesson.slopeComplete && (
          <div
            className="dl-river-feedback"
            role="status"
            aria-live="polite"
            data-result={
              lesson.slopePrediction === "soil-only" ? "match" : "revise"
            }
            data-testid="river-slope-feedback"
          >
            <strong>
              {lesson.slopePrediction === "soil-only"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>{formatEvidence("2% slope", slopeEvidence[0])}</span>
            <span>{formatEvidence("20% slope", slopeEvidence[1])}</span>
            <span>
              Changed: {slopeVariables.changed.join(", ")}. Held:{" "}
              {slopeVariables.held.join(" · ")}.
            </span>
            <span>
              The teaching formula holds runoff fixed when rain and cover stay
              fixed; slope changes only the moved and exported soil terms.
            </span>
            <div className="dl-river-evidence-actions">
              <button
                type="button"
                onClick={() => onShowTrial(RIVER_SLOPE_COMPARISON[0])}
              >
                Show 2% evidence
              </button>
              <button
                type="button"
                onClick={() => onShowTrial(RIVER_SLOPE_COMPARISON[1])}
              >
                Show 20% evidence
              </button>
            </div>
          </div>
        )}
      </fieldset>
    </>
  );
}
