import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { shellStyles } from "../styles/shell";

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
    <View style={shellStyles.screenHeader}>
      <View style={shellStyles.screenHeaderText}>
        <Text style={shellStyles.screenTitle}>{title}</Text>
        {subtitle !== undefined ? (
          <Text style={shellStyles.screenSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing !== undefined ? <View>{trailing}</View> : null}
    </View>
  );
}
