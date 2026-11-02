import { Text, View } from "react-native";
import {
  CIRCUIT_SWITCH_COMPARISON,
  CIRCUIT_VOLTAGE_COMPARISON,
  circuitActivity,
  compareCircuitTrials,
  type CircuitInputs,
} from "@family-manager/family-api/discovery-models/circuit";
import { ActionButton } from "../../../components/ActionButton";
import { Choice, Explanation } from "./LearningPrimitives";

export type PathPrediction = "" | "series-off" | "one-off" | "all-off";
export type VoltagePrediction = "" | "quadratic" | "linear" | "unchanged";

const pathEvidence = CIRCUIT_SWITCH_COMPARISON.map(circuitActivity);
const voltageEvidence = CIRCUIT_VOLTAGE_COMPARISON.map(circuitActivity);
const pathVariables = compareCircuitTrials(...CIRCUIT_SWITCH_COMPARISON);
const voltageVariables = compareCircuitTrials(...CIRCUIT_VOLTAGE_COMPARISON);

export function CircuitPredictionSteps({
  pathPrediction,
  voltagePrediction,
  pathComplete,
  voltageComplete,
  onPathPrediction,
  onVoltagePrediction,
  onPathComplete,
  onVoltageComplete,
  onShowTrial,
}: {
  pathPrediction: PathPrediction;
  voltagePrediction: VoltagePrediction;
  pathComplete: boolean;
  voltageComplete: boolean;
  onPathPrediction: (value: PathPrediction) => void;
  onVoltagePrediction: (value: VoltagePrediction) => void;
  onPathComplete: () => void;
  onVoltageComplete: () => void;
  onShowTrial: (trial: CircuitInputs) => void;
}) {
  return (
    <>
      <Text accessibilityRole="header">1. Open one switch</Text>
      <Explanation>
        Keep the ideal source at 12 V and house B open. Predict what changes
        between one series path and three parallel branches; every resistor
        stays fixed at 12 Ω.
      </Explanation>
      <Choice
        label="Your path prediction"
        value={pathPrediction}
        onChange={onPathPrediction}
        options={[
          {
            value: "series-off",
            label: "All off in series; houses A and C on in parallel",
          },
          { value: "one-off", label: "Only house B off in both" },
          { value: "all-off", label: "All houses off in both" },
        ]}
      />
      <ActionButton
        label="Compare series and parallel"
        disabled={!pathPrediction || pathComplete}
        onPress={() => {
          onPathComplete();
          onShowTrial(CIRCUIT_SWITCH_COMPARISON[1]);
        }}
      />
      {pathComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {pathPrediction === "series-off" ? "matches" : "differs from"} your
            prediction. Series, B open:{" "}
            {pathEvidence[0].totalCurrentAmperes.toFixed(2)} A source current ·
            all houses 0.0 W. Parallel, B open:{" "}
            {pathEvidence[1].totalCurrentAmperes.toFixed(2)} A source current ·
            houses A–C power{" "}
            {pathEvidence[1].housePowerWatts
              .map((value) => value.toFixed(1))
              .join(", ")}{" "}
            W. Changed: {pathVariables.changed.join(", ")}. Held:{" "}
            {pathVariables.held.join(" · ")}. Every series load loses the only
            complete path; parallel branches A and C remain complete.
          </Explanation>
          <View>
            <ActionButton
              label="Show series evidence"
              variant="secondary"
              onPress={() => onShowTrial(CIRCUIT_SWITCH_COMPARISON[0])}
            />
            <ActionButton
              label="Show parallel evidence"
              variant="secondary"
              onPress={() => onShowTrial(CIRCUIT_SWITCH_COMPARISON[1])}
            />
          </View>
        </>
      )}

      <Text accessibilityRole="header">2. Double the voltage</Text>
      <Explanation>
        Keep all switches closed in parallel and each resistor fixed at 12 Ω.
        Predict what changes from 6 V to 12 V.
      </Explanation>
      <Choice
        label="Your voltage prediction"
        value={voltagePrediction}
        onChange={onVoltagePrediction}
        options={[
          {
            value: "quadratic",
            label: "Current doubles; power and energy quadruple",
          },
          { value: "linear", label: "Current and power both double" },
          { value: "unchanged", label: "Current and power stay unchanged" },
        ]}
      />
      <ActionButton
        label="Compare 6 V and 12 V"
        disabled={!voltagePrediction || voltageComplete}
        onPress={() => {
          onVoltageComplete();
          onShowTrial(CIRCUIT_VOLTAGE_COMPARISON[1]);
        }}
      />
      {voltageComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {voltagePrediction === "quadratic" ? "matches" : "differs from"}{" "}
            your prediction. 6 V: each house{" "}
            {voltageEvidence[0].houseCurrentAmperes[0].toFixed(2)} A ·{" "}
            {voltageEvidence[0].housePowerWatts[0].toFixed(1)} W ·{" "}
            {voltageEvidence[0].houseEnergyJoules[0].toFixed(1)} J in 10 s. 12
            V: each house {voltageEvidence[1].houseCurrentAmperes[0].toFixed(2)}{" "}
            A · {voltageEvidence[1].housePowerWatts[0].toFixed(1)} W ·{" "}
            {voltageEvidence[1].houseEnergyJoules[0].toFixed(1)} J in 10 s.
            Changed: {voltageVariables.changed.join(", ")}. Held:{" "}
            {voltageVariables.held.join(" · ")}. For a fixed resistor, I = V ÷ R
            and P = V × I = V² ÷ R.
          </Explanation>
          <View>
            <ActionButton
              label="Show 6 V evidence"
              variant="secondary"
              onPress={() => onShowTrial(CIRCUIT_VOLTAGE_COMPARISON[0])}
            />
            <ActionButton
              label="Show 12 V evidence"
              variant="secondary"
              onPress={() => onShowTrial(CIRCUIT_VOLTAGE_COMPARISON[1])}
            />
          </View>
        </>
      )}
    </>
  );
}
