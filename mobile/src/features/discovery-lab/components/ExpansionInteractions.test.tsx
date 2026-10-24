import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { validSceneState } from "@family-manager/discovery-scenes/protocol";
import { NativeExploration } from "./NativeExploration";
const mockInject = jest.fn();
jest.mock("react-native-webview", () => {
  const React = require("react"),
    { View } = require("react-native");
  return {
    WebView: React.forwardRef(
      (props: Record<string, unknown>, ref: unknown) => {
        React.useImperativeHandle(ref, () => ({
          injectJavaScript: mockInject,
        }));
        return React.createElement(View, {
          ...props,
          testID: "expansion-scene",
        });
      },
    ),
  };
});
afterEach(() => {
  jest.clearAllMocks();
});
const cases = [
  {
    id: "machine-workshop",
    action: "Increase Mechanical advantage",
    changed: { advantage: 3 },
    result: /Input force 130.8 N/,
  },
  {
    id: "heat-house",
    action: "Increase Insulation (cm)",
    changed: { insulationCm: 6 },
    result: /Net outward heat transfer:/,
  },
  {
    id: "pressure-tank",
    action: "Increase Water depth (m)",
    changed: { depthM: 2.1 },
    result: /Static gauge pressure at outlet depth 15696 Pa/,
  },
  {
    id: "moving-plates",
    action: "Advance one step",
    changed: { movement: 24 },
    result: /Movement 24 diagram units/,
  },
  {
    id: "cloud-rain-lab",
    action: "Increase Uplift (m)",
    changed: { upliftM: 1500 },
    result: /Parcel temperature/,
  },
  {
    id: "magnetic-fields",
    action: "Flip right magnet",
    changed: { flipped: true },
    result: /Facing poles repel/,
  },
  {
    id: "cell-explorer",
    action: "Transfer one step",
    changed: { outside: 11, inside: 5 },
    result: /Outside 11.0; inside 5.0/,
  },
  {
    id: "shape-slicer",
    action: "Diagonal cube slice",
    changed: { tilt: 45, turn: 35.26438968 },
    result: /cross-section is a hexagon/,
  },
  {
    id: "adaptation-island",
    action: "Next generation",
    changed: { generation: 1 },
    result: /Generation 1: dark shells 64.3%, pale shells 35.7%/,
  },
];
const comparisons = [
  { id: "machine-workshop", titles: ["Supporting strands", "Gear ratio"] },
  { id: "heat-house", titles: ["Wall insulation", "Window area"] },
  { id: "pressure-tank", titles: ["Water above outlet", "Tank width"] },
  { id: "moving-plates", titles: ["Boundary types", "Locked fault and slip"] },
  {
    id: "cloud-rain-lab",
    titles: ["Rising and cooling", "Cloud is not always rain"],
  },
  { id: "magnetic-fields", titles: ["Facing poles", "Field cancellation"] },
  {
    id: "cell-explorer",
    titles: ["Different molecules", "Glucose and carrier"],
  },
  { id: "shape-slicer", titles: ["Cube orientation", "Sphere slice position"] },
  {
    id: "adaptation-island",
    titles: ["Habitat and survival", "Predation and selection"],
  },
];
function lastState() {
  const script = String(mockInject.mock.calls.at(-1)?.[0]);
  return JSON.parse(script.match(/setState\((.*)\); true;/)![1]);
}
function ready(view: ReturnType<typeof render>) {
  const surface = view.getByTestId("expansion-scene", {
    includeHiddenElements: true,
  });
  fireEvent(surface, "message", { nativeEvent: { data: '{"type":"ready"}' } });
  return surface.props.source;
}
describe("native nine-topic controls and paired investigations", () => {
  it.each(cases)(
    "$id changes its model without reloading the offline document",
    ({ id, action, changed, result }) => {
      const view = render(<NativeExploration id={id} />),
        source = ready(view),
        initial = lastState();
      fireEvent.press(view.getByRole("button", { name: action }));
      expect(lastState()).toMatchObject(changed);
      expect(validSceneState(lastState())).toBe(true);
      expect(view.getByText(result)).toBeTruthy();
      expect(
        view.getByTestId("expansion-scene", { includeHiddenElements: true })
          .props.source,
      ).toBe(source);
      fireEvent.press(view.getByRole("button", { name: "Reset experiment" }));
      expect(lastState()).toEqual(initial);
      view.unmount();
    },
  );
  it.each(comparisons)(
    "$id has two prediction-first controlled comparisons",
    ({ id, titles }) => {
      const view = render(<NativeExploration id={id} />);
      ready(view);
      for (const title of titles) {
        expect(
          view.queryByRole("button", { name: `Compare: ${title}` }),
        ).toBeNull();
        fireEvent.press(
          view.getByRole("button", { name: `Set baseline: ${title}` }),
        );
        const baseline = lastState();
        fireEvent.press(
          view.getByRole("button", { name: `Compare: ${title}` }),
        );
        expect(validSceneState(lastState())).toBe(true);
        expect(lastState()).not.toEqual(baseline);
      }
      view.unmount();
    },
  );
  it("supports zero and reversed heat flow without changing the indoor temperature", () => {
    const view = render(<NativeExploration id="heat-house" />);
    ready(view);
    for (let i = 0; i < 20; i++)
      fireEvent.press(
        view.getByRole("button", { name: "Increase Outside temperature (°C)" }),
      );
    expect(lastState()).toMatchObject({ insideC: 20, outsideC: 20 });
    expect(view.getByText(/Net outward heat transfer: 0 W/)).toBeTruthy();
    fireEvent.press(
      view.getByRole("button", { name: "Increase Outside temperature (°C)" }),
    );
    expect(validSceneState(lastState())).toBe(true);
    expect(view.getByText(/Net outward heat transfer: -/)).toBeTruthy();
  });
  it("keeps island expected shares valid through the generation limit", () => {
    const view = render(<NativeExploration id="adaptation-island" />);
    ready(view);
    for (let i = 0; i < 4; i++)
      fireEvent.press(
        view.getByRole("button", { name: "Advance five generations" }),
      );
    expect(lastState().generation).toBe(20);
    expect(validSceneState(lastState())).toBe(true);
    expect(lastState().darkCount + lastState().lightCount).toBeCloseTo(100);
    expect(
      view.getByRole("button", { name: "Next generation" }).props
        .accessibilityState.disabled,
    ).toBe(true);
  });
  it("keeps all native results and actions usable after a scene failure", () => {
    const view = render(<NativeExploration id="cell-explorer" />);
    const surface = view.getByTestId("expansion-scene", {
      includeHiddenElements: true,
    });
    fireEvent(surface, "message", {
      nativeEvent: { data: '{"type":"unavailable"}' },
    });
    expect(view.getByText(/Detailed view unavailable/)).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Transfer one step" }));
    expect(view.getByText(/Outside 11.0; inside 5.0/)).toBeTruthy();
  });
});
