import { Pressable, Text, View } from "react-native";

import { formStyles } from "../styles/forms";

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
    <View style={formStyles.choiceGrid}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              formStyles.choiceButton,
              selected ? formStyles.choiceButtonSelected : null,
              disabled ? formStyles.buttonDisabled : null,
            ]}
          >
            <Text
              style={[
                formStyles.choiceButtonText,
                selected ? formStyles.choiceButtonTextSelected : null,
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
