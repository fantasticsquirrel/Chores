import { Text } from "react-native";

import { formStyles } from "../styles/forms";

export function FieldLabel({ label }: { label: string }) {
  return <Text style={formStyles.fieldLabel}>{label}</Text>;
}
