import type { ReactNode, Ref } from "react";
import { Pressable, Text, type View } from "react-native";
import { useTheme } from "../../../theme/ThemeContext";

export function FamilyTreeButton({
  label,
  onPress,
  selected,
  disabled = false,
  children,
  buttonRef,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  buttonRef?: Ref<View>;
}) {
  const {
    definition: { colors },
  } = useTheme();
  return (
    <Pressable
      ref={buttonRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        ...(selected === undefined ? {} : { selected }),
        disabled,
      }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minWidth: 44,
        minHeight: 44,
        padding: 10,
        borderWidth: 1,
        borderRadius: 12,
        borderColor: selected ? colors.primaryBorder : colors.borderStrong,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
        opacity: disabled ? 0.55 : 1,
        justifyContent: "center",
        flexShrink: 1,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 16, flexShrink: 1 }}>
        {children ?? `${selected ? "✓ " : ""}${label}`}
      </Text>
    </Pressable>
  );
}
export function FamilyTreeToggle({
  label,
  checked,
  onPress,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const {
    definition: { colors },
  } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minWidth: 44,
        minHeight: 44,
        padding: 10,
        borderWidth: 1,
        borderRadius: 12,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        flexShrink: 1,
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 16, color: colors.text, flexShrink: 1 }}>
        {checked ? "☑" : "☐"} {label}
      </Text>
    </Pressable>
  );
}
