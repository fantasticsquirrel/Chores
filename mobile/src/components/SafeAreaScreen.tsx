import type { PropsWithChildren } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { styles } from "../styles/layout";

export function SafeAreaScreen({
  bottom = true,
  children,
}: PropsWithChildren<{ bottom?: boolean }>) {
  return (
    <SafeAreaView
      edges={bottom ? ["top", "right", "bottom", "left"] : ["top", "right", "left"]}
      style={styles.safeArea}
    >
      {children}
    </SafeAreaView>
  );
}
