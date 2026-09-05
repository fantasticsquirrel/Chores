import { StyleSheet } from "react-native";

import { colors } from "./colors";
import { typography } from "./typography";

function createCardStyles() {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      elevation: 1,
      marginBottom: 14,
      padding: 14,
      shadowColor: "#0f172a",
      shadowOffset: { height: 5, width: 0 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
    },
    cardHeader: {
      marginBottom: 12,
    },
    cardTitle: {
      color: colors.text,
      fontSize: typography.cardTitleSize,
      fontWeight: "800",
      letterSpacing: 0,
    },
    cardSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
    },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 4,
    },
    statCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexBasis: "46%",
      flexGrow: 1,
      marginBottom: 10,
      minHeight: 86,
      padding: 14,
    },
    statValue: {
      color: colors.accent,
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: 0,
    },
    statLabel: {
      color: colors.textSubtle,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 5,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    moduleChip: {
      backgroundColor: colors.chipSurface,
      borderColor: colors.chipBorder,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    moduleChipText: {
      color: colors.chipText,
      fontSize: 13,
      fontWeight: "800",
    },
    reviewItem: {
      borderBottomColor: "#e2e8f0",
      borderBottomWidth: 1,
      marginBottom: 12,
      paddingBottom: 12,
    },
    itemButtonRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    commentRow: {
      borderBottomColor: "#e2e8f0",
      borderBottomWidth: 1,
      marginBottom: 10,
      paddingBottom: 10,
    },
    infoRow: {
      borderBottomColor: "#e2e8f0",
      borderBottomWidth: 1,
      paddingVertical: 9,
    },
    infoLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    infoValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      marginTop: 3,
    },
    notice: {
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noticeError: {
      backgroundColor: colors.dangerSurface,
      borderColor: colors.dangerBorder,
    },
    noticeSuccess: {
      backgroundColor: colors.successSurface,
      borderColor: colors.successBorder,
    },
    noticeWarning: {
      backgroundColor: colors.warningSurface,
      borderColor: colors.warningBorder,
    },
    noticeInfo: {
      backgroundColor: colors.surfaceSoft,
      borderColor: "#b8d8ca",
    },
    noticeText: {
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18,
    },
    noticeTextError: {
      color: colors.danger,
    },
    noticeTextSuccess: {
      color: colors.successText,
    },
    noticeTextWarning: {
      color: colors.warningText,
    },
    noticeTextInfo: {
      color: colors.primary,
    },
  });
}

export let cardStyles = createCardStyles();

export function refreshCardStyles() {
  cardStyles = createCardStyles();
}
