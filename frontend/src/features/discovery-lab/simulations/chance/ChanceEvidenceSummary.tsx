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
          <h3>Recent draws</h3>
          <p>
            Each draw is independent; a streak does not change the next one.
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
          <p className="chance-recent-empty">No draws yet.</p>
        )}
      </section>

      <div className="chance-sample-strip">
        <div>
          <strong>{total.toLocaleString()}</strong>
          <span>trials</span>
        </div>
        <div>
          <strong>
            {total ? `${((counts[outcome] / total) * 100).toFixed(1)}%` : "—"}
            <small>
              {" · expected "}
              {(chances[outcome] * 100).toFixed(1)}%
            </small>
          </strong>
          <span>outcome {outcome + 1} observed</span>
        </div>
        <div>
          <strong>
            {weights[outcome]}
            <small> of {weights.reduce((sum, value) => sum + value, 0)}</small>
          </strong>
          <span>outcome {outcome + 1} weight</span>
        </div>
      </div>
    </>
  );
}
