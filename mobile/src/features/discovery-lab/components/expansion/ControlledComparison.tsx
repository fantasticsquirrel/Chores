import { useState } from "react";
import { View, Text } from "react-native";
import { ActionButton } from "../../../../components/ActionButton";
import { colors } from "../../../../styles/colors";

/** Ask for a prediction before revealing the paired result. Each run restores a fair baseline. */
export function ControlledComparison({
  title,
  prediction,
  baseline,
  change,
  explain,
  onBaseline,
  onChange,
}: {
  title: string;
  prediction: string;
  baseline: string;
  change: string;
  explain: string;
  onBaseline: () => void;
  onChange: () => void;
}) {
  const [stage, setStage] = useState<"predict" | "baseline" | "compare">(
    "predict",
  );
  return (
    <View
      style={{
        gap: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        borderRadius: 12,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: colors.text, lineHeight: 22 }}>{prediction}</Text>
      <ActionButton
        label={`Set baseline: ${title}`}
        variant="secondary"
        onPress={() => {
          onBaseline();
          setStage("baseline");
        }}
      />
      {stage !== "predict" && (
        <Text style={{ color: colors.text, lineHeight: 22 }}>
          {baseline} Read the result above before changing it.
        </Text>
      )}
      {stage !== "predict" && (
        <ActionButton
          label={`Compare: ${title}`}
          onPress={() => {
            onChange();
            setStage("compare");
          }}
        />
      )}
      {stage === "compare" && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.text, lineHeight: 22 }}
        >
          {change} {explain}
        </Text>
      )}
    </View>
  );
}
