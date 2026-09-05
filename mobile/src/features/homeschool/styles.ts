import { StyleSheet } from "react-native";

import { colors } from "../../styles/colors";

function createHomeschoolStyles() {
  return StyleSheet.create({
    rowColorDot: {
      borderColor: colors.borderStrong,
      borderRadius: 8,
      borderWidth: 1,
      height: 22,
      width: 22,
    },
    divider: {
      borderBottomColor: "#e2e8f0",
      borderBottomWidth: 1,
      marginVertical: 12,
    },
    swatchRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 12,
    },
    colorSwatch: {
      borderColor: colors.borderStrong,
      borderRadius: 8,
      borderWidth: 1,
      height: 38,
      width: 38,
    },
    colorSwatchSelected: {
      borderColor: colors.text,
      borderWidth: 3,
    },
    calendarWeekRow: {
      flexDirection: "row",
      gap: 4,
      marginTop: 14,
    },
    calendarWeekday: {
      color: colors.textMuted,
      flexBasis: "13.4%",
      flexGrow: 1,
      fontSize: 12,
      fontWeight: "800",
      textAlign: "center",
    },
    calendarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 6,
    },
    calendarCell: {
      alignItems: "center",
      aspectRatio: 1,
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexBasis: "13.4%",
      flexGrow: 1,
      justifyContent: "center",
      minHeight: 42,
      padding: 3,
    },
    calendarCellMuted: {
      backgroundColor: "#f1f5f9",
      opacity: 0.58,
    },
    calendarCellSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    calendarCellText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    calendarCellTextMuted: {
      color: colors.textMuted,
    },
    calendarCellTextSelected: {
      color: colors.surface,
    },
    calendarSubjectRow: {
      flexDirection: "row",
      gap: 2,
      marginTop: 3,
    },
    calendarSubjectInitial: {
      color: colors.primary,
      fontSize: 9,
      fontWeight: "900",
    },
    calendarSubjectInitialSelected: {
      color: colors.surface,
    },
  });
}

export let homeschoolStyles = createHomeschoolStyles();

export function refreshHomeschoolStyles() {
  homeschoolStyles = createHomeschoolStyles();
}
