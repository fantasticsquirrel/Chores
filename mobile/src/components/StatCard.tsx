import { Text, View } from "react-native";

import { cardStyles } from "../styles/cards";

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={cardStyles.statCard}>
      <Text style={cardStyles.statValue}>{value}</Text>
      <Text style={cardStyles.statLabel}>{label}</Text>
    </View>
  );
}
