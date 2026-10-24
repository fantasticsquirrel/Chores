jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Unit tests have no native WebView module. Browser/device rendering is a separate gate.
jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
      return React.createElement(View, props);
    }),
  };
});
