import { Text, View } from "react-native";

import { cardStyles } from "../styles/cards";

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={cardStyles.infoRow}>
      <Text style={cardStyles.infoLabel}>{label}</Text>
      <Text style={cardStyles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
