import { lazy, Suspense, useId, useState } from "react";
import {
  fairnessDistance,
  probabilities,
  sampleOutcomes,
} from "@family-manager/family-api/discovery-models/math-life";
import { ChanceDistribution } from "./ChanceArt";
import { Slider } from "./SimulationPrimitives";
import "./tactile/tactile.css";
const TableCanvas = lazy(() =>
  import("./tactile/TableCanvas").then((module) => ({
    default: module.TableCanvas,
  })),
);
export function ChanceCarnivalSimulation() {
  const id = useId();
  const [die, setDie] = useState(false),
    [weights, setWeights] = useState([1, 1, 1, 1]);
  const [counts, setCounts] = useState([0, 0, 0, 0]),
    [outcome, setOutcome] = useState(0),
    [batch, setBatch] = useState(10);
  const [last, setLast] = useState<number | null>(null),
    [prediction, setPrediction] = useState<string | null>(null);
  const chances = probabilities(weights),
    total = counts.reduce((sum, count) => sum + count, 0);
  const valid = weights.some((weight) => weight > 0),
    fair = valid && weights.every((weight) => weight === weights[0]);
  const clear = () => {
    setCounts(weights.map(() => 0));
    setLast(null);
  };
  const setMode = (value: boolean) => {
    setDie(value);
    setWeights(Array(value ? 6 : 4).fill(1));
    setCounts(Array(value ? 6 : 4).fill(0));
    setOutcome(0);
    setLast(null);
  };
  const changeWeight = (value: number) => {
    setWeights(weights.map((weight, i) => (i === outcome ? value : weight)));
    setCounts(weights.map(() => 0));
    setLast(null);
  };
  const run = (size = batch) => {
    if (!valid) return;
    // Preserve the actual final draw, instead of animating an unrelated result.
    const trials = sampleOutcomes(weights, size - 1),
      finalTrial = sampleOutcomes(weights, 1);
    setLast(finalTrial.findIndex((count) => count === 1));
    setCounts((previous) =>
      previous.map((count, i) => count + trials[i] + finalTrial[i]),
    );
  };
  return (
    <div className="tactile-exhibit chance-exhibit">
      <header className="tactile-heading">
        <span>
          {valid
            ? fair
              ? "EQUAL CHANCES"
              : "UNEQUAL CHANCES"
            : "NO POSSIBLE OUTCOME"}
        </span>
        <h2>Can fair chances give uneven results?</h2>
        <p>
          Set the chances, collect a sample, and compare evidence with theory.
        </p>
      </header>
      <div className="chance-table">
        <div className="chance-machine">
          <div
            className="chance-render"
            role="img"
            aria-label={`${die ? "Six die" : "Four spinner"} outcomes. Theoretical probabilities ${chances.map((chance) => `${(chance * 100).toFixed(1)} percent`).join(", ")}. ${total} trials observed. ${last === null ? "No trials yet." : `Last outcome: ${last + 1}.`} ${fair ? "All outcomes have equal theoretical chances." : "Outcome weights are unequal."}`}
          >
            <Suspense
              fallback={
                <div className="tactile-loading">
                  Loading the probability model…
                </div>
              }
            >
              <TableCanvas
                kind="chance"
                chances={chances}
                die={die}
                last={last}
                selected={outcome}
              />
            </Suspense>
          </div>
          <div className="chance-last">
            <span>LAST RECORDED OUTCOME</span>
            <strong data-testid="chance-last-outcome">
              {last === null ? "No trials yet" : last + 1}
            </strong>
          </div>
          <p className="chance-machine-caption">
            {die
              ? "The top face shows the last sampled outcome."
              : "Sector area sets the chance. The pointer shows the last outcome."}
          </p>
        </div>
        <ChanceDistribution
          chances={chances}
          counts={counts}
          selected={outcome}
          onSelect={setOutcome}
        />
      </div>
      <div className="chance-sample-strip">
        <div>
          <strong>{total.toLocaleString()}</strong>
          <span>trials recorded</span>
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
            <small> / {weights.reduce((a, b) => a + b, 0)}</small>
          </strong>
          <span>
            outcome {outcome + 1} weight / total weight
            <br />
            {(chances[outcome] * 100).toFixed(1)}% theoretical chance
          </span>
        </div>
      </div>
      <div className="tactile-console chance-console">
        <div className="tactile-control-group">
          <span className="tactile-kicker">DEVICE & OUTCOME</span>
          <label htmlFor={`${id}-device`}>Chance device</label>
          <select
            id={`${id}-device`}
            value={die ? "die" : "spinner"}
            onChange={(event) => setMode(event.target.value === "die")}
          >
            <option value="spinner">Four-outcome spinner</option>
            <option value="die">Six-outcome die</option>
          </select>
          <label htmlFor={`${id}-outcome`}>Adjust outcome</label>
          <select
            id={`${id}-outcome`}
            value={outcome}
            onChange={(event) => setOutcome(Number(event.target.value))}
          >
            {weights.map((_, i) => (
              <option key={i} value={i}>
                Outcome {i + 1}
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
            onChange={changeWeight}
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
            onChange={(event) => setBatch(Number(event.target.value))}
          >
            {[10, 100, 1000, 10000].map((value) => (
              <option key={value} value={value}>
                {value.toLocaleString()} trials
              </option>
            ))}
          </select>
          <div className="dl-actions">
            <button type="button" disabled={!valid} onClick={() => run()}>
              Run trials
            </button>
            <button type="button" onClick={clear}>
              Clear sample
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(false);
                setBatch(10);
                setPrediction(null);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
      <div className="tactile-investigation">
        <div>
          <span className="tactile-kicker">PREDICT</span>
          <h3>Must a larger sample match the theoretical chances exactly?</h3>
          <div className="dl-actions">
            {["Must match exactly", "Can still differ"].map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={prediction === label}
                onClick={() => setPrediction(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="tactile-kicker">OBSERVE</span>
          <h3>Keep the weights fixed. Compare a small and a larger sample.</h3>
          <button
            type="button"
            className="tactile-text-button"
            disabled={!valid}
            onClick={() => run(10000)}
          >
            Run 10,000 more
          </button>
          <p>
            Compare the percentage-point gap, not just the raw count difference.
          </p>
        </div>
        <div>
          <span className="tactile-kicker">EXPLAIN</span>
          <p>
            Larger samples usually have smaller relative differences, but a
            particular run need not be closer or exactly equal. Each trial is
            independent.
          </p>
          <p>
            Next, predict what doubling one weight does. Change it, collect a
            fresh sample, and compare all outcomes’ chances.
          </p>
        </div>
      </div>
      <div className="tactile-readout" role="status" aria-live="polite">
        <strong>
          {valid
            ? fair
              ? "Fair by design: every outcome has equal chance."
              : "Unequal chances: this device is not fair."
            : "Set at least one weight above zero."}
        </strong>
        <br />
        Trials recorded: <strong>{total.toLocaleString()}</strong>
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
          {chances.map((chance, i) => (
            <li key={i}>
              Outcome {i + 1}: theory {(chance * 100).toFixed(1)}% · observed{" "}
              {counts[i]}
              {total > 0 ? ` (${((counts[i] / total) * 100).toFixed(1)}%)` : ""}
            </li>
          ))}
        </ul>
      </div>
      <p className="tactile-model-note">
        Trials use independent pseudorandom draws from the chosen probabilities,
        not a physical spin or roll simulation. A finite sample cannot prove
        fairness. Die weights describe probabilities, not a physical loading
        mechanism. An outcome does not become more likely because it is
        “overdue.”
      </p>
    </div>
  );
}
