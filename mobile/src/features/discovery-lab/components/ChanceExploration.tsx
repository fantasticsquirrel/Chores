import { useState } from "react";
import { Text, View } from "react-native";
import {
  countOutcomes,
  drawOutcomes,
  fairnessDistance,
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
  gap: number;
};

function freshSample(weights: number[], trials: number) {
  const draws = drawOutcomes(weights, trials);
  const counts = countOutcomes(draws, weights.length);
  return {
    draws,
    snapshot: { counts, gap: fairnessDistance(counts, weights) },
  };
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
    largeSample.gap < smallSample.gap;

  return (
    <LearningFrame onReset={reset}>
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}
      >
        Do equal chances force equal counts?
      </Text>
      <Explanation>
        Keep four spinner weights fixed at 1. Change only the number of trials
        in each fresh sample.
      </Explanation>
      <Choice
        label="Predict what can happen in 12 trials"
        value={prediction}
        onChange={(value) => {
          setPrediction(value);
          setSmallSample(null);
          setLargeSample(null);
          setWeightPrediction("");
          setWeightedSample(null);
        }}
        options={[
          { value: "exact", label: "All four counts must match" },
          { value: "different", label: "The counts can differ" },
        ]}
      />
      <ActionButton
        label="Run a fresh 12-trial sample"
        disabled={!prediction}
        onPress={runSmall}
      />
      {smallSample && (
        <Explanation>
          12-trial counts: {smallSample.counts.join(" · ")}. A fair process can
          produce uneven counts because fair describes the unchanged chance on
          each trial, not a required short-run pattern.
        </Explanation>
      )}
      <ActionButton
        label="Run a fresh 1,200-trial sample"
        disabled={!smallSample}
        onPress={runLarge}
      />
      {smallSample && largeSample && (
        <Explanation>
          12-trial gap: {smallSample.gap.toFixed(1)} percentage points.
          1,200-trial gap: {largeSample.gap.toFixed(1)} percentage points.{" "}
          {largerWasCloser
            ? "In this pair, the larger sample is closer. Across many repetitions, larger samples tend to have smaller relative gaps."
            : "This larger run was not closer. That can happen: a long-run tendency does not guarantee that every larger sample beats every smaller one."}
        </Explanation>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        If one weight doubles, is its chance one-half?
      </Text>
      <Explanation>
        Outcome 1 changes to weight 2. The other three outcomes stay at weight
        1. Finish the fair-sample comparison before testing this change.
      </Explanation>
      <Choice
        label="Predict outcome 1’s chance"
        value={weightPrediction}
        onChange={(value) => {
          if (!largeSample) return;
          setWeightPrediction(value);
          setWeightedSample(null);
        }}
        options={[
          { value: "two-fifths", label: "2 out of 5 (40%)" },
          { value: "one-half", label: "2 out of 4 (50%)" },
        ]}
      />
      <ActionButton
        label="Test the doubled weight"
        disabled={!largeSample || !weightPrediction}
        onPress={runWeighted}
      />
      {weightedSample && (
        <Explanation>
          Outcome 1 has weight 2 out of a total weight of 5. Theoretical chance:
          40.0%. It appeared {weightedSample.counts[0]} times in 200 trials ({" "}
          {((weightedSample.counts[0] / 200) * 100).toFixed(1)}%). Doubling one
          weight changes the total from 4 to 5, so the chance is 2/5, not 2/4. A
          finite observed share can differ from 40%.
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
        label={`${device === "die" ? "Six-sided die" : "Four-sector spinner"}. ${last === null ? "No trial yet." : `Last sampled outcome: ${last + 1}.`} Theoretical chances ${chances.map((chance) => `${(chance * 100).toFixed(1)} percent`).join(", ")}.`}
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
        Most recent outcomes:{" "}
        {recent.length
          ? recent.map((value) => value + 1).join(" · ")
          : "none yet"}
        . A streak does not change the chance of the next independent draw.
      </Explanation>
      {chances.map((chance, index) => (
        <Meter
          key={index}
          label={outcomeLabels[index]}
          value={trials ? ((counts[index] ?? 0) / trials) * 100 : 0}
          detail={`${counts[index] ?? 0} observed (${trials ? (((counts[index] ?? 0) / trials) * 100).toFixed(1) : "0.0"}%); theoretical chance ${(chance * 100).toFixed(1)}%`}
        />
      ))}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
      >
        Choose your own device, weight and sample size
      </Text>
      <Choice
        label="Random device"
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
        label={device === "spinner" ? "Gold sector weight" : "Face 1 weight"}
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
      <ActionButton label="Run 10 trials" onPress={() => runOpenSample(10)} />
      <ActionButton label="Run 100 trials" onPress={() => runOpenSample(100)} />
      <ActionButton
        label="Clear trial counts"
        variant="secondary"
        onPress={() => {
          setCounts(weights.map(() => 0));
          setLast(null);
          setRecent([]);
          clearGuidedWork();
        }}
      />
      <ModelNote>
        Independent pseudorandom draws, not physical spins or rolls. A finite
        sample cannot prove fairness. Weights set theoretical probabilities and
        do not physically load a die. An outcome does not become more likely
        because it is “overdue.”
      </ModelNote>
    </LearningFrame>
  );
}
