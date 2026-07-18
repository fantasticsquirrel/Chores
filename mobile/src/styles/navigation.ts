import { StyleSheet } from "react-native";

import { colors } from "./colors";

export const navigationStyles = StyleSheet.create({
  bottomBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  bottomButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 44,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  bottomButtonSelected: {
    backgroundColor: colors.primarySoft,
  },
  bottomLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  bottomLabelSelected: {
    color: colors.primary,
  },
  modalBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.38)",
    flex: 1,
    justifyContent: "flex-end",
  },
  menu: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  menuHeading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
  },
  menuItem: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 4,
    paddingVertical: 12,
  },
  menuItemSelected: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    borderBottomColor: colors.primaryBorder,
    paddingHorizontal: 10,
  },
  menuItemLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  menuItemLabelSelected: {
    color: colors.primary,
  },
  menuItemState: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  closeButton: {
    alignItems: "center",
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  closeButtonLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
});
