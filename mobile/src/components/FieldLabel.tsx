import { Text } from "react-native";

import { styles } from "../styles/layout";

export function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}
