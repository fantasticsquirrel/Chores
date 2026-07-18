import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { ReactElement } from "react";
import { createRef, useState } from "react";
import * as ReactNative from "react-native";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { NavigationLayout } from "./types";
import { BottomNavigation } from "./BottomNavigation";
import { OverflowMenu } from "./OverflowMenu";

const layout: NavigationLayout = {
  primary: [
    { key: "home", label: "Home" },
    { key: "chores", label: "Chores" },
    { key: "homeschool", label: "School" },
    { key: "more", label: "More" },
  ],
  overflow: [
    { key: "children", label: "Children" },
    { key: "review", label: "Review" },
    { key: "account", label: "Account" },
  ],
};

async function renderWithInsets(element: ReactElement, bottom = 34) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { height: 800, width: 390, x: 0, y: 0 },
        insets: { bottom, left: 0, right: 0, top: 24 },
      }}
    >
      {element}
    </SafeAreaProvider>,
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("BottomNavigation", () => {
  it("renders one compact row and navigates to a primary destination", async () => {
    const onNavigate = jest.fn();
    const view = await renderWithInsets(
      <BottomNavigation
        activeTab="home"
        layout={layout}
        onNavigate={onNavigate}
        onOpenMore={jest.fn()}
      />,
    );

    expect(view.queryByRole("tablist")).toBeNull();
    expect(view.getAllByRole("button")).toHaveLength(4);
    const bottomBarStyle = StyleSheet.flatten(
      view.getByTestId("bottom-navigation").props.style,
    );
    expect(bottomBarStyle.paddingBottom).toBe(42);
    expect(
      view.getByRole("button", { name: "Home" }).props.accessibilityState,
    ).toEqual({ selected: true });

    fireEvent.press(view.getByRole("button", { name: "Chores" }));
    expect(onNavigate).toHaveBeenCalledWith("chores");
  });

  it("selects and opens More while an overflow destination is active", async () => {
    const onOpenMore = jest.fn();
    const view = await renderWithInsets(
      <BottomNavigation
        activeTab="review"
        layout={layout}
        onNavigate={jest.fn()}
        onOpenMore={onOpenMore}
      />,
    );

    const more = view.getByRole("button", { name: "More" });
    expect(more.props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(more);
    expect(onOpenMore).toHaveBeenCalledTimes(1);
  });
});

describe("OverflowMenu", () => {
  it("shows deterministic destinations and closes after selection", async () => {
    const onClose = jest.fn();
    const onNavigate = jest.fn();
    const view = await renderWithInsets(
      <OverflowMenu
        activeTab="children"
        items={layout.overflow}
        onClose={onClose}
        onNavigate={onNavigate}
        visible
      />,
    );

    expect(view.getByText("More")).toBeTruthy();
    const sheetStyle = StyleSheet.flatten(
      view.getByTestId("overflow-menu-sheet").props.style,
    );
    expect(sheetStyle.paddingBottom).toBe(58);
    expect(
      view
        .getAllByRole("button")
        .map((button) => button.props.accessibilityLabel),
    ).toEqual(["Children", "Review", "Account", "Close More menu"]);
    expect(
      view.getByRole("button", { name: "Children" }).props.accessibilityState,
    ).toEqual({ selected: true });

    fireEvent.press(view.getByRole("button", { name: "Review" }));
    expect(onNavigate).toHaveBeenCalledWith("review");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the heading on iOS show and restores More on dismissal", async () => {
    jest.replaceProperty(ReactNative.Platform, "OS", "ios");
    const events: string[] = [];
    const returnFocusRef = createRef<View>();
    jest.spyOn(ReactNative, "findNodeHandle").mockImplementation((node) =>
      node === returnFocusRef.current ? 202 : 101,
    );
    const focusSpy = jest
      .spyOn(AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => {
        events.push("focus");
      });

    function StatefulOverflow() {
      const [visible, setVisible] = useState(true);
      return (
        <>
          <View ref={returnFocusRef} />
          <OverflowMenu
            activeTab="home"
            items={layout.overflow}
            onClose={() => {
              events.push("close");
              setVisible(false);
            }}
            onNavigate={jest.fn()}
            returnFocusRef={returnFocusRef}
            visible={visible}
          />
        </>
      );
    }

    const view = await renderWithInsets(<StatefulOverflow />);
    const modal = view.UNSAFE_getByType(Modal);
    expect(modal.props.animationType).toBe("slide");
    events.length = 0;
    focusSpy.mockClear();

    modal.props.onShow();
    expect(events).toEqual(["focus"]);
    expect(focusSpy).toHaveBeenNthCalledWith(1, 101);

    await act(async () => {
      modal.props.onRequestClose();
    });
    expect(events).toEqual(["focus", "close"]);

    modal.props.onDismiss();
    expect(events).toEqual(["focus", "close", "focus"]);
    expect(focusSpy).toHaveBeenNthCalledWith(2, 202);
    focusSpy.mockRestore();
  });

  it("restores Android focus after a layout-driven modal dismissal", async () => {
    jest.replaceProperty(ReactNative.Platform, "OS", "android");
    const returnFocusRef = createRef<View>();
    const focusSpy = jest
      .spyOn(AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => undefined);

    function LayoutChangeHarness() {
      const [visible, setVisible] = useState(true);
      return (
        <>
          <View ref={returnFocusRef} />
          <Pressable
            accessibilityLabel="Change access"
            accessibilityRole="button"
            onPress={() => setVisible(false)}
          >
            <Text>Change access</Text>
          </Pressable>
          <OverflowMenu
            activeTab="home"
            items={layout.overflow}
            onClose={() => setVisible(false)}
            onNavigate={jest.fn()}
            returnFocusRef={returnFocusRef}
            visible={visible}
          />
        </>
      );
    }

    const view = await renderWithInsets(<LayoutChangeHarness />);
    const modal = view.UNSAFE_getByType(Modal);
    expect(modal.props.animationType).toBe("none");
    expect(modal.props.onDismiss).toBeUndefined();
    focusSpy.mockClear();
    modal.props.onShow();
    expect(focusSpy).toHaveBeenCalledTimes(1);

    fireEvent.press(view.getByRole("button", { name: "Change access" }));

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalledTimes(2);
    });
    focusSpy.mockRestore();
  });

  it("restores Android focus after the Back button closes the modal", async () => {
    jest.replaceProperty(ReactNative.Platform, "OS", "android");
    const returnFocusRef = createRef<View>();
    const focusSpy = jest
      .spyOn(AccessibilityInfo, "setAccessibilityFocus")
      .mockImplementation(() => undefined);

    function AndroidBackHarness() {
      const [visible, setVisible] = useState(true);
      return (
        <>
          <View ref={returnFocusRef} />
          <OverflowMenu
            activeTab="home"
            items={layout.overflow}
            onClose={() => setVisible(false)}
            onNavigate={jest.fn()}
            returnFocusRef={returnFocusRef}
            visible={visible}
          />
        </>
      );
    }

    const view = await renderWithInsets(<AndroidBackHarness />);
    const modal = view.UNSAFE_getByType(Modal);
    focusSpy.mockClear();
    modal.props.onShow();

    await act(async () => {
      modal.props.onRequestClose();
    });

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("invokes the close action", async () => {
    const onClose = jest.fn();
    const view = await renderWithInsets(
      <OverflowMenu
        activeTab="home"
        items={layout.overflow}
        onClose={onClose}
        onNavigate={jest.fn()}
        visible
      />,
    );

    fireEvent.press(view.getByRole("button", { name: "Close More menu" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
