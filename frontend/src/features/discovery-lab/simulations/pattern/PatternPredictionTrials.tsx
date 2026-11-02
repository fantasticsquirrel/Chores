import type { CornerPrediction, TransformPrediction } from "./usePatternLesson";

function PredictionButtons<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="pattern-prediction-options">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected === option.value}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PatternPredictionTrials({
  transformPrediction,
  cornerPrediction,
  transformCompared,
  cornerCompared,
  onTransformPrediction,
  onCornerPrediction,
  onCompareTransformations,
  onCompareCorners,
}: {
  transformPrediction: TransformPrediction | null;
  cornerPrediction: CornerPrediction | null;
  transformCompared: boolean;
  cornerCompared: boolean;
  onTransformPrediction: (prediction: TransformPrediction) => void;
  onCornerPrediction: (prediction: CornerPrediction) => void;
  onCompareTransformations: () => void;
  onCompareCorners: () => void;
}) {
  return (
    <div className="pattern-trials">
      <fieldset className="pattern-trial">
        <legend>1 · Turn or reflect?</legend>
        <p>
          Point M starts 30 units left and 18 units up from the center. Which
          operation moves M farther right: a 90° clockwise turn or a reflection
          across the vertical line?
        </p>
        <PredictionButtons
          options={[
            { value: "turn", label: "Quarter-turn" },
            { value: "reflection", label: "Reflection" },
            { value: "same", label: "Same horizontal position" },
          ]}
          selected={transformPrediction}
          onSelect={onTransformPrediction}
        />
        <button
          className="pattern-run"
          type="button"
          disabled={!transformPrediction}
          onClick={onCompareTransformations}
        >
          Compare the two transformations
        </button>
        {transformCompared && (
          <div
            className="pattern-feedback"
            data-testid="pattern-transform-feedback"
            role="status"
          >
            <strong>
              {transformPrediction === "reflection"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <p>
              Quarter-turn: M is 18 units right and 30 units up. Reflection: M
              is 30 units right and 18 units up. M moved farther right after the
              reflection.
            </p>
            <p>
              Changed: transformation. Held: motif dimensions · center · marked
              point M. Both images keep every corresponding length and angle;
              only the placement and orientation change.
            </p>
          </div>
        )}
      </fieldset>

      <fieldset className="pattern-trial">
        <legend>2 · Add one pentagon</legend>
        <p>
          Three regular pentagons leave a 36° gap. Keep the pentagons regular
          and the same size. What happens when a fourth 108° corner is added at
          the same point?
        </p>
        <PredictionButtons
          options={[
            { value: "exact", label: "Exact fit" },
            { value: "gap", label: "Still a gap" },
            { value: "overlap", label: "72° overlap" },
          ]}
          selected={cornerPrediction}
          onSelect={onCornerPrediction}
        />
        <button
          className="pattern-run"
          type="button"
          disabled={!cornerPrediction}
          onClick={onCompareCorners}
        >
          Compare 3 and 4 pentagons
        </button>
        {cornerCompared && (
          <div
            className="pattern-feedback"
            data-testid="pattern-corner-feedback"
            role="status"
          >
            <strong>
              {cornerPrediction === "overlap"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <p>
              3 × 108° = 324°, leaving 36°. 4 × 108° = 432°, so the fourth
              pentagon covers 72° twice. Adding a whole 108° corner cannot fill
              only the 36° gap.
            </p>
            <p>
              Changed: number of pentagons. Held: regular pentagon shape · side
              length · 108° interior angle · meeting point.
            </p>
          </div>
        )}
      </fieldset>
    </div>
  );
}
