import { describe, expect, it } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { NativeExploration } from "./NativeExploration";

const controls: [string, string][] = [
  ["sound-playground", "Increase String length (cm)"],
  ["bridge-builder", "Increase Vehicle load"],
  ["river-sculptor", "Increase Rainfall"],
  ["circuit-city", "Open house A switch"],
  ["food-web-rescue", "Advance one week"],
  ["fraction-feast", "Increase Equal slices"],
  ["pattern-palace", "Rotate a quarter turn"],
  ["caravan-crossroads", "Wet season"],
  ["pollinator-express", "Visit Gold 1"],
  ["chance-carnival", "Run 10 trials"],
];

describe("native learning explorations", () => {
  it.each(controls)(
    "renders and resets %s without a fallback",
    (id, control) => {
      const view = render(<NativeExploration id={id} />);
      expect(view.queryByRole("alert")).toBeNull();
      expect(view.getByText(control)).toBeTruthy();
      fireEvent.press(view.getByText(control));
      fireEvent.press(view.getByText("Reset experiment"));
      expect(view.getByText(control)).toBeTruthy();
    },
  );

  it("starts a fresh model when navigation changes topics", () => {
    const view = render(<NativeExploration id="sound-playground" />);
    fireEvent.press(view.getByText("Increase String length (cm)"));
    view.rerender(<NativeExploration id="fraction-feast" />);
    expect(view.queryByText("Increase String length (cm)")).toBeNull();
    expect(view.getByText("Increase Equal slices")).toBeTruthy();
    view.rerender(<NativeExploration id="future-topic" />);
    expect(view.getByRole("alert")).toBeTruthy();
  });
});
