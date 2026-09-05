import type { PropsWithChildren } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { shellStyles } from "../styles/shell";

export function SafeAreaScreen({
  bottom = true,
  children,
}: PropsWithChildren<{ bottom?: boolean }>) {
  return (
    <SafeAreaView
      edges={bottom ? ["top", "right", "bottom", "left"] : ["top", "right", "left"]}
      style={shellStyles.safeArea}
    >
      {children}
    </SafeAreaView>
  );
}
