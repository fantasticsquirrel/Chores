import { NativeSceneSurface } from "./NativeSceneSurface";
import { useState } from "react";
import {
  fairnessDistance,
  probabilities,
  sampleOutcomes,
} from "@family-manager/family-api/discovery-models/math-life";
import { ActionButton } from "../../../components/ActionButton";
import { View, Text } from "react-native";
import { colors } from "../../../styles/colors";
import { Control } from "./Primitives";
import {
  Choice,
  Explanation,
  LearningFrame,
  Meter,
  ModelNote,
} from "./LearningPrimitives";

export function ChanceExploration() {
  const [device, setDevice] = useState("spinner");
  const [last, setLast] = useState<number | null>(null);
  const [firstWeight, setFirstWeight] = useState(1);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const weights =
    device === "spinner"
      ? [firstWeight, 1, 1, 1]
      : [firstWeight, 1, 1, 1, 1, 1];
  const chances = probabilities(weights),
    trials = counts.reduce((a, b) => a + b, 0);
  const run = (n: number) => {
    const beforeLast = sampleOutcomes(weights, n - 1);
    const finalTrial = sampleOutcomes(weights, 1);
    const samples = beforeLast.map((value, i) => value + finalTrial[i]);
    setLast(finalTrial.findIndex((count) => count === 1));
    setCounts((previous) =>
      samples.map((value, i) => value + (previous[i] ?? 0)),
    );
  };
  return (
    <LearningFrame
      onReset={() => {
        setDevice("spinner");
        setLast(null);
        setFirstWeight(1);
        setCounts([0, 0, 0, 0]);
      }}
    >
      <Choice
        label="Random device"
        value={device}
        onChange={(value) => {
          setDevice(value);
          setLast(null);
          setCounts(Array(value === "spinner" ? 4 : 6).fill(0));
        }}
        options={[
          { value: "spinner", label: "Four-color spinner" },
          { value: "die", label: "Six-sided die" },
        ]}
      />
      <NativeSceneSurface
        state={{
          kind: "chance",
          chances,
          die: device === "die",
          last,
          selected: -1,
        }}
        label={`${device === "die" ? "Six-sided die" : "Four-sector spinner"}. ${last === null ? "No trial yet." : `Last sampled outcome: ${last + 1}.`}`}
        fallback={
          device === "spinner" ? (
            <View
              accessible
              accessibilityLabel={`Spinner area proportions: ${chances.map((p, i) => `${["Gold", "Violet", "Teal", "Coral"][i]} ${(p * 100).toFixed(1)}%`).join(", ")}`}
              style={{
                flexDirection: "row",
                height: 52,
                overflow: "hidden",
                borderRadius: 12,
              }}
            >
              {chances.map((chance, i) => (
                <View
                  key={i}
                  style={{
                    flex: chance,
                    backgroundColor: [
                      "#e4ac43",
                      "#946ac0",
                      "#228b80",
                      "#d87961",
                    ][i],
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: i === 0 ? "#231a0c" : "#fff" }}>
                    {i + 1}
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
      <Control
        label={device === "spinner" ? "Gold sector weight" : "Face 1 weight"}
        value={firstWeight}
        min={1}
        max={5}
        onChange={(value) => {
          setFirstWeight(value);
          setLast(null);
          setCounts(weights.map(() => 0));
        }}
      />
      <Explanation>
        {trials} trials.{" "}
        {last !== null ? `Last sampled outcome: ${last + 1}. ` : ""}
        {firstWeight === 1
          ? "All outcomes have equal theoretical probability."
          : "The first outcome has a larger probability, so this device is deliberately unequal."}{" "}
        Changing the device or weight starts a new sample.
      </Explanation>
      {chances.map((chance, i) => (
        <Meter
          key={i}
          label={
            device === "spinner"
              ? ["Gold", "Violet", "Teal", "Coral"][i]
              : `Face ${i + 1}`
          }
          value={trials ? ((counts[i] ?? 0) / trials) * 100 : 0}
          detail={`${counts[i] ?? 0} observed (${trials ? (((counts[i] ?? 0) / trials) * 100).toFixed(1) : "0.0"}%); expected ${(trials * chance).toFixed(1)}; probability ${(chance * 100).toFixed(1)}%`}
        />
      ))}
      <ActionButton label="Run 10 trials" onPress={() => run(10)} />
      <ActionButton label="Run 100 trials" onPress={() => run(100)} />
      <ActionButton
        label="Clear trial counts"
        variant="secondary"
        onPress={() => {
          setCounts(weights.map(() => 0));
          setLast(null);
        }}
      />
      <Explanation>
        {trials
          ? `Largest observed-versus-theoretical difference: ${fairnessDistance(counts, weights).toFixed(1)} percentage points.`
          : "No observations yet."}{" "}
        Larger samples often have smaller proportional differences, but they do
        not guarantee a closer match on every run.
      </Explanation>
      <ModelNote>
        Independent simulated trials. A streak does not make the next result
        “due.” Short-run counts alone cannot prove a device is fair. Weights set
        the theoretical probability of each outcome.
      </ModelNote>
    </LearningFrame>
  );
}
