import { useId, useState } from "react";
export type LifeInvestigation = {
  label: string;
  predict: string;
  choices: string[];
  fixed: string;
  cases: [string, () => string][];
  explain: string;
};
export function LifeInvestigations({ items }: { items: LifeInvestigation[] }) {
  const id = useId();
  const [active, setActive] = useState(0),
    [prediction, setPrediction] = useState<string | null>(null),
    [results, setResults] = useState<Record<string, string>>({});
  const item = items[active];
  const change = (index: number) => {
    setActive(index);
    setPrediction(null);
    setResults({});
  };
  return (
    <section className="life-investigation" aria-label="Guided investigations">
      <div className="life-tabs" role="tablist" aria-label="Investigations">
        {items.map((entry, index) => (
          <button
            key={entry.label}
            id={`${id}-${index}`}
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-controls={`${id}-panel`}
            tabIndex={index === active ? 0 : -1}
            onClick={() => change(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                const next =
                  (active +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    items.length) %
                  items.length;
                change(next);
                document.getElementById(`${id}-${next}`)?.focus();
              }
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${active}`}
        className="life-investigation-grid"
      >
        <div>
          <small>1. Predict</small>
          <h3>{item.predict}</h3>
          <div className="life-actions">
            {item.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={choice === prediction}
                onClick={() => {
                  setPrediction(choice);
                  setResults({});
                }}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
        <div>
          <small>2. Compare</small>
          <p>{item.fixed}</p>
          <div className="life-actions">
            {item.cases.map(([label, run]) => (
              <button
                key={label}
                type="button"
                disabled={!prediction}
                onClick={() => {
                  const result = run();
                  setResults((previous) => ({ ...previous, [label]: result }));
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {!prediction && (
            <p className="life-hint">
              Choose a prediction before running the comparison.
            </p>
          )}
        </div>
        <div>
          <small>3. Explain</small>
          <p>
            {Object.keys(results).length === item.cases.length
              ? item.explain
              : "Run both trials, then use their evidence to explain the comparison."}
          </p>
          {Object.entries(results).map(([label, result]) => (
            <p className="life-snapshot" key={label}>
              <strong>Evidence from {label.toLowerCase()}:</strong> {result}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
