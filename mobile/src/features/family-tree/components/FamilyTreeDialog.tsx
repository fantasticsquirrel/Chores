import type { ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import * as ReactNative from "react-native";
import {
  Modal,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../theme/ThemeContext";
import { FamilyTreeButton } from "./FamilyTreeControls";

export interface FamilyTreeDialogProps {
  visible: boolean;
  title: string;
  children: ReactNode;
  /** The caller owns dirty-draft confirmation and commits visible=false. */
  onRequestClose: () => void;
  /** Keep the trigger mounted; clear this ref if it is no longer a valid target. */
  returnFocusRef?: RefObject<View | Text | null>;
  fallbackFocusRef?: RefObject<View | Text | null>;
}
function focus(ref: RefObject<View | Text | null> | undefined) {
  if (!ref?.current) return;
  const handle = ReactNative.findNodeHandle(ref.current);
  if (handle !== null)
    ReactNative.AccessibilityInfo.setAccessibilityFocus(handle);
}

/** Platform modal owns focus/isolation; there is no internal draft or close state. */
export function FamilyTreeDialog({
  visible,
  title,
  children,
  onRequestClose,
  returnFocusRef,
  fallbackFocusRef,
}: FamilyTreeDialogProps) {
  const {
    definition: { colors },
  } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heading = useRef<Text>(null);
  const wasVisible = useRef(false);
  const visibleNow = useRef(visible);
  const restorePending = useRef(false);
  const dismissalReady = useRef(false);
  const entryPending = useRef(false);
  const targets = useRef({ returnFocusRef, fallbackFocusRef });
  visibleNow.current = visible;
  targets.current = { returnFocusRef, fallbackFocusRef };
  const isIos = ReactNative.Platform.OS === "ios";
  function restore() {
    if (
      visibleNow.current ||
      !restorePending.current ||
      !dismissalReady.current ||
      ReactNative.AppState.currentState !== "active"
    )
      return;
    restorePending.current = false;
    const current = targets.current;
    focus(
      current.returnFocusRef?.current
        ? current.returnFocusRef
        : current.fallbackFocusRef,
    );
  }
  useEffect(() => {
    if (wasVisible.current && !visible) {
      restorePending.current = true;
      dismissalReady.current = !isIos;
      // RN 0.85 Android has no onDismiss. No animation makes this committed
      // visible=false transition the deterministic restoration point.
      if (!isIos) restore();
    }
    if (visible) {
      restorePending.current = false;
      dismissalReady.current = false;
    }
    wasVisible.current = visible;
  }, [visible, isIos]);
  function show() {
    if (!visibleNow.current) return;
    entryPending.current = true;
    if (ReactNative.AppState.currentState === "active") {
      focus(heading);
      entryPending.current = false;
    }
  }
  useEffect(() => {
    const subscription = ReactNative.AppState.addEventListener(
      "change",
      (state) => {
        if (state !== "active") return;
        if (visibleNow.current && entryPending.current) show();
        else restore();
      },
    );
    return () => subscription.remove();
  }, []);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      allowSwipeDismissal={false}
      onRequestClose={onRequestClose}
      onShow={show}
      onDismiss={
        isIos
          ? () => {
              if (!visibleNow.current) {
                dismissalReady.current = true;
                restore();
              }
            }
          : undefined
      }
    >
      {visible ? (
        <View
          testID="family-tree-dialog-frame"
          style={{
            flex: 1,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left + 12,
            paddingRight: insets.right + 12,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            testID="family-tree-dialog-sheet"
            accessibilityViewIsModal
            importantForAccessibility="yes"
            style={{
              width: "100%",
              maxWidth: 640,
              maxHeight: "100%",
              height: Math.max(1, height - insets.top - insets.bottom),
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              overflow: "hidden",
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, gap: 12 }}
            >
              <Text
                ref={heading}
                accessible
                accessibilityRole="header"
                style={{ fontSize: 22, fontWeight: "700", color: colors.text }}
              >
                {title}
              </Text>
              <FamilyTreeButton
                label={`Close ${title}`}
                onPress={onRequestClose}
              >
                Close
              </FamilyTreeButton>
              {children}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}
