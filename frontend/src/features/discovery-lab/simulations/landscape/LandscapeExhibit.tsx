import { lazy, Suspense, useId, useState, type ReactNode } from "react";
import type { LandscapeState } from "@family-manager/discovery-scenes/landscape/state";
import "./landscape.css";
import "./landscape-learning.css";
const LandscapeCanvas = lazy(() =>
  import("./LandscapeCanvas").then((module) => ({
    default: module.LandscapeCanvas,
  })),
);
export function LandscapeExhibit({
  title,
  introduction,
  state,
  description,
  controls,
  evidence,
  investigations,
  note,
  onSelect,
}: {
  title: string;
  introduction: string;
  state: LandscapeState;
  description: string;
  controls: ReactNode;
  evidence: ReactNode;
  investigations: ReactNode;
  note: string;
  onSelect?: (index: number) => void;
}) {
  return (
    <section className={`landscape-exhibit landscape-${state.kind}`}>
      <div className="landscape-visual">
        <header>
          <h2>{title}</h2>
          <p>{introduction}</p>
        </header>
        <div>
          <Suspense
            fallback={
              <div
                className="landscape-canvas landscape-loading"
                role="img"
                aria-label={description}
              >
                Loading landscape geometry…
              </div>
            }
          >
            <LandscapeCanvas
              state={state}
              description={description}
              onSelect={onSelect}
            />
          </Suspense>
        </div>
      </div>
      <div className="landscape-controls">{controls}</div>
      <div className="landscape-evidence">{evidence}</div>
      {investigations}
      <p className="landscape-model-note">{note}</p>
    </section>
  );
}
export type Investigation = {
  label: string;
  predict: string;
  options: string[];
  action: string;
  explain: string;
  test?: () => void;
  testLabel?: string;
};
export function LandscapeInvestigation({ items }: { items: Investigation[] }) {
  const id = useId();
  const [active, setActive] = useState(0),
    [choice, setChoice] = useState<string | null>(null);
  const item = items[active];
  return (
    <div className="landscape-investigation">
      <div className="landscape-tabs" role="tablist" aria-label="Try this">
        <strong>Try this</strong>
        {items.map((entry, index) => (
          <button
            key={entry.label}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-controls={`${id}-panel`}
            tabIndex={index === active ? 0 : -1}
            aria-selected={index === active}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? items.length - 1
                    : (active +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        items.length) %
                      items.length;
              setActive(next);
              setChoice(null);
              document.getElementById(`${id}-tab-${next}`)?.focus();
            }}
            onClick={() => {
              setActive(index);
              setChoice(null);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div
        className="landscape-steps"
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
      >
        <div>
          <small>1. Predict</small>
          <p>
            <strong>{item.predict}</strong>
          </p>
          <div className="landscape-choices">
            {item.options.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={choice === option}
                onClick={() => setChoice(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div>
          <small>2. Compare</small>
          <p>{item.action}</p>
          {item.test && (
            <button
              type="button"
              className="landscape-test"
              onClick={item.test}
            >
              {item.testLabel ?? "Set up comparison"} →
            </button>
          )}
        </div>
        <div>
          <small>3. Explain</small>
          <p>{item.explain}</p>
          {choice && (
            <p className="landscape-prediction">
              Your prediction: {choice}. Compare it with the result.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
export function LandscapeMetric({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div className="landscape-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {children}
    </div>
  );
}
