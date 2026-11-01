import { lazy, Suspense, useState } from "react";
import {
  countOutcomes,
  drawOutcomes,
  fairnessDistance,
  probabilities,
} from "@family-manager/family-api/discovery-models/math-life";
import { ChanceDistribution } from "./ChanceArt";
import {
  ChanceGuidedChallenges,
  type CountPrediction,
  type SampleSnapshot,
  type WeightPrediction,
} from "./chance/ChanceGuidedChallenges";
import { ChanceEvidenceSummary } from "./chance/ChanceEvidenceSummary";
import { ChanceOpenInvestigation } from "./chance/ChanceOpenInvestigation";
import "./tactile/tactile.css";

const TableCanvas = lazy(() =>
  import("./tactile/TableCanvas").then((module) => ({
    default: module.TableCanvas,
  })),
);

const FAIR_WEIGHTS = [1, 1, 1, 1];
const DOUBLED_WEIGHTS = [2, 1, 1, 1];
const RECENT_LIMIT = 12;

function freshSample(weights: number[], trials: number) {
  const draws = drawOutcomes(weights, trials);
  const counts = countOutcomes(draws, weights.length);
  return {
    draws,
    snapshot: { counts, gap: fairnessDistance(counts, weights) },
  };
}

export function ChanceCarnivalSimulation() {
  const [die, setDie] = useState(false);
  const [weights, setWeights] = useState(FAIR_WEIGHTS);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const [outcome, setOutcome] = useState(0);
  const [batch, setBatch] = useState(10);
  const [last, setLast] = useState<number | null>(null);
  const [recent, setRecent] = useState<number[]>([]);
  const [prediction, setPrediction] = useState<CountPrediction | null>(null);
  const [smallSample, setSmallSample] = useState<SampleSnapshot | null>(null);
  const [largeSample, setLargeSample] = useState<SampleSnapshot | null>(null);
  const [weightPrediction, setWeightPrediction] =
    useState<WeightPrediction | null>(null);
  const [weightedSample, setWeightedSample] = useState<SampleSnapshot | null>(
    null,
  );

  const chances = probabilities(weights);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const valid = weights.some((weight) => weight > 0);
  const fair = valid && weights.every((weight) => weight === weights[0]);

  const clearGuidedWork = () => {
    setPrediction(null);
    setSmallSample(null);
    setLargeSample(null);
    setWeightPrediction(null);
    setWeightedSample(null);
  };

  const showFreshSample = (
    nextWeights: number[],
    draws: number[],
    nextCounts: number[],
  ) => {
    setDie(false);
    setWeights(nextWeights);
    setCounts(nextCounts);
    setOutcome(0);
    setLast(draws.at(-1) ?? null);
    setRecent(draws.slice(-RECENT_LIMIT));
  };

  const clear = () => {
    setCounts(weights.map(() => 0));
    setLast(null);
    setRecent([]);
    clearGuidedWork();
  };

  const setMode = (value: boolean) => {
    const nextWeights = Array(value ? 6 : 4).fill(1);
    setDie(value);
    setWeights(nextWeights);
    setCounts(nextWeights.map(() => 0));
    setOutcome(0);
    setLast(null);
    setRecent([]);
    clearGuidedWork();
  };

  const changeWeight = (value: number) => {
    setWeights(
      weights.map((weight, index) => (index === outcome ? value : weight)),
    );
    setCounts(weights.map(() => 0));
    setLast(null);
    setRecent([]);
    clearGuidedWork();
  };

  const run = (size = batch) => {
    if (!valid) return;
    const draws = drawOutcomes(weights, size);
    const additions = countOutcomes(draws, weights.length);
    setLast(draws.at(-1) ?? null);
    setRecent((previous) => [...previous, ...draws].slice(-RECENT_LIMIT));
    setCounts((previous) =>
      previous.map((count, index) => count + additions[index]),
    );
    clearGuidedWork();
  };

  const runSmallSample = () => {
    if (!prediction) return;
    const sample = freshSample(FAIR_WEIGHTS, 12);
    showFreshSample(FAIR_WEIGHTS, sample.draws, sample.snapshot.counts);
    setSmallSample(sample.snapshot);
    setLargeSample(null);
    setWeightPrediction(null);
    setWeightedSample(null);
  };

  const runLargeSample = () => {
    if (!smallSample) return;
    const sample = freshSample(FAIR_WEIGHTS, 1200);
    showFreshSample(FAIR_WEIGHTS, sample.draws, sample.snapshot.counts);
    setLargeSample(sample.snapshot);
    setWeightPrediction(null);
    setWeightedSample(null);
  };

  const runWeightedSample = () => {
    if (!largeSample || !weightPrediction) return;
    const sample = freshSample(DOUBLED_WEIGHTS, 200);
    showFreshSample(DOUBLED_WEIGHTS, sample.draws, sample.snapshot.counts);
    setWeightedSample(sample.snapshot);
  };

  const choosePrediction = (value: CountPrediction) => {
    setPrediction(value);
    setSmallSample(null);
    setLargeSample(null);
    setWeightPrediction(null);
    setWeightedSample(null);
  };

  const chooseWeightPrediction = (value: WeightPrediction) => {
    setWeightPrediction(value);
    setWeightedSample(null);
  };

  const reset = () => {
    setDie(false);
    setWeights(FAIR_WEIGHTS);
    setCounts([0, 0, 0, 0]);
    setOutcome(0);
    setBatch(10);
    setLast(null);
    setRecent([]);
    clearGuidedWork();
  };

  return (
    <div className="tactile-exhibit chance-exhibit">
      <header className="tactile-heading chance-heading">
        <span>
          {valid
            ? fair
              ? `EQUAL WEIGHTS · ${chances.length} EQUALLY LIKELY OUTCOMES`
              : `UNEQUAL WEIGHTS · OUTCOME 1 HAS ${(chances[0] * 100).toFixed(0)}% CHANCE`
            : "NO POSSIBLE OUTCOME"}
        </span>
        <h2>Can fair chances give uneven results?</h2>
        <p>
          Predict, test two fresh samples, and explain the difference between a
          theoretical chance and an observed share.
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
              : "Sector area shows theoretical chance; the pointer shows the last draw."}
          </p>
        </div>
        <ChanceDistribution
          chances={chances}
          counts={counts}
          selected={outcome}
          onSelect={setOutcome}
        />
      </div>
      <ChanceEvidenceSummary
        recent={recent}
        counts={counts}
        weights={weights}
        outcome={outcome}
        chances={chances}
      />
      <ChanceGuidedChallenges
        prediction={prediction}
        smallSample={smallSample}
        largeSample={largeSample}
        weightPrediction={weightPrediction}
        weightedSample={weightedSample}
        onChoosePrediction={choosePrediction}
        onRunSmallSample={runSmallSample}
        onRunLargeSample={runLargeSample}
        onChooseWeightPrediction={chooseWeightPrediction}
        onRunWeightedSample={runWeightedSample}
      />
      <ChanceOpenInvestigation
        die={die}
        weights={weights}
        counts={counts}
        outcome={outcome}
        batch={batch}
        chances={chances}
        valid={valid}
        fair={fair}
        onSetMode={setMode}
        onSetOutcome={setOutcome}
        onChangeWeight={changeWeight}
        onSetBatch={setBatch}
        onRun={() => run()}
        onClear={clear}
        onReset={reset}
      />
    </div>
  );
}
