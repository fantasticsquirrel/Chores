import { ActivityIndicator, Text, View } from "react-native";

import { styles } from "../styles/layout";

export function LoadingRow({ label }: { label: string }) {
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator color="#0f766e" />
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}
