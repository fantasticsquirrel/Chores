import { describe, expect, it } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { FractionExploration } from "./FractionExploration";

describe("native Fraction Feast learning workflow", () => {
  it("requires both predictions, reports exact evidence, unlocks controls, and resets", () => {
    const view = render(<FractionExploration />);

    expect(view.queryByText(/Equal slices:/)).toBeNull();
    fireEvent.press(view.getByText("The same amount"));
    fireEvent.press(view.getByText("Compare 1/2 with 2/4"));
    expect(view.getByText(/1\/2 = 2\/4/)).toBeTruthy();
    expect(view.getByText(/Changed: piece count · piece size/)).toBeTruthy();

    fireEvent.press(view.getByText("More than one whole"));
    fireEvent.press(view.getByText("Combine 2/3 and 3/4"));
    expect(view.getByText(/2\/3 = 8\/12/)).toBeTruthy();
    expect(view.getByText(/17\/12 = 1 whole and 5\/12/)).toBeTruthy();
    expect(view.getByText(/Equal slices:/)).toBeTruthy();

    fireEvent.press(view.getByText("Reset lesson"));
    expect(view.queryByText(/17\/12 = 1 whole and 5\/12/)).toBeNull();
    expect(view.queryByText(/Equal slices:/)).toBeNull();
  });
});
