import {
  FRACTION_ADDITION_TRIAL,
  FRACTION_EQUIVALENCE_TRIAL,
} from "@family-manager/family-api/discovery-models/fractions";
import type {
  AdditionPrediction,
  EquivalentPrediction,
  FractionLesson,
} from "./useFractionLesson";

const equivalentChoices: {
  value: EquivalentPrediction;
  label: string;
}[] = [
  { value: "more", label: "More pizza" },
  { value: "same", label: "The same amount" },
  { value: "less", label: "Less pizza" },
];
const additionChoices: { value: AdditionPrediction; label: string }[] = [
  { value: "below", label: "Less than one whole" },
  { value: "one", label: "Exactly one whole" },
  { value: "above", label: "More than one whole" },
];

function Choice({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}>
      {label}
    </button>
  );
}

export function FractionPredictionTrials({
  lesson,
  onEquivalentPrediction,
  onEquivalentCompare,
  onShowEquivalentBefore,
  onShowEquivalentAfter,
  onAdditionPrediction,
  onAdditionCompare,
  onShowAdditionParts,
  onShowAdditionTotal,
}: {
  lesson: FractionLesson;
  onEquivalentPrediction: () => void;
  onEquivalentCompare: () => void;
  onShowEquivalentBefore: () => void;
  onShowEquivalentAfter: () => void;
  onAdditionPrediction: () => void;
  onAdditionCompare: () => void;
  onShowAdditionParts: () => void;
  onShowAdditionTotal: () => void;
}) {
  const addition = FRACTION_ADDITION_TRIAL.addition;
  return (
    <div className="fraction-investigations">
      <fieldset className="fraction-trial">
        <legend>1 · Split the same amount</legend>
        <p>
          Plate A starts at 1/2. Split every selected and unselected piece in
          two. The whole area and selected area stay fixed. What changes?
        </p>
        <div className="fraction-choices">
          {equivalentChoices.map((choice) => (
            <Choice
              key={choice.value}
              label={choice.label}
              selected={lesson.equivalentPrediction === choice.value}
              onClick={() => {
                lesson.chooseEquivalent(choice.value);
                onEquivalentPrediction();
              }}
            />
          ))}
        </div>
        <button
          type="button"
          className="fraction-compare"
          disabled={!lesson.equivalentPrediction || lesson.equivalentComplete}
          onClick={onEquivalentCompare}
        >
          Compare 1/2 with 2/4
        </button>
        {lesson.equivalentComplete && (
          <div
            className="fraction-feedback"
            role="status"
            aria-live="polite"
            data-result={
              lesson.equivalentPrediction === "same" ? "match" : "revise"
            }
            data-testid="fraction-equivalent-feedback"
          >
            <strong>
              {lesson.equivalentPrediction === "same"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>1/2 = 2/4: both cover half of an equal-area whole.</span>
            <span>
              Changed: {FRACTION_EQUIVALENCE_TRIAL.changed.join(" · ")}. Held:{" "}
              {FRACTION_EQUIVALENCE_TRIAL.held.join(" · ")}.
            </span>
            <span>
              There are twice as many selected pieces, but each piece is half as
              large. Piece count changed; the selected amount did not.
            </span>
            <div className="fraction-evidence-actions">
              <button type="button" onClick={onShowEquivalentBefore}>
                Show 1/2 before the split
              </button>
              <button type="button" onClick={onShowEquivalentAfter}>
                Show 2/4 after the split
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="fraction-trial">
        <legend>2 · Add unlike fractions</legend>
        <p>
          Join 2/3 and 3/4 from equal-area wholes. Before combining them,
          predict whether the total fits in one whole.
        </p>
        <div className="fraction-choices">
          {additionChoices.map((choice) => (
            <Choice
              key={choice.value}
              label={choice.label}
              selected={lesson.additionPrediction === choice.value}
              onClick={() => {
                lesson.chooseAddition(choice.value);
                onAdditionPrediction();
              }}
            />
          ))}
        </div>
        <button
          type="button"
          className="fraction-compare"
          disabled={!lesson.additionPrediction || lesson.additionComplete}
          onClick={onAdditionCompare}
        >
          Combine 2/3 and 3/4
        </button>
        {lesson.additionComplete && (
          <div
            className="fraction-feedback"
            role="status"
            aria-live="polite"
            data-result={
              lesson.additionPrediction === "above" ? "match" : "revise"
            }
            data-testid="fraction-addition-feedback"
          >
            <strong>
              {lesson.additionPrediction === "above"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>
              2/3 = {addition.leftCommonNumerator}/{addition.commonDenominator};
              3/4 = {addition.rightCommonNumerator}/{addition.commonDenominator}
              .
            </span>
            <span>
              {addition.leftCommonNumerator}/{addition.commonDenominator} +{" "}
              {addition.rightCommonNumerator}/{addition.commonDenominator} ={" "}
              {addition.commonSumNumerator}/{addition.commonDenominator} ={" "}
              {addition.wholeCount} whole and {addition.remainder.numerator}/
              {addition.remainder.denominator}.
            </span>
            <span>
              Twelfths are the shared unit. Add the selected twelfths, not the
              denominators: the whole still contains 12 equal twelfths.
            </span>
            <div className="fraction-evidence-actions">
              <button type="button" onClick={onShowAdditionParts}>
                Show separate portions
              </button>
              <button type="button" onClick={onShowAdditionTotal}>
                Show the combined total
              </button>
            </div>
          </div>
        )}
      </fieldset>
    </div>
  );
}
