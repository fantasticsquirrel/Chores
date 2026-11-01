import { useId } from "react";

export type SampleSnapshot = {
  counts: number[];
  gap: number;
};

export type CountPrediction = "exact" | "different";
export type WeightPrediction = "two-fifths" | "one-half";

type ChanceGuidedChallengesProps = {
  prediction: CountPrediction | null;
  smallSample: SampleSnapshot | null;
  largeSample: SampleSnapshot | null;
  weightPrediction: WeightPrediction | null;
  weightedSample: SampleSnapshot | null;
  onChoosePrediction: (prediction: CountPrediction) => void;
  onRunSmallSample: () => void;
  onRunLargeSample: () => void;
  onChooseWeightPrediction: (prediction: WeightPrediction) => void;
  onRunWeightedSample: () => void;
};

export function ChanceGuidedChallenges({
  prediction,
  smallSample,
  largeSample,
  weightPrediction,
  weightedSample,
  onChoosePrediction,
  onRunSmallSample,
  onRunLargeSample,
  onChooseWeightPrediction,
  onRunWeightedSample,
}: ChanceGuidedChallengesProps) {
  const id = useId();
  const smallCountsEqual =
    smallSample !== null && new Set(smallSample.counts).size === 1;
  const largerWasCloser =
    smallSample !== null &&
    largeSample !== null &&
    largeSample.gap < smallSample.gap;

  return (
    <>
      <section
        className="chance-challenge"
        aria-labelledby={`${id}-challenge-one`}
      >
        <header className="chance-challenge-heading">
          <span>CHALLENGE 1 OF 2</span>
          <h3 id={`${id}-challenge-one`}>
            Do equal chances force equal counts?
          </h3>
          <p>
            <strong>Keep fixed:</strong> four outcomes, each with weight 1.{" "}
            <strong>Change:</strong> only the number of trials in each fresh
            sample.
          </p>
        </header>
        <div className="chance-steps">
          <div className="chance-step-card">
            <span>1 · PREDICT</span>
            <h4>What can happen in 12 trials?</h4>
            <div className="dl-actions">
              <button
                type="button"
                aria-pressed={prediction === "exact"}
                onClick={() => onChoosePrediction("exact")}
              >
                All four counts must match
              </button>
              <button
                type="button"
                aria-pressed={prediction === "different"}
                onClick={() => onChoosePrediction("different")}
              >
                The counts can differ
              </button>
            </div>
          </div>
          <div className="chance-step-card">
            <span>2 · TEST A SMALL SAMPLE</span>
            <h4>Start fresh with 12 trials.</h4>
            <button
              type="button"
              disabled={!prediction}
              onClick={onRunSmallSample}
            >
              Run a fresh 12-trial sample
            </button>
            {!prediction && (
              <p>Choose a prediction before revealing the sample.</p>
            )}
          </div>
          <div className="chance-step-card">
            <span>3 · COMPARE</span>
            <h4>Keep the weights fixed; start fresh with 1,200 trials.</h4>
            <button
              type="button"
              disabled={!smallSample}
              onClick={onRunLargeSample}
            >
              Run a fresh 1,200-trial sample
            </button>
            {!smallSample && <p>Run the 12-trial sample first.</p>}
          </div>
        </div>

        {smallSample && (
          <div
            className="chance-evidence"
            aria-live="polite"
            data-testid="chance-challenge-one-feedback"
          >
            <strong>12-trial counts: {smallSample.counts.join(" · ")}</strong>
            <p>
              You predicted that the counts{" "}
              {prediction === "exact" ? "must match" : "can differ"}. This
              sample {smallCountsEqual ? "happened to match" : "did not match"}.
              A fair process can produce uneven counts because fair describes
              the unchanged chance on each trial, not a required pattern in a
              small sample.
            </p>
          </div>
        )}

        {smallSample && largeSample && (
          <div
            className="chance-comparison"
            data-testid="chance-sample-comparison"
            aria-live="polite"
          >
            <div>
              <span>12 trials</span>
              <strong>{smallSample.gap.toFixed(1)} pp gap</strong>
              <small>Counts {smallSample.counts.join(" · ")}</small>
            </div>
            <div>
              <span>1,200 trials</span>
              <strong>{largeSample.gap.toFixed(1)} pp gap</strong>
              <small>Counts {largeSample.counts.join(" · ")}</small>
            </div>
            <p>
              {largerWasCloser
                ? "In this pair, the larger sample is closer to the 25% theoretical shares. Across many repetitions, larger samples tend to have smaller relative gaps."
                : "This larger run was not closer. That can happen: the long-run tendency toward the theoretical shares does not guarantee that every larger sample beats every smaller one."}
            </p>
          </div>
        )}
      </section>

      <section
        className={`chance-challenge chance-challenge-two ${largeSample ? "" : "chance-challenge-locked"}`}
        aria-labelledby={`${id}-challenge-two`}
        aria-disabled={!largeSample}
      >
        <header className="chance-challenge-heading">
          <span>CHALLENGE 2 OF 2</span>
          <h3 id={`${id}-challenge-two`}>
            If one weight doubles, is its chance one-half?
          </h3>
          <p>
            Outcome 1 changes from weight 1 to weight 2. Outcomes 2–4 stay at
            weight 1. Predict before testing a fresh 200-trial sample.
          </p>
        </header>
        {!largeSample ? (
          <p className="chance-locked-message">
            Finish the two fair samples to unlock this comparison.
          </p>
        ) : (
          <div className="chance-weight-test">
            <div>
              <span className="tactile-kicker">PREDICT OUTCOME 1’S CHANCE</span>
              <div className="dl-actions">
                <button
                  type="button"
                  aria-pressed={weightPrediction === "two-fifths"}
                  onClick={() => onChooseWeightPrediction("two-fifths")}
                >
                  2 out of 5 (40%)
                </button>
                <button
                  type="button"
                  aria-pressed={weightPrediction === "one-half"}
                  onClick={() => onChooseWeightPrediction("one-half")}
                >
                  2 out of 4 (50%)
                </button>
              </div>
            </div>
            <button
              type="button"
              disabled={!weightPrediction}
              onClick={onRunWeightedSample}
            >
              Test the doubled weight
            </button>
          </div>
        )}
        {weightedSample && (
          <div
            className="chance-evidence"
            aria-live="polite"
            data-testid="chance-challenge-two-feedback"
          >
            <strong>
              Outcome 1 has weight 2 out of a total weight of 5. Theoretical
              chance: 40.0%.
            </strong>
            <p>
              It appeared {weightedSample.counts[0]} times in 200 trials ({" "}
              {((weightedSample.counts[0] / 200) * 100).toFixed(1)}%). Doubling
              one weight also changes the total from 4 to 5, so the chance is
              2/5, not 2/4. The observed share can differ from 40% in a finite
              sample.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
