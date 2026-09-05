import { StyleSheet } from "react-native";

import { colors } from "../../styles/colors";

function createChoreStyles() {
  return StyleSheet.create({
    dangerText: {
      color: colors.danger,
    },
  });
}

export let choreStyles = createChoreStyles();

export function refreshChoreStyles() {
  choreStyles = createChoreStyles();
}
