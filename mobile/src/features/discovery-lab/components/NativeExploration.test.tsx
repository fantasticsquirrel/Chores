import { describe, expect, it } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { NativeExploration } from "./NativeExploration";
describe("native guided experiment controls", () => {
  it.each(["constructor", "__proto__", "toString"])(
    "guards inherited object name %s",
    (id) => {
      const view = render(<NativeExploration id={id} />);
      expect(view.getByRole("alert")).toBeTruthy();
    },
  );
  it("compares planetary diameters on a common linear scale", () => {
    const view = render(<NativeExploration id="solar-system" />);
    fireEvent.press(view.getByText("Compare planet diameters"));
    expect(
      view.getByText(/Equatorial diameter 12,756 km; 1.00 Earth diameters/),
    ).toBeTruthy();
    fireEvent.press(
      view.getByText("Increase Planet index (Mercury 0 to Neptune 7)"),
    );
    expect(
      view.getByText(/Equatorial diameter 6,792 km; 0.53 Earth diameters/),
    ).toBeTruthy();
  });
  it("does not substitute castle content for an unsupported Exploration", () => {
    const view = render(<NativeExploration id="future-topic" />);
    expect(view.getByRole("alert")).toHaveTextContent(
      "This Exploration's interactive model is not available in this app yet.",
    );
    expect(view.queryByText("Open gate")).toBeNull();
    expect(view.queryByText("Experiment bench")).toBeNull();
    view.rerender(<NativeExploration id="castle-defenses" />);
    expect(view.getByText("Open gate")).toBeTruthy();
    view.rerender(<NativeExploration id="future-topic" />);
    expect(view.queryByText("Open gate")).toBeNull();
  });
  it("changes central mass without changing launch speed and resets", () => {
    const view = render(<NativeExploration id="orbital-mechanics" />);
    fireEvent.press(view.getByText("Increase Central mass"));
    expect(view.getByText(/central mass 1.3/)).toBeTruthy();
    fireEvent.press(view.getByText("Reset experiment"));
    expect(view.getByText(/central mass 1.0/)).toBeTruthy();
  });
  it("uses water in both optical directions", () => {
    const view = render(<NativeExploration id="reflection-refraction" />);
    expect(view.getByText(/Air → water/)).toBeTruthy();
    fireEvent.press(view.getByText("Swap materials"));
    expect(view.getByText(/Water → air/)).toBeTruthy();
  });
  it("opens the gate and explicitly reveals sight lines", () => {
    const view = render(<NativeExploration id="castle-defenses" />);
    fireEvent.press(view.getByText("Open gate"));
    expect(
      view.getByText(/Gate open: the direct entrance route remains/),
    ).toBeTruthy();
    fireEvent.press(view.getByText("Show sight-line overlay (not structures)"));
    expect(view.getByText(/Sight-line overlay shown/)).toBeTruthy();
  });
  it("calls the end of a full lunar cycle New Moon", () => {
    const view = render(<NativeExploration id="moon-phases" />);
    for (let i = 0; i < 18; i++)
      fireEvent.press(view.getByText("Increase Moon angle"));
    expect(view.getByText(/360° orbital angle; 0%.*New Moon/)).toBeTruthy();
  });
});
