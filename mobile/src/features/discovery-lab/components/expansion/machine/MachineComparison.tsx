import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ActionButton } from "../../../../../components/ActionButton";
import { colors } from "../../../../../styles/colors";
import {
  machineWorkshopTrials,
  type MachineWorkshopTrial,
} from "@family-manager/family-api/discovery-models/machine-workshop";
import type { MachineState } from "@family-manager/family-api/discovery-models/expansion-mechanics";

function SelectButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      focusable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        minHeight: 48,
        justifyContent: "center",
        padding: 12,
        borderWidth: 2,
        borderColor: selected ? colors.primary : colors.borderStrong,
        borderRadius: 10,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
      }}
    >
      <Text
        style={{ color: colors.text, fontWeight: selected ? "700" : "400" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function MachineComparison({
  onApply,
}: {
  onApply: (state: MachineState) => void;
}) {
  const [trial, setTrial] = useState<MachineWorkshopTrial>(
    machineWorkshopTrials[0],
  );
  const [prediction, setPrediction] = useState<string | null>(null);
  const [stage, setStage] = useState<"predict" | "baseline" | "compared">(
    "predict",
  );
  const selectTrial = (next: MachineWorkshopTrial) => {
    setTrial(next);
    setPrediction(null);
    setStage("predict");
  };

  return (
    <View style={{ gap: 14 }}>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 17 }}>
        Controlled investigation
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Investigation"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
      >
        {machineWorkshopTrials.map((item) => (
          <SelectButton
            key={item.id}
            label={item.title}
            selected={trial.id === item.id}
            onPress={() => selectTrial(item)}
          />
        ))}
      </View>
      <View
        style={{
          gap: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: 12,
          backgroundColor: colors.surface,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          1. Predict
        </Text>
        <Text style={{ color: colors.text, lineHeight: 22 }}>
          {trial.question}
        </Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={`${trial.title} prediction`}
          style={{ gap: 8 }}
        >
          {trial.choices.map((choice) => (
            <SelectButton
              key={choice}
              label={choice}
              selected={prediction === choice}
              onPress={() => {
                setPrediction(choice);
                setStage("predict");
              }}
            />
          ))}
        </View>
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          2. Compare
        </Text>
        <Text style={{ color: colors.text, lineHeight: 22 }}>
          {trial.controlled}
        </Text>
        {prediction !== null && (
          <ActionButton
            label={`Set baseline: ${trial.title}`}
            variant="secondary"
            onPress={() => {
              onApply({ ...trial.before });
              setStage("baseline");
            }}
          />
        )}
        {stage !== "predict" && (
          <ActionButton
            label={`Compare: ${trial.title}`}
            onPress={() => {
              onApply({ ...trial.after });
              setStage("compared");
            }}
          />
        )}
        {stage === "baseline" && (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>
            Baseline set. Read the measurements above, then apply the one
            change.
          </Text>
        )}
        <Text style={{ color: colors.text, fontWeight: "700" }}>
          3. Explain
        </Text>
        {stage === "compared" ? (
          <View style={{ gap: 8 }}>
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors.text, lineHeight: 22 }}
            >
              The evidence{" "}
              {prediction === trial.correctChoice
                ? "supports"
                : "does not support"}{" "}
              your prediction. {trial.evidence}
            </Text>
            <Text style={{ color: colors.text, lineHeight: 22 }}>
              Changed: {trial.changed}. Held: {trial.held.join(", ")}.
            </Text>
            <Text style={{ color: colors.text, lineHeight: 22 }}>
              {trial.explain}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.textMuted, lineHeight: 22 }}>
            Compare both readings before explaining what the one change caused.
          </Text>
        )}
      </View>
    </View>
  );
}
