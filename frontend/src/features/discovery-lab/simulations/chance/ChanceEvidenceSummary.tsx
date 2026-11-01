import { fairnessDistance } from "@family-manager/family-api/discovery-models/math-life";

type ChanceEvidenceSummaryProps = {
  recent: number[];
  counts: number[];
  weights: number[];
  outcome: number;
  chances: number[];
};

export function ChanceEvidenceSummary({
  recent,
  counts,
  weights,
  outcome,
  chances,
}: ChanceEvidenceSummaryProps) {
  const total = counts.reduce((sum, count) => sum + count, 0);

  return (
    <>
      <section
        className="chance-recent"
        aria-label="Recent trial outcomes"
        data-testid="chance-recent-outcomes"
      >
        <div>
          <h3>Most recent outcomes</h3>
          <p>
            Read left to right. A streak does not change the chance of the next
            independent draw.
          </p>
        </div>
        {recent.length ? (
          <ol aria-label={`${recent.length} most recent outcomes`}>
            {recent.map((value, index) => (
              <li
                className={`chance-token chance-token-${value + 1}`}
                key={`${index}-${value}`}
                aria-label={`Outcome ${value + 1}`}
              >
                {value + 1}
              </li>
            ))}
          </ol>
        ) : (
          <p className="chance-recent-empty">
            Run a sample to reveal its final 12 draws.
          </p>
        )}
      </section>

      <div className="chance-sample-strip">
        <div>
          <strong>{total.toLocaleString()}</strong>
          <span>trials in the current sample</span>
        </div>
        <div>
          <strong>
            {total ? `${fairnessDistance(counts, weights).toFixed(1)}` : "—"}
            <small>{total ? " pp" : ""}</small>
          </strong>
          <span>
            largest theory–observation gap
            <br />
            pp = percentage points
          </span>
        </div>
        <div>
          <strong>
            {weights[outcome]}
            <small> / {weights.reduce((sum, value) => sum + value, 0)}</small>
          </strong>
          <span>
            outcome {outcome + 1} weight / total weight
            <br />
            {(chances[outcome] * 100).toFixed(1)}% theoretical chance
          </span>
        </div>
      </div>
    </>
  );
}
