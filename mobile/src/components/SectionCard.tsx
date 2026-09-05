import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { cardStyles } from "../styles/cards";

export function SectionCard({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.cardHeader}>
        <Text style={cardStyles.cardTitle}>{title}</Text>
        {subtitle !== undefined ? (
          <Text style={cardStyles.cardSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
