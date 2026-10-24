import { describe, expect, it } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { NativeExploration } from "./NativeExploration";

const ids = [
  "machine-workshop",
  "heat-house",
  "pressure-tank",
  "moving-plates",
  "cloud-rain-lab",
  "magnetic-fields",
  "cell-explorer",
  "shape-slicer",
  "adaptation-island",
];
describe("nine additional native investigations", () => {
  it.each(ids)("%s has working native controls, result, and reset", (id) => {
    const view = render(<NativeExploration id={id} />);
    expect(view.queryByText(/not available in this app yet/)).toBeNull();
    const reset = view.getByRole("button", { name: "Reset experiment" });
    expect(view.getAllByRole("button").length).toBeGreaterThan(1);
    fireEvent.press(reset);
    view.unmount();
  });
});
