export type MoonQuarterPrediction = "" | "25" | "50" | "75";
export type MoonOppositePrediction = "" | "first" | "last" | "same";

export function MoonGuidedChallenges({
  quarterPrediction,
  quarterComplete,
  oppositePrediction,
  oppositeComplete,
  onQuarterPrediction,
  onQuarterObserve,
  onOppositePrediction,
  onOppositeCompare,
}: {
  quarterPrediction: MoonQuarterPrediction;
  quarterComplete: boolean;
  oppositePrediction: MoonOppositePrediction;
  oppositeComplete: boolean;
  onQuarterPrediction: (value: MoonQuarterPrediction) => void;
  onQuarterObserve: () => void;
  onOppositePrediction: (value: MoonOppositePrediction) => void;
  onOppositeCompare: () => void;
}) {
  return (
    <div className="moon-challenges">
      <section aria-labelledby="moon-quarter-title">
        <p className="moon-challenge-number">Investigation 1</p>
        <h3 id="moon-quarter-title">Test first quarter</h3>
        <p>
          Keep the Sun direction and Earth viewpoint fixed. At 90° around the
          orbit, how much of the Earth-view disk will look lit?
        </p>
        <div
          className="moon-choice-row"
          role="group"
          aria-label="Your first-quarter prediction"
        >
          {(["25", "50", "75"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={quarterPrediction === value}
              onClick={() => onQuarterPrediction(value)}
            >
              {value}%
            </button>
          ))}
        </div>
        <button
          type="button"
          className="moon-run-button"
          disabled={!quarterPrediction}
          onClick={onQuarterObserve}
        >
          Observe first quarter
        </button>
        {quarterComplete && (
          <div
            className="moon-feedback"
            data-testid="moon-quarter-feedback"
            role="status"
          >
            <strong>
              The result{" "}
              {quarterPrediction === "50" ? "matches" : "differs from"} your
              prediction.
            </strong>
            <p>
              The Earth-view disk is 50% lit. The Sun still illuminates one half
              of the whole Moon; from Earth, this geometry exposes half of that
              sunlit hemisphere. What changed: orbital position. What stayed
              fixed: the Sun direction and Earth viewpoint.
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="moon-opposite-title">
        <p className="moon-challenge-number">Investigation 2</p>
        <h3 id="moon-opposite-title">Compare opposite quarters</h3>
        <p>
          First quarter is 90°; last quarter is 270°. Predict their visible lit
          fractions before comparing them from the same Earth viewpoint.
        </p>
        {quarterComplete ? (
          <div
            className="moon-choice-row moon-choice-row--wide"
            role="group"
            aria-label="Your opposite-quarter prediction"
          >
            {(
              [
                ["first", "First quarter is larger"],
                ["last", "Last quarter is larger"],
                ["same", "Same fraction, opposite sides"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={oppositePrediction === value}
                onClick={() => onOppositePrediction(value)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="moon-gate-note">Complete Investigation 1 first.</p>
        )}
        <button
          type="button"
          className="moon-run-button"
          disabled={!quarterComplete || !oppositePrediction}
          onClick={onOppositeCompare}
        >
          Compare opposite quarters
        </button>
        {oppositeComplete && (
          <div
            className="moon-feedback"
            data-testid="moon-opposite-feedback"
            role="status"
          >
            <strong>
              The result{" "}
              {oppositePrediction === "same" ? "matches" : "differs from"} your
              prediction.
            </strong>
            <div className="moon-quarter-diagrams" aria-hidden="true">
              <span className="moon-mini-disk moon-mini-disk--first" />
              <span className="moon-mini-disk moon-mini-disk--last" />
            </div>
            <p>
              First quarter: 50% · Last quarter: 50%. The bright half appears on
              opposite sides because the Moon moved to the opposite side of its
              orbit. Earth’s shadow was not used. Why can equal fractions have
              different phase names?
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
