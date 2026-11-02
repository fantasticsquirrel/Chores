import {
  CIRCUIT_SWITCH_COMPARISON,
  CIRCUIT_VOLTAGE_COMPARISON,
  circuitActivity,
  compareCircuitTrials,
  type CircuitInputs,
} from "@family-manager/family-api/discovery-models/circuit";
import type {
  CircuitLesson,
  PathPrediction,
  VoltagePrediction,
} from "./useCircuitLesson";

const pathEvidence = CIRCUIT_SWITCH_COMPARISON.map((inputs) =>
  circuitActivity(inputs),
);
const voltageEvidence = CIRCUIT_VOLTAGE_COMPARISON.map((inputs) =>
  circuitActivity(inputs),
);
const pathVariables = compareCircuitTrials(...CIRCUIT_SWITCH_COMPARISON);
const voltageVariables = compareCircuitTrials(...CIRCUIT_VOLTAGE_COMPARISON);

const pathChoices: { value: PathPrediction; label: string }[] = [
  {
    value: "series-off",
    label: "All off in series; houses 1 and 3 on in parallel",
  },
  { value: "one-off", label: "Only house 2 off in both" },
  { value: "all-off", label: "All houses off in both" },
];

const voltageChoices: { value: VoltagePrediction; label: string }[] = [
  {
    value: "quadratic",
    label: "Current doubles; power and energy quadruple",
  },
  { value: "linear", label: "Current and power both double" },
  { value: "unchanged", label: "Current and power stay unchanged" },
];

function PredictionButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

export function CircuitPredictionTrials({
  lesson,
  onShowTrial,
  onPredictionChange,
}: {
  lesson: CircuitLesson;
  onShowTrial: (trial: CircuitInputs) => void;
  onPredictionChange: () => void;
}) {
  return (
    <>
      <fieldset className="dl-circuit-trial">
        <legend>1 · Open one switch</legend>
        <p>
          Keep the ideal source at 12 V and house 2 open. What changes when the
          same three 12 Ω resistors move from one series path to three parallel
          branches?
        </p>
        <div className="dl-circuit-choices">
          {pathChoices.map((choice) => (
            <PredictionButton
              key={choice.value}
              selected={lesson.pathPrediction === choice.value}
              onClick={() => {
                onPredictionChange();
                lesson.choosePath(choice.value);
              }}
            >
              {choice.label}
            </PredictionButton>
          ))}
        </div>
        <button
          type="button"
          className="dl-circuit-compare"
          disabled={!lesson.pathPrediction || lesson.pathComplete}
          onClick={() => {
            lesson.completePath();
            onShowTrial(CIRCUIT_SWITCH_COMPARISON[1]);
          }}
        >
          Compare series and parallel
        </button>
        {lesson.pathComplete && (
          <div
            className="dl-circuit-feedback"
            role="status"
            aria-live="polite"
            data-result={
              lesson.pathPrediction === "series-off" ? "match" : "revise"
            }
            data-testid="circuit-path-feedback"
          >
            <strong>
              {lesson.pathPrediction === "series-off"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>
              Series, house 2 open:{" "}
              {pathEvidence[0].totalCurrentAmperes.toFixed(2)} A source current
              · {pathEvidence[0].sourcePowerWatts.toFixed(1)} W source power ·
              all houses 0.0 W
            </span>
            <span>
              Parallel, house 2 open:{" "}
              {pathEvidence[1].totalCurrentAmperes.toFixed(2)} A source current
              · houses 1–3 power{" "}
              {pathEvidence[1].housePowerWatts
                .map((value) => value.toFixed(1))
                .join(", ")}{" "}
              W
            </span>
            <span>
              Changed: {pathVariables.changed.join(", ")}. Held:{" "}
              {pathVariables.held.join(" · ")}.
            </span>
            <span>
              Every series load loses its only complete path. In parallel,
              branches 1 and 3 remain complete.
            </span>
            <div className="dl-circuit-evidence-actions">
              <button
                type="button"
                onClick={() => onShowTrial(CIRCUIT_SWITCH_COMPARISON[0])}
              >
                Show series evidence
              </button>
              <button
                type="button"
                onClick={() => onShowTrial(CIRCUIT_SWITCH_COMPARISON[1])}
              >
                Show parallel evidence
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="dl-circuit-trial">
        <legend>2 · Double the voltage</legend>
        <p>
          Keep all three 12 Ω resistors in parallel with every switch closed.
          What happens when the ideal source changes from 6 V to 12 V?
        </p>
        <div className="dl-circuit-choices">
          {voltageChoices.map((choice) => (
            <PredictionButton
              key={choice.value}
              selected={lesson.voltagePrediction === choice.value}
              onClick={() => {
                onPredictionChange();
                lesson.chooseVoltage(choice.value);
              }}
            >
              {choice.label}
            </PredictionButton>
          ))}
        </div>
        <button
          type="button"
          className="dl-circuit-compare"
          disabled={!lesson.voltagePrediction || lesson.voltageComplete}
          onClick={() => {
            lesson.completeVoltage();
            onShowTrial(CIRCUIT_VOLTAGE_COMPARISON[1]);
          }}
        >
          Compare 6 V and 12 V
        </button>
        {lesson.voltageComplete && (
          <div
            className="dl-circuit-feedback"
            role="status"
            aria-live="polite"
            data-result={
              lesson.voltagePrediction === "quadratic" ? "match" : "revise"
            }
            data-testid="circuit-voltage-feedback"
          >
            <strong>
              {lesson.voltagePrediction === "quadratic"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>
              6 V: each house{" "}
              {voltageEvidence[0].houseCurrentAmperes[0].toFixed(2)} A ·{" "}
              {voltageEvidence[0].housePowerWatts[0].toFixed(1)} W ·{" "}
              {voltageEvidence[0].houseEnergyJoules[0].toFixed(1)} J in 10 s
            </span>
            <span>
              12 V: each house{" "}
              {voltageEvidence[1].houseCurrentAmperes[0].toFixed(2)} A ·{" "}
              {voltageEvidence[1].housePowerWatts[0].toFixed(1)} W ·{" "}
              {voltageEvidence[1].houseEnergyJoules[0].toFixed(1)} J in 10 s
            </span>
            <span>
              Changed: {voltageVariables.changed.join(", ")}. Held:{" "}
              {voltageVariables.held.join(" · ")}.
            </span>
            <span>
              For each fixed resistor, I = V ÷ R and P = V × I = V² ÷ R.
              Doubling V doubles I, so power and 10-second energy both become
              four times as large.
            </span>
            <div className="dl-circuit-evidence-actions">
              <button
                type="button"
                onClick={() => onShowTrial(CIRCUIT_VOLTAGE_COMPARISON[0])}
              >
                Show 6 V evidence
              </button>
              <button
                type="button"
                onClick={() => onShowTrial(CIRCUIT_VOLTAGE_COMPARISON[1])}
              >
                Show 12 V evidence
              </button>
            </div>
          </div>
        )}
      </fieldset>
    </>
  );
}
