import type { ReactNode } from "react";
export function SpaceLearning({
  question,
  choices,
  prediction,
  onPredict,
  observe,
  explain,
}: {
  question: string;
  choices: string[];
  prediction: string | null;
  onPredict: (value: string) => void;
  observe: ReactNode;
  explain: ReactNode;
}) {
  return (
    <div className="space-learning">
      <section>
        <span>01 / Predict</span>
        <h3>{question}</h3>
        <div className="space-choices">
          {choices.map((choice) => (
            <button
              type="button"
              key={choice}
              aria-pressed={prediction === choice}
              onClick={() => onPredict(choice)}
            >
              {choice}
            </button>
          ))}
        </div>
      </section>
      <section>
        <span>02 / Observe</span>
        {observe}
      </section>
      <section>
        <span>03 / Explain</span>
        {explain}
      </section>
    </div>
  );
}
