import { StyleSheet } from "react-native";

import { colors } from "../../styles/colors";

function createAuthStyles() {
  return StyleSheet.create({
    loginContent: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 20,
    },
    loginCard: {
      backgroundColor: colors.surface,
      borderColor: "#d9e6de",
      borderRadius: 8,
      borderWidth: 1,
      elevation: 2,
      padding: 20,
      shadowColor: "#0f172a",
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
    },
    loginTitle: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: 0,
    },
    loginSubtitle: {
      color: colors.textSubtle,
      fontSize: 15,
      lineHeight: 21,
      marginTop: 6,
    },
    loginModeSwitch: {
      backgroundColor: colors.surfaceSoft,
      borderColor: "#cfe4d7",
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 4,
      marginTop: 16,
      padding: 4,
    },
    loginModeButton: {
      alignItems: "center",
      borderRadius: 8,
      flex: 1,
      justifyContent: "center",
      minHeight: 40,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    loginModeButtonActive: {
      backgroundColor: colors.primary,
    },
    loginModeButtonText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0,
    },
    loginModeButtonTextActive: {
      color: colors.surface,
    },
    apiBasePanel: {
      backgroundColor: colors.surfaceSoft,
      borderColor: "#cfe4d7",
      borderRadius: 8,
      borderWidth: 1,
      marginTop: 18,
      padding: 12,
    },
    apiBaseLabel: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    apiBaseValue: {
      color: "#334155",
      fontSize: 13,
      lineHeight: 18,
      marginTop: 3,
    },
    recoveryLink: {
      alignSelf: "flex-start",
      marginTop: 2,
      minHeight: 44,
      justifyContent: "center",
      paddingVertical: 6,
    },
    recoveryLinkPressed: {
      opacity: 0.72,
    },
    recoveryLinkText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "800",
      textDecorationLine: "underline",
    },
    recoveryGuidance: {
      color: colors.textSubtle,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 4,
    },
  });
}

export let authStyles = createAuthStyles();

export function refreshAuthStyles() {
  authStyles = createAuthStyles();
}
