import { ActivityIndicator, Text, View } from "react-native";

import { shellStyles } from "../styles/shell";

export function LoadingRow({ label }: { label: string }) {
  return (
    <View style={shellStyles.loadingRow}>
      <ActivityIndicator color="#0f766e" />
      <Text style={shellStyles.mutedText}>{label}</Text>
    </View>
  );
}
