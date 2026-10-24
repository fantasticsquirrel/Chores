import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, act } from "@testing-library/react-native";
import { NativeMoonScene } from "./NativeMoonScene";

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
        return React.createElement(View, { ...props, testID: "moon-webview" });
      },
    ),
  };
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("native offline Moon exhibit", () => {
  it("keeps native angle authoritative without reloading its bundled document", () => {
    const onChange = jest.fn();
    const view = render(
      <NativeMoonScene
        angle={90}
        onChange={onChange}
        label="50% illuminated"
      />,
    );
    const firstSource = view.getByTestId("moon-webview", {
      includeHiddenElements: true,
    }).props.source;
    expect(firstSource.html).toContain("Content-Security-Policy");
    expect(mockInject).not.toHaveBeenCalled();
    fireEvent(
      view.getByTestId("moon-webview", { includeHiddenElements: true }),
      "message",
      {
        nativeEvent: { data: '{"type":"ready"}' },
      },
    );
    expect(mockInject).toHaveBeenLastCalledWith(
      'window.discoveryScene?.setState({"kind":"moon","angle":90}); true;',
    );
    fireEvent(
      view.getByTestId("moon-webview", { includeHiddenElements: true }),
      "message",
      { nativeEvent: { data: '{"type":"rendered"}' } },
    );
    view.rerender(
      <NativeMoonScene
        angle={135}
        onChange={onChange}
        label="85% illuminated"
      />,
    );
    expect(mockInject).toHaveBeenLastCalledWith(
      'window.discoveryScene?.setState({"kind":"moon","angle":135}); true;',
    );
    expect(
      view.getByTestId("moon-webview", { includeHiddenElements: true }).props
        .source,
    ).toBe(firstSource);
    fireEvent(
      view.getByTestId("moon-webview", { includeHiddenElements: true }),
      "message",
      {
        nativeEvent: { data: '{"type":"angle","angle":180}' },
      },
    );
    expect(onChange).toHaveBeenLastCalledWith(180);
    onChange.mockClear();
    fireEvent(
      view.getByTestId("moon-webview", { includeHiddenElements: true }),
      "message",
      {
        nativeEvent: { data: '{"type":"angle","angle":"alert(1)"}' },
      },
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("blocks external navigation and access to cookies, storage and files", () => {
    const view = render(
      <NativeMoonScene
        angle={90}
        onChange={jest.fn()}
        label="50% illuminated"
      />,
    );
    const props = view.getByTestId("moon-webview", {
      includeHiddenElements: true,
    }).props;
    expect(props.onShouldStartLoadWithRequest({ url: "about:blank" })).toBe(
      true,
    );
    expect(
      props.onShouldStartLoadWithRequest({ url: "https://example.com" }),
    ).toBe(false);
    expect(props.incognito).toBe(true);
    for (const key of [
      "sharedCookiesEnabled",
      "thirdPartyCookiesEnabled",
      "domStorageEnabled",
      "allowFileAccess",
      "allowFileAccessFromFileURLs",
      "allowUniversalAccessFromFileURLs",
      "geolocationEnabled",
    ])
      expect(props[key]).toBe(false);
    expect(props.mixedContentMode).toBe("never");
    expect(props.mediaCapturePermissionGrantType).toBe("deny");
  });

  it("retains an accessible phase fallback when WebGL or a texture fails", () => {
    const view = render(
      <NativeMoonScene
        angle={90}
        onChange={jest.fn()}
        label="50% illuminated"
      />,
    );
    fireEvent(
      view.getByTestId("moon-webview", { includeHiddenElements: true }),
      "message",
      {
        nativeEvent: { data: '{"type":"unavailable"}' },
      },
    );
    expect(
      view.queryByTestId("moon-webview", { includeHiddenElements: true }),
    ).toBeNull();
    expect(view.getByRole("image", { name: "50% illuminated" })).toBeTruthy();
    expect(view.getByText(/Detailed view unavailable/)).toBeTruthy();
  });

  it("falls back after a bounded load wait and clears the timer on unmount", () => {
    jest.useFakeTimers();
    const view = render(
      <NativeMoonScene
        angle={90}
        onChange={jest.fn()}
        label="50% illuminated"
      />,
    );
    act(() => jest.advanceTimersByTime(12000));
    expect(
      view.queryByTestId("moon-webview", { includeHiddenElements: true }),
    ).toBeNull();
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
