import { describe, expect, it } from "@jest/globals";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { SafeAreaScreen } from "./SafeAreaScreen";

async function renderScreen(bottom: boolean) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { height: 800, width: 390, x: 0, y: 0 },
        insets: { bottom: 34, left: 0, right: 0, top: 24 },
      }}
    >
      <SafeAreaScreen bottom={bottom}>
        <Text>Content</Text>
      </SafeAreaScreen>
    </SafeAreaProvider>,
  );
}

describe("SafeAreaScreen", () => {
  it("leaves the bottom inset to the authenticated navigation bar", async () => {
    const view = await renderScreen(false);

    expect(view.UNSAFE_getByType(SafeAreaView).props.edges).toEqual([
      "top",
      "right",
      "left",
    ]);
  });

  it("protects all edges on screens without bottom navigation", async () => {
    const view = await renderScreen(true);

    expect(view.UNSAFE_getByType(SafeAreaView).props.edges).toEqual([
      "top",
      "right",
      "bottom",
      "left",
    ]);
  });
});
