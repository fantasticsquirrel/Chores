import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { NativeExploration } from "./NativeExploration";

afterEach(() => {
  jest.restoreAllMocks();
});

describe("native predictions and evidence", () => {
  it("separates amplitude from pitch and changes pitch with length", () => {
    const view = render(<NativeExploration id="sound-playground" />);
    expect(view.getByText(/Frequency 200.0 Hz/)).toBeTruthy();
    fireEvent.press(view.getByText("Increase Amplitude (mm)"));
    expect(view.getByText(/Frequency 200.0 Hz.*amplitude 4 mm/)).toBeTruthy();
    fireEvent.press(view.getByText("Increase String length (cm)"));
    expect(view.getByText(/Frequency 166.7 Hz/)).toBeTruthy();
  });

  it("changes bridge stress and spending with reinforcement", () => {
    const view = render(<NativeExploration id="bridge-builder" />);
    expect(
      view.getByText(/Highest stress-to-capacity ratio: 3.13/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Add zone 2 reinforcement"));
    fireEvent.press(view.getByText("Add zone 3 reinforcement"));
    expect(
      view.getByText(/Highest stress-to-capacity ratio: 1.56/),
    ).toBeTruthy();
    expect(view.getByText(/Materials cost 150 units/)).toBeTruthy();
    fireEvent.press(view.getByText("Decrease Vehicle load"));
    expect(
      view.getByText(/All zones are within their model capacity/),
    ).toBeTruthy();
  });

  it("applies finite soil erosion and resets the river", () => {
    const view = render(<NativeExploration id="river-sculptor" />);
    expect(
      view.getByText(/0 storms applied. Available soil: 5000 kg/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Run one storm"));
    expect(
      view.getByText(/1 storms applied. Available soil: 4961 kg/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Reset experiment"));
    expect(
      view.getByText(/0 storms applied. Available soil: 5000 kg/),
    ).toBeTruthy();
  });

  it("preserves independent parallel branches and opens the full series circuit", () => {
    const view = render(<NativeExploration id="circuit-city" />);
    fireEvent.press(view.getByText("Open house A switch"));
    expect(
      view.getByText(/Total current from the battery: 2.00 A/),
    ).toBeTruthy();
    expect(view.getByText("House B: 12.0 V · 1.00 A · 12.00 W")).toBeTruthy();
    fireEvent.press(view.getByText("Series"));
    expect(
      view.getByText(/Total current from the battery: 0.00 A/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Close house A switch"));
    expect(
      view.getByText(/Total current from the battery: 0.33 A/),
    ).toBeTruthy();
  });

  it("does not recreate removed pond populations after advancing time", () => {
    const view = render(<NativeExploration id="food-web-rescue" />);
    fireEvent.press(view.getByText("Remove fish"));
    for (let i = 0; i < 5; i++)
      fireEvent.press(view.getByText("Advance one week"));
    expect(view.getByText("Fish population index: 0.0")).toBeTruthy();
    expect(view.getByText(/Week 5./)).toBeTruthy();
    fireEvent.press(view.getByText("Restore fish"));
    expect(view.getByText("Fish population index: 20.0")).toBeTruthy();
  });

  it("splits every slice without changing the fraction and adds unlike denominators", () => {
    const view = render(<NativeExploration id="fraction-feast" />);
    fireEvent.press(view.getByText("Split every first-pizza slice in half"));
    expect(view.getByText(/First share: 4\/8 = 1\/2/)).toBeTruthy();
    expect(
      view.getByText(/The combined amount is exactly one whole pizza/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Decrease First selected slices"));
    expect(view.getByText(/3\/8 \+ 4\/8 = 7\/8 pizzas/)).toBeTruthy();
  });

  it("shows pentagon overlap and records distinct rotation and reflection", () => {
    const view = render(<NativeExploration id="pattern-palace" />);
    fireEvent.press(view.getByText("Pentagon"));
    expect(view.getByText(/overlap by 72°/)).toBeTruthy();
    fireEvent.press(view.getByText("Rotate a quarter turn"));
    fireEvent.press(view.getByText("Reflect motif"));
    expect(view.getByText(/Motif rotation: 90°. Reflection: on/)).toBeTruthy();
  });

  it("makes seasonal route and supply constraints matter", () => {
    const view = render(<NativeExploration id="caravan-crossroads" />);
    fireEvent.press(view.getByText("Wet season"));
    expect(
      view.getByText(/13 days of travel; 3 days short of supplies/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("River road"));
    expect(view.getByText(/8 days of travel; Enough supplies/)).toBeTruthy();
  });

  it("distinguishes visits, cross-species pollen and stepping-stone habitat", () => {
    const view = render(<NativeExploration id="pollinator-express" />);
    fireEvent.press(view.getByText("Visit Gold 1"));
    fireEvent.press(view.getByText("Visit Gold 1"));
    expect(
      view.getByText(/2 flower visits; 0 compatible pollen transfers/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Visit Gold 2"));
    expect(
      view.getByText(/3 flower visits; 1 compatible pollen transfers/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Visit Gold 3"));
    expect(view.getByText(/beyond the bee's flight reach/)).toBeTruthy();
    fireEvent.press(view.getByText("Add habitat patches"));
    fireEvent.press(view.getByText("Visit Gold bridge"));
    fireEvent.press(view.getByText("Visit Gold 3"));
    expect(
      view.getByText(/5 flower visits; 3 compatible pollen transfers/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Visit Violet 2"));
    expect(
      view.getByText(/6 flower visits; 3 compatible pollen transfers/),
    ).toBeTruthy();
  });

  it("requires predictions and preserves the controlled chance comparison", () => {
    jest.spyOn(Math, "random").mockReturnValue(0.1);
    const view = render(<NativeExploration id="chance-carnival" />);

    expect(view.getByText("Run 12 trials")).toBeDisabled();
    fireEvent.press(view.getByText("Counts can differ"));
    fireEvent.press(view.getByText("Run 12 trials"));
    expect(view.getByText(/Each fair draw is 25%/)).toBeTruthy();
    fireEvent.press(view.getByText("Run 1,200 trials"));
    expect(
      view.getByText(
        /12 trials: 100.0% · 0.0% · 0.0% · 0.0%.*Expected for both: 25% each/,
      ),
    ).toBeTruthy();
    expect(view.queryByText(/percentage points|\bpp\b|gap/i)).toBeNull();
    expect(view.getByText(/1,200 trials are not closer overall/)).toBeTruthy();

    expect(view.getByText("Run 200 trials")).toBeDisabled();
    fireEvent.press(view.getByText("40% (2 of 5)"));
    fireEvent.press(view.getByText("Run 200 trials"));
    expect(view.getByText(/Correct: 2\/5 = 40%/)).toBeTruthy();
    expect(view.getByText(/Outcome 1: 100.0% · expected 40%/)).toBeTruthy();
  });
});
