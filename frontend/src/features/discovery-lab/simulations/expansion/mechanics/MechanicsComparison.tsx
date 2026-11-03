import { useId, useState } from "react";
export type MechanicsExperiment<S> = {
  title: string;
  question: string;
  choices: readonly string[];
  controlled: string;
  before: S;
  after: S;
  change: string;
  evidence: string;
  explain: string;
  correctChoice?: string;
  changed?: string;
  held?: readonly string[];
};
export function MechanicsComparison<S>({
  experiments,
  onApply,
}: {
  experiments: readonly MechanicsExperiment<S>[];
  onApply: (state: S) => void;
}) {
  const id = useId(),
    [selected, setSelected] = useState(0),
    [prediction, setPrediction] = useState<string | null>(null),
    [step, setStep] = useState<"predict" | "baseline" | "compared">("predict");
  const experiment = experiments[selected];
  return (
    <section className="mechanics-comparison" aria-label="Guided comparisons">
      <div className="mechanics-tabs">
        {experiments.map((item, i) => (
          <button
            key={item.title}
            type="button"
            aria-pressed={selected === i}
            onClick={() => {
              setSelected(i);
              setPrediction(null);
              setStep("predict");
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="mechanics-steps">
        <div>
          <span className="mechanics-step">1. Predict</span>
          <h3 id={`${id}-question`}>{experiment.question}</h3>
          <div
            className="mechanics-choices"
            role="group"
            aria-labelledby={`${id}-question`}
          >
            {experiment.choices.map((choice) => (
              <button
                type="button"
                key={choice}
                aria-pressed={prediction === choice}
                onClick={() => {
                  setPrediction(choice);
                  setStep("predict");
                }}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mechanics-step">2. Compare</span>
          <p>{experiment.controlled}</p>
          <div className="mechanics-actions">
            <button
              type="button"
              disabled={prediction === null}
              onClick={() => {
                onApply({ ...experiment.before });
                setStep("baseline");
              }}
            >
              Set baseline
            </button>
            <button
              type="button"
              disabled={step !== "baseline"}
              onClick={() => {
                onApply({ ...experiment.after });
                setStep("compared");
              }}
            >
              {experiment.change}
            </button>
          </div>
          {prediction === null && (
            <small>Choose a prediction before setting the comparison.</small>
          )}
          {step === "baseline" && (
            <p role="status">
              Baseline is set. Read its measurements, then apply the change.
            </p>
          )}
        </div>
        <div>
          <span className="mechanics-step">3. Explain</span>
          {step === "compared" && (
            <div className="mechanics-evidence" role="status">
              {experiment.correctChoice && (
                <p className="mechanics-feedback">
                  <strong>
                    The evidence{" "}
                    {prediction === experiment.correctChoice
                      ? "supports"
                      : "does not support"}{" "}
                    your prediction.
                  </strong>
                </p>
              )}
              <p>
                <strong>Recorded comparison:</strong> {experiment.evidence}
              </p>
              {experiment.changed && experiment.held && (
                <p className="mechanics-controlled-summary">
                  <strong>Changed:</strong> {experiment.changed}.{" "}
                  <strong>Held:</strong> {experiment.held.join(", ")}.
                </p>
              )}
            </div>
          )}
          <p>
            {step === "compared"
              ? experiment.explain
              : "After the comparison, use the two sets of measurements to explain what changed and what stayed the same."}
          </p>
        </div>
      </div>
    </section>
  );
}
