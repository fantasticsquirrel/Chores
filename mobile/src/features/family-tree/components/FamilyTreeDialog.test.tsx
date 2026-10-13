import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { createRef } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import * as RN from "react-native";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  FamilyTreeDialog,
  type FamilyTreeDialogProps,
} from "./FamilyTreeDialog";
// A native lifecycle seam, not a replacement for the production modal/component.
jest.mock("react-native/Libraries/AppState/AppState", () => ({
  __esModule: true,
  default: {
    currentState: "active",
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));
function wrap(props: FamilyTreeDialogProps) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 24, bottom: 34, left: 0, right: 0 },
      }}
    >
      <FamilyTreeDialog {...props} />
    </SafeAreaProvider>
  );
}
const props = (
  extra: Partial<FamilyTreeDialogProps> = {},
): FamilyTreeDialogProps => ({
  visible: true,
  title: "Edit Alex",
  onRequestClose: jest.fn(),
  children: <Text>Draft stays here</Text>,
  ...extra,
});
beforeEach(() => {
  jest.replaceProperty(RN.AppState, "currentState", "active");
});
afterEach(() => {
  jest.restoreAllMocks();
});
describe("FamilyTreeDialog native ownership", () => {
  it("routes Close and hardware Back only through caller's draft guard", () => {
    const p = props();
    const view = render(wrap(p));
    fireEvent.press(view.getByRole("button", { name: "Close Edit Alex" }));
    act(() => view.UNSAFE_getByType(Modal).props.onRequestClose());
    expect(p.onRequestClose).toHaveBeenCalledTimes(2);
    expect(view.UNSAFE_getByType(Modal).props.visible).toBe(true);
    expect(view.getByText("Draft stays here")).toBeTruthy();
  });
  it("owns modal semantics with inset-aware scrollable handset bounds", () => {
    const view = render(wrap(props()));
    const modal = view.UNSAFE_getByType(Modal);
    expect(modal.props.allowSwipeDismissal).toBe(false);
    expect(modal.props.presentationStyle).toBe("overFullScreen");
    expect(
      view.getByTestId("family-tree-dialog-sheet").props
        .accessibilityViewIsModal,
    ).toBe(true);
    const frame = StyleSheet.flatten(
      view.getByTestId("family-tree-dialog-frame").props.style,
    );
    expect(frame.paddingBottom).toBe(34);
    expect(frame.paddingTop).toBe(24);
    const sheet = StyleSheet.flatten(
      view.getByTestId("family-tree-dialog-sheet").props.style,
    );
    expect(sheet.maxHeight).toBe("100%");
    expect(sheet.maxWidth).toBe(640);
    expect(
      view.UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps,
    ).toBe("handled");
    const close = StyleSheet.flatten(
      view.getByRole("button", { name: "Close Edit Alex" }).props.style,
    );
    expect(close.minHeight).toBeGreaterThanOrEqual(44);
  });
  it("focuses heading on native show, not the render effect", () => {
    const focus = jest
      .spyOn(RN.AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => undefined);
    jest.spyOn(RN, "findNodeHandle").mockReturnValue(101);
    const view = render(wrap(props()));
    focus.mockClear();
    expect(focus).not.toHaveBeenCalled();
    act(() => view.UNSAFE_getByType(Modal).props.onShow());
    expect(focus).toHaveBeenCalledWith(101);
  });
  it("restores exact surviving Android trigger only after committed dismissal", () => {
    jest.replaceProperty(RN.Platform, "OS", "android");
    const trigger = createRef<View>();
    trigger.current = {} as View;
    const focus = jest
      .spyOn(RN.AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => undefined);
    jest
      .spyOn(RN, "findNodeHandle")
      .mockImplementation((node) => (node === trigger.current ? 202 : 101));
    const p = props({ returnFocusRef: trigger });
    const view = render(wrap(p));
    const modal = view.UNSAFE_getByType(Modal);
    expect(modal.props.animationType).toBe("none");
    expect(modal.props.onDismiss).toBeUndefined();
    focus.mockClear();
    act(() => modal.props.onShow());
    act(() => modal.props.onRequestClose());
    expect(focus.mock.calls).toEqual([[101]]);
    view.rerender(wrap({ ...p, visible: false }));
    expect(focus.mock.calls).toEqual([[101], [202]]);
  });
  it("waits for iOS onDismiss and refuses premature restoration", () => {
    jest.replaceProperty(RN.Platform, "OS", "ios");
    const trigger = createRef<View>();
    trigger.current = {} as View;
    const focus = jest
      .spyOn(RN.AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => undefined);
    jest
      .spyOn(RN, "findNodeHandle")
      .mockImplementation((node) => (node === trigger.current ? 202 : 101));
    const p = props({ returnFocusRef: trigger });
    const view = render(wrap(p));
    const modal = view.UNSAFE_getByType(Modal);
    focus.mockClear();
    act(() => modal.props.onShow());
    act(() => modal.props.onDismiss());
    expect(focus.mock.calls).toEqual([[101]]);
    view.rerender(wrap({ ...p, visible: false }));
    expect(focus.mock.calls).toEqual([[101]]);
    act(() => modal.props.onDismiss());
    expect(focus.mock.calls).toEqual([[101], [202]]);
  });
  it("uses fallback when reconciliation removes the trigger", () => {
    jest.replaceProperty(RN.Platform, "OS", "android");
    const trigger = createRef<View>();
    trigger.current = {} as View;
    const fallback = createRef<View>();
    fallback.current = {} as View;
    const focus = jest
      .spyOn(RN.AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => undefined);
    jest
      .spyOn(RN, "findNodeHandle")
      .mockImplementation((node) => (node === fallback.current ? 303 : 202));
    const p = props({ returnFocusRef: trigger, fallbackFocusRef: fallback });
    const view = render(wrap(p));
    focus.mockClear();
    trigger.current = null;
    view.rerender(wrap({ ...p, visible: false }));
    expect(focus.mock.calls).toEqual([[303]]);
  });
  it("defers background restoration and resolves the surviving target on foreground", () => {
    jest.replaceProperty(RN.Platform, "OS", "android");
    let onChange: (state: RN.AppStateStatus) => void = () => undefined;
    const remove = jest.fn();
    jest
      .spyOn(RN.AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        onChange = listener;
        return { remove };
      });
    const trigger = createRef<View>();
    trigger.current = {} as View;
    const fallback = createRef<View>();
    fallback.current = {} as View;
    const focus = jest
      .spyOn(RN.AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => undefined);
    jest
      .spyOn(RN, "findNodeHandle")
      .mockImplementation((node) => (node === fallback.current ? 303 : 202));
    const p = props({ returnFocusRef: trigger, fallbackFocusRef: fallback });
    const view = render(wrap(p));
    focus.mockClear();
    jest.replaceProperty(RN.AppState, "currentState", "background");
    view.rerender(wrap({ ...p, visible: false }));
    expect(focus).not.toHaveBeenCalled();
    trigger.current = null;
    jest.replaceProperty(RN.AppState, "currentState", "active");
    act(() => onChange("active"));
    expect(focus.mock.calls).toEqual([[303]]);
    view.unmount();
    expect(remove).toHaveBeenCalled();
  });
  it("unmounts draft children when caller commits close", () => {
    const p = props();
    const view = render(wrap(p));
    view.rerender(wrap({ ...p, visible: false }));
    expect(view.queryByText("Draft stays here")).toBeNull();
  });
});
