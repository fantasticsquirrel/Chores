import { useId } from "react";
import { fairnessDistance } from "@family-manager/family-api/discovery-models/math-life";
import { Slider } from "../SimulationPrimitives";

type ChanceOpenInvestigationProps = {
  die: boolean;
  weights: number[];
  counts: number[];
  outcome: number;
  batch: number;
  chances: number[];
  valid: boolean;
  fair: boolean;
  onSetMode: (die: boolean) => void;
  onSetOutcome: (outcome: number) => void;
  onChangeWeight: (weight: number) => void;
  onSetBatch: (batch: number) => void;
  onRun: () => void;
  onClear: () => void;
  onReset: () => void;
};

export function ChanceOpenInvestigation({
  die,
  weights,
  counts,
  outcome,
  batch,
  chances,
  valid,
  fair,
  onSetMode,
  onSetOutcome,
  onChangeWeight,
  onSetBatch,
  onRun,
  onClear,
  onReset,
}: ChanceOpenInvestigationProps) {
  const id = useId();
  const total = counts.reduce((sum, count) => sum + count, 0);

  return (
    <>
      <details className="chance-open-lab">
        <summary>Choose your own device, weights, and sample size</summary>
        <p>
          Change one setting at a time. Changing a device or weight clears the
          current sample because its theoretical chances no longer match.
        </p>
        <div className="tactile-console chance-console">
          <div className="tactile-control-group">
            <span className="tactile-kicker">DEVICE & OUTCOME</span>
            <label htmlFor={`${id}-device`}>Chance device</label>
            <select
              id={`${id}-device`}
              value={die ? "die" : "spinner"}
              onChange={(event) => onSetMode(event.target.value === "die")}
            >
              <option value="spinner">Four-outcome spinner</option>
              <option value="die">Six-outcome die</option>
            </select>
            <label htmlFor={`${id}-outcome`}>Adjust outcome</label>
            <select
              id={`${id}-outcome`}
              value={outcome}
              onChange={(event) => onSetOutcome(Number(event.target.value))}
            >
              {weights.map((_, index) => (
                <option key={index} value={index}>
                  Outcome {index + 1}
                </option>
              ))}
            </select>
          </div>
          <div className="tactile-control-group">
            <span className="tactile-kicker">THEORETICAL CHANCE</span>
            <Slider
              label={`Outcome ${outcome + 1} weight`}
              value={weights[outcome]}
              min={0}
              max={10}
              onChange={onChangeWeight}
            />
            <p className="chance-control-note">
              Chance = weight ÷ total weight.
              <br />
              Changing a weight clears the sample.
            </p>
          </div>
          <div className="tactile-control-group">
            <span className="tactile-kicker">COLLECT EVIDENCE</span>
            <label htmlFor={`${id}-trials`}>Trials in next batch</label>
            <select
              id={`${id}-trials`}
              value={batch}
              onChange={(event) => onSetBatch(Number(event.target.value))}
            >
              {[10, 100, 1000, 10000].map((value) => (
                <option key={value} value={value}>
                  {value.toLocaleString()} trials
                </option>
              ))}
            </select>
            <div className="dl-actions">
              <button type="button" disabled={!valid} onClick={onRun}>
                Run trials
              </button>
              <button type="button" onClick={onClear}>
                Clear sample
              </button>
              <button type="button" onClick={onReset}>
                Reset open investigation
              </button>
            </div>
          </div>
        </div>
      </details>

      <div className="tactile-readout" role="status" aria-live="polite">
        <strong>
          {valid
            ? fair
              ? "Fair by design: every outcome has equal theoretical chance."
              : "Unequal weights: the outcomes do not have equal theoretical chances."
            : "Set at least one weight above zero."}
        </strong>
        <br />
        Trials in current sample: <strong>{total.toLocaleString()}</strong>
        {total > 0 && (
          <>
            {" "}
            · Largest theory–observation gap:{" "}
            <strong>
              {fairnessDistance(counts, weights).toFixed(1)} percentage points
            </strong>
          </>
        )}
        <ul>
          {chances.map((chance, index) => (
            <li key={index}>
              Outcome {index + 1}: theory {(chance * 100).toFixed(1)}% ·
              observed {counts[index]}
              {total > 0
                ? ` (${((counts[index] / total) * 100).toFixed(1)}%)`
                : ""}
            </li>
          ))}
        </ul>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>

      <p className="tactile-model-note">
        Trials are independent pseudorandom draws from the displayed
        probabilities, not physical spins or rolls. A finite sample cannot prove
        fairness. Die weights describe probabilities, not physical loading. An
        outcome does not become more likely because it is “overdue.”
      </p>
    </>
  );
}
