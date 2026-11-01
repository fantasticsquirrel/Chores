import { useState } from "react";
import { Text, View } from "react-native";
import {
  countOutcomes,
  drawOutcomes,
  probabilities,
} from "@family-manager/family-api/discovery-models/math-life";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { NativeSceneSurface } from "./NativeSceneSurface";
import { Control } from "./Primitives";
import {
  Choice,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "./LearningPrimitives";

const FAIR_WEIGHTS = [1, 1, 1, 1];
const DOUBLED_WEIGHTS = [2, 1, 1, 1];
const SPINNER_LABELS = ["Gold", "Violet", "Teal", "Coral"];
const SPINNER_COLORS = ["#e4ac43", "#946ac0", "#228b80", "#d87961"];

type Snapshot = {
  counts: number[];
};

function freshSample(weights: number[], trials: number) {
  const draws = drawOutcomes(weights, trials);
  const counts = countOutcomes(draws, weights.length);
  return {
    draws,
    snapshot: { counts },
  };
}

function observedShares(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  return counts.map((count) => (total ? (count / total) * 100 : 0));
}

function sharesText(counts: number[]) {
  return observedShares(counts)
    .map((share) => `${share.toFixed(1)}%`)
    .join(" · ");
}

function distanceFromEqualChance(counts: number[]) {
  return Math.max(
    ...observedShares(counts).map((share) => Math.abs(share - 25)),
  );
}

export function ChanceExploration() {
  const [device, setDevice] = useState<"spinner" | "die">("spinner");
  const [last, setLast] = useState<number | null>(null);
  const [firstWeight, setFirstWeight] = useState(1);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const [recent, setRecent] = useState<number[]>([]);
  const [prediction, setPrediction] = useState("");
  const [smallSample, setSmallSample] = useState<Snapshot | null>(null);
  const [largeSample, setLargeSample] = useState<Snapshot | null>(null);
  const [weightPrediction, setWeightPrediction] = useState("");
  const [weightedSample, setWeightedSample] = useState<Snapshot | null>(null);

  const weights =
    device === "spinner"
      ? [firstWeight, 1, 1, 1]
      : [firstWeight, 1, 1, 1, 1, 1];
  const chances = probabilities(weights);
  const trials = counts.reduce((sum, count) => sum + count, 0);
  const outcomeLabels =
    device === "spinner"
      ? SPINNER_LABELS
      : weights.map((_, index) => `Face ${index + 1}`);

  const clearGuidedWork = () => {
    setPrediction("");
    setSmallSample(null);
    setLargeSample(null);
    setWeightPrediction("");
    setWeightedSample(null);
  };

  const showFreshSample = (
    nextFirstWeight: number,
    draws: number[],
    nextCounts: number[],
  ) => {
    setDevice("spinner");
    setFirstWeight(nextFirstWeight);
    setCounts(nextCounts);
    setLast(draws.at(-1) ?? null);
    setRecent(draws.slice(-12));
  };

  const reset = () => {
    setDevice("spinner");
    setLast(null);
    setFirstWeight(1);
    setCounts([0, 0, 0, 0]);
    setRecent([]);
    clearGuidedWork();
  };

  const runSmall = () => {
    if (!prediction) return;
    const sample = freshSample(FAIR_WEIGHTS, 12);
    showFreshSample(1, sample.draws, sample.snapshot.counts);
    setSmallSample(sample.snapshot);
    setLargeSample(null);
    setWeightPrediction("");
    setWeightedSample(null);
  };

  const runLarge = () => {
    if (!smallSample) return;
    const sample = freshSample(FAIR_WEIGHTS, 1200);
    showFreshSample(1, sample.draws, sample.snapshot.counts);
    setLargeSample(sample.snapshot);
    setWeightPrediction("");
    setWeightedSample(null);
  };

  const runWeighted = () => {
    if (!largeSample || !weightPrediction) return;
    const sample = freshSample(DOUBLED_WEIGHTS, 200);
    showFreshSample(2, sample.draws, sample.snapshot.counts);
    setWeightedSample(sample.snapshot);
  };

  const runOpenSample = (size: number) => {
    const draws = drawOutcomes(weights, size);
    const additions = countOutcomes(draws, weights.length);
    setCounts((previous) =>
      weights.map((_, index) => (previous[index] ?? 0) + additions[index]),
    );
    setLast(draws.at(-1) ?? null);
    setRecent((previous) => [...previous, ...draws].slice(-12));
    clearGuidedWork();
  };

  const largerWasCloser =
    smallSample !== null &&
    largeSample !== null &&
    distanceFromEqualChance(largeSample.counts) <
      distanceFromEqualChance(smallSample.counts);
  const smallCountsEqual =
    smallSample !== null && new Set(smallSample.counts).size === 1;

  return (
    <LearningFrame onReset={reset}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}
      >
        1. Compare sample sizes
      </Text>
      <Explanation>
        Each outcome stays at 25%. Only the sample size changes.
      </Explanation>
      <Choice
        label="Predict: 12 trials"
        value={prediction}
        onChange={(value) => {
          setPrediction(value);
          setSmallSample(null);
          setLargeSample(null);
          setWeightPrediction("");
          setWeightedSample(null);
        }}
        options={[
          { value: "exact", label: "Counts must match" },
          { value: "different", label: "Counts can differ" },
        ]}
      />
      <ActionButton
        label="Run 12 trials"
        disabled={!prediction}
        onPress={runSmall}
      />
      {smallSample && (
        <Explanation>
          Counts: {smallSample.counts.join(" · ")}.{" "}
          {prediction === "exact"
            ? smallCountsEqual
              ? "They matched this time, but that is not required. Each fair draw is 25%."
              : "They differed. Each fair draw is 25%; short-run counts need not match."
            : smallCountsEqual
              ? "They matched this time, but counts can still differ. Each fair draw is 25%."
              : "They differed, as you predicted. Each fair draw is 25%; short-run counts need not match."}
        </Explanation>
      )}
      <ActionButton
        label="Run 1,200 trials"
        disabled={!smallSample}
        onPress={runLarge}
      />
      {smallSample && largeSample && (
        <Explanation>
          12 trials: {sharesText(smallSample.counts)}. 1,200 trials:{" "}
          {sharesText(largeSample.counts)}. Expected for both: 25% each.{" "}
          {largerWasCloser
            ? "This time, 1,200 trials are closer overall. Larger samples usually settle nearer the expected shares, but any one larger sample can be farther away."
            : "This time, 1,200 trials are not closer overall. Larger samples usually settle nearer the expected shares, but any one larger sample can be farther away."}
        </Explanation>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        2. Change one weight
      </Text>
      <Explanation>
        Outcome 1 has weight 2. Outcomes 2–4 each have weight 1.
      </Explanation>
      {!largeSample ? (
        <Explanation>Complete both fair samples first.</Explanation>
      ) : (
        <>
          <Choice
            label="Predict outcome 1’s chance"
            value={weightPrediction}
            onChange={(value) => {
              setWeightPrediction(value);
              setWeightedSample(null);
            }}
            options={[
              { value: "two-fifths", label: "40% (2 of 5)" },
              { value: "one-half", label: "50% (2 of 4)" },
            ]}
          />
          <ActionButton
            label="Run 200 trials"
            disabled={!weightPrediction}
            onPress={runWeighted}
          />
        </>
      )}
      {weightedSample && (
        <Explanation>
          Outcome 1: {((weightedSample.counts[0] / 200) * 100).toFixed(1)}% ·
          expected 40%.{" "}
          {weightPrediction === "two-fifths"
            ? "Correct: 2/5 = 40%."
            : "The total weight is 5, not 4: 2/5 = 40%."}{" "}
          A finite sample can differ from 40%.
        </Explanation>
      )}

      <NativeSceneSurface
        state={{
          kind: "chance",
          chances,
          die: device === "die",
          last,
          selected: -1,
        }}
        label={`${device === "die" ? "Six-sided die" : "Four-sector spinner"}. ${last === null ? "No draw yet." : `Last draw: ${last + 1}.`} Expected chances: ${chances.map((chance) => `${(chance * 100).toFixed(1)}%`).join(", ")}.`}
        fallback={
          device === "spinner" ? (
            <View
              accessible
              accessibilityLabel={`Spinner area proportions: ${chances.map((chance, index) => `${SPINNER_LABELS[index]} ${(chance * 100).toFixed(1)}%`).join(", ")}`}
              style={{
                flexDirection: "row",
                height: 52,
                overflow: "hidden",
                borderRadius: 12,
              }}
            >
              {chances.map((chance, index) => (
                <View
                  key={SPINNER_LABELS[index]}
                  style={{
                    flex: chance,
                    backgroundColor: SPINNER_COLORS[index],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: index === 0 ? "#231a0c" : "#fff" }}>
                    {index + 1}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.text }}>
              Die faces: 1 · 2 · 3 · 4 · 5 · 6
            </Text>
          )
        }
      />
      <Explanation>
        Recent draws:{" "}
        {recent.length
          ? recent.map((value) => value + 1).join(" · ")
          : "none yet"}
        . Each draw is independent; a streak does not change the next one.
      </Explanation>
      {chances.map((chance, index) => (
        <Meter
          key={index}
          label={outcomeLabels[index]}
          value={trials ? ((counts[index] ?? 0) / trials) * 100 : 0}
          detail={`${trials ? (((counts[index] ?? 0) / trials) * 100).toFixed(1) : "0.0"}% observed · expected ${(chance * 100).toFixed(1)}% · ${counts[index] ?? 0} draws`}
        />
      ))}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
      >
        Open controls
      </Text>
      <Choice
        label="Device"
        value={device}
        onChange={(value) => {
          setDevice(value);
          setFirstWeight(1);
          setLast(null);
          setRecent([]);
          setCounts(Array(value === "spinner" ? 4 : 6).fill(0));
          clearGuidedWork();
        }}
        options={[
          { value: "spinner", label: "Four-color spinner" },
          { value: "die", label: "Six-sided die" },
        ]}
      />
      <Control
        label="Outcome 1 weight"
        value={firstWeight}
        min={1}
        max={5}
        onChange={(value) => {
          setFirstWeight(value);
          setLast(null);
          setRecent([]);
          setCounts(weights.map(() => 0));
          clearGuidedWork();
        }}
      />
      <ActionButton label="Run 10" onPress={() => runOpenSample(10)} />
      <ActionButton label="Run 100" onPress={() => runOpenSample(100)} />
      <ActionButton
        label="Clear sample"
        variant="secondary"
        onPress={() => {
          setCounts(weights.map(() => 0));
          setLast(null);
          setRecent([]);
          clearGuidedWork();
        }}
      />
      <ModelNote>
        Computer draws, not physical spins or rolls. A finite sample cannot
        prove fairness. Weights change mathematical chances; they do not model a
        physically loaded die.
      </ModelNote>
    </LearningFrame>
  );
}
