import { useId } from "react";

export type SampleSnapshot = {
  counts: number[];
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

function observedShares(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  return counts.map((count) => (total ? (count / total) * 100 : 0));
}

function sharesText(counts: number[]) {
  return observedShares(counts)
    .map((share) => `${share.toFixed(1)}%`)
    .join(" · ");
}

function distanceFromEqualChance(counts: number[]) {
  return Math.max(
    ...observedShares(counts).map((share) => Math.abs(share - 25)),
  );
}

function SampleDistribution({
  label,
  counts,
}: {
  label: string;
  counts: number[];
}) {
  const shares = observedShares(counts);
  return (
    <div className="chance-snapshot">
      <span>{label}</span>
      <strong>{sharesText(counts)}</strong>
      <div className="chance-snapshot-bars" aria-hidden="true">
        {shares.map((share, index) => (
          <div key={index}>
            <i>{index + 1}</i>
            <span>
              <b style={{ width: `${share}%` }} />
              <em />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    distanceFromEqualChance(largeSample.counts) <
      distanceFromEqualChance(smallSample.counts);

  return (
    <>
      <section
        className="chance-challenge"
        aria-labelledby={`${id}-challenge-one`}
      >
        <header className="chance-challenge-heading">
          <h3 id={`${id}-challenge-one`}>1. Compare sample sizes</h3>
          <p>Each outcome stays at 25%. Only the sample size changes.</p>
        </header>
        <div className="chance-trial-sequence">
          <div className="chance-trial-step chance-trial-predict">
            <span className="chance-step-number" aria-hidden="true">
              1
            </span>
            <h4>Predict: 12 trials</h4>
            <div className="dl-actions">
              <button
                type="button"
                aria-pressed={prediction === "exact"}
                onClick={() => onChoosePrediction("exact")}
              >
                Counts must match
              </button>
              <button
                type="button"
                aria-pressed={prediction === "different"}
                onClick={() => onChoosePrediction("different")}
              >
                Counts can differ
              </button>
            </div>
          </div>
          <div className="chance-trial-step">
            <span className="chance-step-number" aria-hidden="true">
              2
            </span>
            <h4>Small sample</h4>
            <button
              type="button"
              disabled={!prediction}
              onClick={onRunSmallSample}
            >
              Run 12 trials
            </button>
            {!prediction && <p>Predict first.</p>}
          </div>
          <div className="chance-trial-step">
            <span className="chance-step-number" aria-hidden="true">
              3
            </span>
            <h4>Larger sample</h4>
            <button
              type="button"
              disabled={!smallSample}
              onClick={onRunLargeSample}
            >
              Run 1,200 trials
            </button>
            {!smallSample && <p>Run 12 trials first.</p>}
          </div>
        </div>

        {smallSample && (
          <div
            className="chance-evidence"
            aria-live="polite"
            data-testid="chance-challenge-one-feedback"
          >
            <strong>Counts: {smallSample.counts.join(" · ")}</strong>
            <p>
              {prediction === "exact"
                ? smallCountsEqual
                  ? "They matched this time, but that is not required. Each fair draw is 25%."
                  : "They differed. Each fair draw is 25%; short-run counts need not match."
                : smallCountsEqual
                  ? "They matched this time, but counts can still differ. Each fair draw is 25%."
                  : "They differed, as you predicted. Each fair draw is 25%; short-run counts need not match."}
            </p>
          </div>
        )}

        {smallSample && largeSample && (
          <div
            className="chance-comparison"
            data-testid="chance-sample-comparison"
            aria-live="polite"
          >
            <SampleDistribution label="12 trials" counts={smallSample.counts} />
            <SampleDistribution
              label="1,200 trials"
              counts={largeSample.counts}
            />
            <p>
              Expected for both: 25% each.{" "}
              {largerWasCloser
                ? "This time, 1,200 trials are closer overall to 25%. Larger samples usually settle nearer the expected shares, but any one larger sample can be farther away."
                : "This time, 1,200 trials are not closer overall. Larger samples usually settle nearer the expected shares, but any one larger sample can be farther away."}
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
          <h3 id={`${id}-challenge-two`}>2. Change one weight</h3>
          <p>Outcome 1 has weight 2. Outcomes 2–4 each have weight 1.</p>
        </header>
        {!largeSample ? (
          <p className="chance-locked-message">
            Complete both fair samples first.
          </p>
        ) : (
          <div className="chance-weight-test">
            <div
              className="chance-weight-ratio"
              aria-label="Outcome 1 has two of five total weight units"
            >
              <span className="chance-weight-total">Total weight = 5</span>
              <div aria-hidden="true">
                <i className="chance-weight-one">1</i>
                <i className="chance-weight-one">1</i>
                <i>2</i>
                <i>3</i>
                <i>4</i>
              </div>
              <strong>Outcome 1 owns 2 of 5 units</strong>
            </div>
            <div>
              <strong>Predict outcome 1’s chance</strong>
              <div className="dl-actions">
                <button
                  type="button"
                  aria-pressed={weightPrediction === "two-fifths"}
                  onClick={() => onChooseWeightPrediction("two-fifths")}
                >
                  40% (2 of 5)
                </button>
                <button
                  type="button"
                  aria-pressed={weightPrediction === "one-half"}
                  onClick={() => onChooseWeightPrediction("one-half")}
                >
                  50% (2 of 4)
                </button>
              </div>
            </div>
            <button
              type="button"
              disabled={!weightPrediction}
              onClick={onRunWeightedSample}
            >
              Run 200 trials
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
              Outcome 1: {((weightedSample.counts[0] / 200) * 100).toFixed(1)}%
              {" · expected 40%"}
            </strong>
            <p>
              {weightPrediction === "two-fifths"
                ? "Correct: 2/5 = 40%."
                : "The total weight is 5, not 4: 2/5 = 40%."}{" "}
              A finite sample can differ from 40%.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
