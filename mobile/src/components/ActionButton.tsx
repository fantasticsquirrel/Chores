import { useRef } from "react";
import { Pressable, Text } from "react-native";

import { useModuleAccess } from "../modules/ModuleAccessContext";
import { formStyles } from "../styles/forms";

export function ActionButton({
  compact = false,
  disabled = false,
  label,
  onPress,
  requiresManage = false,
  variant = "primary",
}: {
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  requiresManage?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { canManage, canManageRef } = useModuleAccess();
  const blocked = disabled || (requiresManage && !canManage);
  const current = useRef({ disabled, onPress, requiresManage });
  current.current = { disabled, onPress, requiresManage };

  function press() {
    const action = current.current;
    if (action.disabled || (action.requiresManage && !canManageRef.current)) return;
    action.onPress();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked }}
      disabled={blocked}
      onPress={press}
      style={({ pressed }) => [
        formStyles.button,
        compact ? formStyles.buttonCompact : null,
        variant === "secondary" ? formStyles.buttonSecondary : null,
        variant === "danger" ? formStyles.buttonDanger : null,
        pressed && !blocked ? formStyles.buttonPressed : null,
        blocked ? formStyles.buttonDisabled : null,
      ]}
    >
      <Text
        style={[
          formStyles.buttonText,
          variant === "secondary" ? formStyles.buttonSecondaryText : null,
          blocked ? formStyles.buttonTextDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
