import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render } from "@testing-library/react-native";
import { validSceneState } from "@family-manager/discovery-scenes/protocol";
import { NativeExploration } from "./NativeExploration";

const mockInject = jest.fn();
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: React.forwardRef(
      (props: Record<string, unknown>, ref: unknown) => {
        React.useImperativeHandle(ref, () => ({
          injectJavaScript: mockInject,
        }));
        return React.createElement(View, {
          ...props,
          testID: "offline-scene-webview",
        });
      },
    ),
  };
});
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
const scenes = [
  ...[
    "machine-workshop",
    "heat-house",
    "pressure-tank",
    "moving-plates",
    "cloud-rain-lab",
    "magnetic-fields",
    "cell-explorer",
    "shape-slicer",
    "adaptation-island",
  ].map((id) => [id, id]),
  ["orbital-mechanics", "orbit"],
  ["reflection-refraction", "optics"],
  ["gravity", "gravity"],
  ["solar-system", "solar"],
  ["moon-phases", "moon"],
  ["photosynthesis", "leaf"],
  ["castle-defenses", "castle"],
  ["sound-playground", "sound"],
  ["bridge-builder", "bridge"],
  ["river-sculptor", "river"],
  ["circuit-city", "circuit"],
  ["food-web-rescue", "pond"],
  ["fraction-feast", "pizza"],
  ["pattern-palace", "pattern"],
  ["caravan-crossroads", "caravan"],
  ["pollinator-express", "garden"],
  ["chance-carnival", "chance"],
];
function injectedStates() {
  return mockInject.mock.calls.map(([script]) => {
    const match = String(script).match(/setState\((.*)\); true;/);
    expect(match).not.toBeNull();
    return JSON.parse(match![1]);
  });
}
describe("all native educational models use bounded offline visuals", () => {
  it.each(scenes)(
    "%s supplies valid %s state and keeps native controls",
    (id, kind) => {
      const view = render(<NativeExploration id={id} />);
      const surfaces = view.getAllByTestId("offline-scene-webview", {
        includeHiddenElements: true,
      });
      expect(surfaces).toHaveLength(kind === "pattern" ? 2 : 1);
      for (const surface of surfaces)
        fireEvent(surface, "message", {
          nativeEvent: { data: '{"type":"ready"}' },
        });
      const states = injectedStates();
      expect(states.length).toBeGreaterThan(0);
      for (const state of states) {
        expect(validSceneState(state)).toBe(true);
        expect(state.kind).toBe(kind);
      }
      expect(view.getAllByRole("button").length).toBeGreaterThan(0);
      if (kind === "castle") expect(states.at(-1).sight).toBe(false);
      view.unmount();
    },
  );
  it("sends the actual final Chance outcome without adding random draws", () => {
    const view = render(<NativeExploration id="chance-carnival" />);
    fireEvent(
      view.getByTestId("offline-scene-webview", {
        includeHiddenElements: true,
      }),
      "message",
      { nativeEvent: { data: '{"type":"ready"}' } },
    );
    const random = jest.spyOn(Math, "random").mockReturnValue(0.1);
    for (let i = 0; i < 9; i++) random.mockReturnValueOnce(0.1);
    random.mockReturnValueOnce(0.9);
    fireEvent.press(view.getByText("Run 10 trials"));
    expect(random).toHaveBeenCalledTimes(10);
    expect(injectedStates().at(-1).last).toBe(3);
    expect(view.getByText(/Gold: 9 observed/)).toBeTruthy();
    expect(view.getByText(/Coral: 1 observed/)).toBeTruthy();
    fireEvent.press(view.getByText("Clear trial counts"));
    expect(injectedStates().at(-1).last).toBeNull();
  });
});
