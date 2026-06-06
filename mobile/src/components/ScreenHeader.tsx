import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { styles } from "../styles/layout";

export function ScreenHeader({
  subtitle,
  title,
  trailing,
}: {
  subtitle?: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.screenHeaderText}>
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle !== undefined ? (
          <Text style={styles.screenSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing !== undefined ? <View>{trailing}</View> : null}
    </View>
  );
}
