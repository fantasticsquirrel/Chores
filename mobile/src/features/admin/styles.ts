import { StyleSheet } from "react-native";

import { colors } from "../../styles/colors";

function createAdminStyles() {
  return StyleSheet.create({
    lockedModuleText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 4,
    },
    moduleActionFeedback: {
      gap: 8,
      marginTop: 8,
    },
    moduleToggle: {
      alignItems: "center",
      backgroundColor: "#cbd5e1",
      borderRadius: 18,
      flexDirection: "row",
      gap: 6,
      minHeight: 36,
      minWidth: 78,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    moduleToggleBusy: {
      opacity: 0.58,
    },
    moduleToggleEnabled: {
      backgroundColor: colors.primary,
    },
    moduleToggleLabel: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: "900",
    },
    moduleToggleThumb: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      height: 20,
      width: 20,
    },
    moduleToggleThumbEnabled: {
      transform: [{ translateX: 2 }],
    },
  });
}

export let adminStyles = createAdminStyles();

export function refreshAdminStyles() {
  adminStyles = createAdminStyles();
}
