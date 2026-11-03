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
const cases: {
  id: string;
  action: string;
  changed: Record<string, unknown>;
  result: RegExp;
  reset?: string;
}[] = [
  {
    id: "machine-workshop",
    action: "Increase Supporting rope sections",
    changed: { advantage: 3 },
    result: /input force 130.8 N/i,
    reset: "Reset lesson",
  },
  {
    id: "heat-house",
    action: "Increase Insulation (cm)",
    changed: { insulationCm: 6 },
    result: /Net outward heat-transfer power:/,
    reset: "Reset lesson",
  },
  {
    id: "pressure-tank",
    action: "Increase Water surface height (m)",
    changed: { depthM: 2.1 },
    result:
      /closed wall sensor at outlet height has calculated gauge pressure 15\.696 kPa; absolute pressure 117\.021 kPa/,
    reset: "Reset lesson",
  },
  {
    id: "moving-plates",
    action: "Increase Elapsed time (million years)",
    changed: { elapsedMillionYears: 2.25 },
    result: /2\.25 million years.*90 km/i,
    reset: "Reset lesson",
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
  {
    id: "moving-plates",
    titles: ["Boundary direction", "Locked fault slip"],
  },
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
    ({ id, action, changed, result, reset = "Reset experiment" }) => {
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
      fireEvent.press(view.getByRole("button", { name: reset }));
      expect(lastState()).toEqual(initial);
      view.unmount();
    },
  );
  it.each(comparisons)(
    "$id has two prediction-first controlled comparisons",
    ({ id, titles }) => {
      const view = render(<NativeExploration id={id} />);
      ready(view);
      for (const [index, title] of titles.entries()) {
        expect(
          view.queryByRole("button", { name: `Compare: ${title}` }),
        ).toBeNull();
        if (id === "moving-plates") {
          if (index > 0)
            fireEvent.press(view.getByRole("radio", { name: title }));
          fireEvent.press(
            view.getByRole("radio", {
              name: index === 0 ? "Different structures" : "A sudden slip",
            }),
          );
        }
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
  it("requires a Machine Workshop prediction and reports exact evidence before reset", () => {
    const view = render(<NativeExploration id="machine-workshop" />);
    ready(view);
    expect(
      view.queryByRole("button", { name: "Set baseline: Pulley sections" }),
    ).toBeNull();
    fireEvent.press(view.getByRole("radio", { name: "Less force, more rope" }));
    fireEvent.press(
      view.getByRole("button", { name: "Set baseline: Pulley sections" }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Compare: Pulley sections" }),
    );
    expect(view.getByText(/392.4 N to 196.2 N/)).toBeTruthy();
    expect(view.getByText(/supports your prediction/)).toBeTruthy();
    fireEvent.press(view.getByRole("radio", { name: "Gear ratio" }));
    fireEvent.press(
      view.getByRole("radio", {
        name: "More crank turns, less hand force",
      }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Set baseline: Gear ratio" }),
    );
    expect(
      view.getByRole("button", {
        name: "Increase Driven teeth divided by driver teeth",
      }),
    ).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Compare: Gear ratio" }));
    expect(view.getByText(/0.40 to 1.59/)).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Reset lesson" }));
    expect(view.queryByText(/supports your prediction/)).toBeNull();
    fireEvent.press(view.getByRole("radio", { name: "Same force and rope" }));
    fireEvent.press(
      view.getByRole("button", { name: "Set baseline: Pulley sections" }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Compare: Pulley sections" }),
    );
    expect(view.getByText(/does not support your prediction/)).toBeTruthy();
    fireEvent.press(view.getByRole("radio", { name: "Gear winch" }));
    expect(view.getByText(/required output torque stays fixed/i)).toBeTruthy();
    expect(view.getByText(/0\.20 m crank and drum radii/i)).toBeTruthy();
    view.unmount();
  });
  it("supports zero and reversed heat flow without changing the indoor temperature", () => {
    const view = render(<NativeExploration id="heat-house" />);
    ready(view);
    for (let i = 0; i < 20; i++)
      fireEvent.press(
        view.getByRole("button", { name: "Increase Outside temperature (°C)" }),
      );
    expect(lastState()).toMatchObject({ insideC: 20, outsideC: 20 });
    expect(view.getByText(/Net outward heat-transfer power: 0 W/)).toBeTruthy();
    fireEvent.press(
      view.getByRole("button", { name: "Increase Outside temperature (°C)" }),
    );
    expect(validSceneState(lastState())).toBe(true);
    expect(view.getByText(/Net outward heat-transfer power: -/)).toBeTruthy();
  });
  it("gives Pressure Tank exact evidence, prediction feedback and complete reset", () => {
    const view = render(<NativeExploration id="pressure-tank" />);
    ready(view);
    expect(
      view.queryByRole("button", { name: "Set baseline: Raise the water" }),
    ).toBeNull();
    fireEvent.press(view.getByRole("radio", { name: "Pressure triples" }));
    fireEvent.press(
      view.getByRole("button", { name: "Set baseline: Raise the water" }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Compare: Raise the water" }),
    );
    expect(view.getByText(/supports your prediction/)).toBeTruthy();
    expect(view.getByText(/4\.905 to 14\.715 kPa/)).toBeTruthy();
    expect(view.getByText(/49\.05 to 147\.15 N/)).toBeTruthy();
    fireEvent.press(view.getByRole("radio", { name: "Change tank shape" }));
    fireEvent.press(view.getByRole("radio", { name: "Same speed" }));
    fireEvent.press(
      view.getByRole("button", { name: "Set baseline: Change tank shape" }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Compare: Change tank shape" }),
    );
    expect(view.getByText(/2,000 to 6,480 L/)).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Reset lesson" }));
    expect(view.queryByText(/supports your prediction/)).toBeNull();
    fireEvent.press(view.getByRole("radio", { name: "Pressure doubles" }));
    fireEvent.press(
      view.getByRole("button", { name: "Set baseline: Raise the water" }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Compare: Raise the water" }),
    );
    expect(view.getByText(/does not support your prediction/)).toBeTruthy();
    expect(
      view.getByText(/teaching inputs, not equipment specifications/),
    ).toBeTruthy();
  });
  it("gives Heat House exact energy evidence and correct or incorrect feedback", () => {
    const view = render(<NativeExploration id="heat-house" />);
    ready(view);
    expect(
      view.queryByRole("button", { name: "Set baseline: Wall insulation" }),
    ).toBeNull();
    fireEvent.press(
      view.getByRole("radio", { name: "Window power stays the same" }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Set baseline: Wall insulation" }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Compare: Wall insulation" }),
    );
    expect(view.getByText(/supports your prediction/)).toBeTruthy();
    expect(view.getAllByText(/448 W/).length).toBeGreaterThan(0);
    expect(view.getAllByText(/kWh/).length).toBeGreaterThan(0);
    expect(view.getByText(/Changed: added wall insulation/)).toBeTruthy();
    fireEvent.press(view.getByRole("button", { name: "Reset lesson" }));
    fireEvent.press(view.getByRole("radio", { name: "Window power falls" }));
    fireEvent.press(
      view.getByRole("button", { name: "Set baseline: Wall insulation" }),
    );
    fireEvent.press(
      view.getByRole("button", { name: "Compare: Wall insulation" }),
    );
    expect(view.getByText(/does not support your prediction/)).toBeTruthy();
    expect(
      view.getByRole("button", { name: "Increase Elapsed time (h)" }),
    ).toBeTruthy();
    expect(view.queryByText(/rich scene|position-only/i)).toBeNull();
    expect(
      view.getByText(/Real building transfer includes conduction/),
    ).toBeTruthy();
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
