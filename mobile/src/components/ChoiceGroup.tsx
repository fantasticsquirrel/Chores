import { Pressable, Text, View } from "react-native";

import { styles } from "../styles/layout";

export type ChoiceOption<T extends string> = {
  label: string;
  value: T;
};

export function ChoiceGroup<T extends string>({
  disabled = false,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  onChange: (value: T) => void;
  options: ChoiceOption<T>[];
  value: T;
}) {
  return (
    <View style={styles.choiceGrid}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.choiceButton,
              selected ? styles.choiceButtonSelected : null,
              disabled ? styles.buttonDisabled : null,
            ]}
          >
            <Text
              style={[
                styles.choiceButtonText,
                selected ? styles.choiceButtonTextSelected : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
