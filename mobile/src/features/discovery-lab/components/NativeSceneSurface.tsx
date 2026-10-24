import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import {
  isLocalSceneNavigation,
  readSceneMessage,
  sceneStateScript,
  type OfflineSceneState,
} from "@family-manager/discovery-scenes/protocol";
import sceneDocument from "../rendering/offline-scenes.generated.json";
import svgDocument from "../rendering/offline-svg.generated.json";
import { colors } from "../../../styles/colors";
const sources = {
  webgl: Object.freeze({ html: sceneDocument.html }),
  svg: Object.freeze({ html: svgDocument.html }),
};

/** Scene-only offline document. Native state, controls and accessible results remain authoritative. */
export function NativeSceneSurface({
  state,
  label,
  fallback,
  onAngle,
  onWidthChange,
  height = 320,
}: {
  state: OfflineSceneState;
  label: string;
  fallback: ReactNode;
  onAngle?: (angle: number) => void;
  onWidthChange?: (width: number) => void;
  height?: number;
}) {
  const source =
    state.kind === "optics" || state.kind === "pattern"
      ? sources.svg
      : sources.webgl;
  const webview = useRef<WebView>(null);
  const [status, setStatus] = useState<"loading" | "rendered" | "unavailable">(
    Platform.OS === "web" ? "unavailable" : "loading",
  );
  const [connected, setConnected] = useState(false);
  const script = sceneStateScript(state);
  useEffect(() => {
    if (status !== "loading") return;
    const timeout = setTimeout(() => setStatus("unavailable"), 12000);
    return () => clearTimeout(timeout);
  }, [status]);
  useEffect(() => {
    if (connected && script) webview.current?.injectJavaScript(script);
  }, [connected, script]);
  return (
    <View style={{ gap: 8 }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        onLayout={(event) => onWidthChange?.(event.nativeEvent.layout.width)}
        style={{
          height,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: "#020611",
        }}
      >
        {status !== "rendered" && fallback}
        {status !== "unavailable" && (
          <WebView
            ref={webview}
            source={source}
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={(request) =>
              isLocalSceneNavigation(request.url)
            }
            onMessage={(event) => {
              const message = readSceneMessage(event.nativeEvent.data);
              if (message?.type === "ready") setConnected(true);
              else if (message?.type === "rendered") setStatus("rendered");
              else if (message?.type === "unavailable")
                setStatus("unavailable");
              else if (
                message?.type === "angle" &&
                status === "rendered" &&
                state.kind === "moon"
              )
                onAngle?.(message.angle);
            }}
            onError={() => setStatus("unavailable")}
            onHttpError={() => setStatus("unavailable")}
            onContentProcessDidTerminate={() => setStatus("unavailable")}
            onRenderProcessGone={() => setStatus("unavailable")}
            incognito
            cacheEnabled={false}
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled={false}
            domStorageEnabled={false}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            geolocationEnabled={false}
            mixedContentMode="never"
            mediaCapturePermissionGrantType="deny"
            javaScriptCanOpenWindowsAutomatically={false}
            setSupportMultipleWindows={false}
            onOpenWindow={() => {
              /* No scene opens another document. */
            }}
            allowsLinkPreview={false}
            mediaPlaybackRequiresUserAction
            scrollEnabled={false}
            bounces={false}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            containerStyle={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            style={{
              flex: 1,
              backgroundColor: "#020611",
              opacity: status === "rendered" ? 1 : 0,
            }}
          />
        )}
      </View>
      {status === "unavailable" && (
        <Text style={{ color: colors.textMuted, lineHeight: 22 }}>
          Detailed view unavailable. The diagram and controls still work.
        </Text>
      )}
    </View>
  );
}
