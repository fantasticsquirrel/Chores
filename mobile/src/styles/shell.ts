import { StyleSheet } from "react-native";

import { colors } from "./colors";
import { typography } from "./typography";

function createShellStyles() {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centeredPanel: {
      alignItems: "center",
      flex: 1,
      gap: 12,
      justifyContent: "center",
      padding: 24,
    },
    appHeader: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    appTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: 0,
    },
    headerSubline: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0,
      marginTop: 2,
    },
    sessionPill: {
      backgroundColor: colors.surfaceMuted,
      borderColor: "#d8e4de",
      borderRadius: 8,
      borderWidth: 1,
      maxWidth: "52%",
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    sessionPillText: {
      color: "#334155",
      fontSize: 12,
      fontWeight: "700",
    },
    screenContent: {
      padding: 16,
      paddingBottom: 22,
    },
    screenHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
      marginBottom: 14,
    },
    screenHeaderText: {
      flex: 1,
    },
    screenTitle: {
      color: colors.text,
      fontSize: typography.titleSize,
      fontWeight: "800",
      letterSpacing: 0,
    },
    screenSubtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 19,
      marginTop: 3,
    },
    loadingRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    mutedText: {
      color: colors.textMuted,
      fontSize: typography.bodySize,
      lineHeight: 20,
    },
    compactStack: {
      gap: 10,
    },
    splitRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between",
    },
  });
}

export let shellStyles = createShellStyles();

export function refreshShellStyles() {
  shellStyles = createShellStyles();
}
