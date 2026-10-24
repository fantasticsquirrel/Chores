import { StyleSheet } from "react-native";

import { colors } from "./colors";
import { typography } from "./typography";

function createFormStyles() {
  return StyleSheet.create({
    fieldLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      marginBottom: 6,
      marginTop: 14,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    multilineInput: {
      minHeight: 92,
      textAlignVertical: "top",
    },
    inlineButtons: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    selectableRow: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between",
      marginBottom: 9,
      padding: 12,
    },
    selectableRowSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
    },
    rowMain: {
      flex: 1,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0,
    },
    rowMeta: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 3,
    },
    selectionMark: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
    },
    selectionMarkSelected: {
      color: colors.text,
    },
    button: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 8,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    buttonCompact: {
      minHeight: 38,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    buttonSecondary: {
      backgroundColor: colors.surfaceSoft,
      borderColor: colors.borderStrong,
      borderWidth: 1,
    },
    buttonDanger: {
      backgroundColor: colors.danger,
    },
    buttonPressed: {
      opacity: 0.82,
    },
    buttonDisabled: {
      backgroundColor: colors.surfaceSoft,
      borderColor: colors.border,
    },
    buttonText: {
      color: colors.surface,
      fontSize: typography.controlSize,
      fontWeight: "800",
      letterSpacing: 0,
    },
    buttonSecondaryText: {
      color: colors.text,
    },
    buttonTextDisabled: {
      color: colors.textMuted,
    },
    choiceGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
    },
    choiceButton: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.borderStrong,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    choiceButtonSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
    },
    choiceButtonText: {
      color: colors.textSubtle,
      fontSize: 13,
      fontWeight: "800",
    },
    choiceButtonTextSelected: {
      color: colors.text,
    },
    formSection: {
      marginTop: 6,
    },
  });
}

export let formStyles = createFormStyles();

export function refreshFormStyles() {
  formStyles = createFormStyles();
}
