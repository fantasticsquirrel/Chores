import { useId } from "react";
import { Slider } from "../SimulationPrimitives";

type ChanceOpenInvestigationProps = {
  die: boolean;
  weights: number[];
  counts: number[];
  outcome: number;
  batch: number;
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
        <summary>Open controls</summary>
        <p>Changing the device or a weight starts a new sample.</p>
        <div className="tactile-console chance-console">
          <div className="tactile-control-group">
            <label htmlFor={`${id}-device`}>Device</label>
            <select
              id={`${id}-device`}
              value={die ? "die" : "spinner"}
              onChange={(event) => onSetMode(event.target.value === "die")}
            >
              <option value="spinner">Four-outcome spinner</option>
              <option value="die">Six-outcome die</option>
            </select>
            <label htmlFor={`${id}-outcome`}>Outcome</label>
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
            <Slider
              label={`Outcome ${outcome + 1} weight`}
              value={weights[outcome]}
              min={0}
              max={10}
              onChange={onChangeWeight}
            />
            <p className="chance-control-note">
              Chance = weight ÷ total weight.
            </p>
          </div>
          <div className="tactile-control-group">
            <label htmlFor={`${id}-trials`}>Next sample</label>
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
            </div>
          </div>
        </div>
      </details>

      <div className="tactile-readout" role="status" aria-live="polite">
        <strong>
          {valid
            ? fair
              ? "Equal chances"
              : "Weighted chances"
            : "Set at least one weight above zero."}
        </strong>
        {" · "}
        {total.toLocaleString()} trials
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>

      <p className="tactile-model-note">
        This model uses computer draws, not physical spins or rolls. A finite
        sample cannot prove fairness. Weights change mathematical chances; they
        do not model a physically loaded die.
      </p>
    </>
  );
}
