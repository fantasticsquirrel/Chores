import { Pressable, Text } from "react-native";

import { formStyles } from "../styles/forms";

export function ActionButton({
  compact = false,
  disabled = false,
  label,
  onPress,
  variant = "primary",
}: {
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        formStyles.button,
        compact ? formStyles.buttonCompact : null,
        variant === "secondary" ? formStyles.buttonSecondary : null,
        variant === "danger" ? formStyles.buttonDanger : null,
        pressed && !disabled ? formStyles.buttonPressed : null,
        disabled ? formStyles.buttonDisabled : null,
      ]}
    >
      <Text
        style={[
          formStyles.buttonText,
          variant === "secondary" ? formStyles.buttonSecondaryText : null,
          disabled ? formStyles.buttonTextDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
