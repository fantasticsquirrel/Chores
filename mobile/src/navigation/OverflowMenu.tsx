import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import * as ReactNative from "react-native";
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { navigationStyles } from "../styles/navigation";
import type { AppTab, NavigationItem } from "./types";

function focusAccessibilityTarget(
  ref: RefObject<Text | View | null> | undefined,
) {
  const handle =
    ref?.current === null
      ? null
      : ReactNative.findNodeHandle(ref?.current ?? null);
  if (handle !== null) {
    AccessibilityInfo.setAccessibilityFocus(handle);
  }
}

export function OverflowMenu({
  activeTab,
  items,
  onClose,
  onNavigate,
  returnFocusRef,
  visible,
}: {
  activeTab: AppTab;
  items: NavigationItem[];
  onClose: () => void;
  onNavigate: (tab: AppTab) => void;
  returnFocusRef?: RefObject<View | null>;
  visible: boolean;
}) {
  const headingRef = useRef<Text>(null);
  const insets = useSafeAreaInsets();
  const isIos = ReactNative.Platform.OS === "ios";
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (!isIos && wasVisibleRef.current && !visible) {
      focusAccessibilityTarget(returnFocusRef);
    }
    wasVisibleRef.current = visible;
  }, [isIos, returnFocusRef, visible]);

  function closeMenu() {
    onClose();
  }

  return (
    <Modal
      animationType={isIos ? "slide" : "none"}
      onDismiss={
        isIos ? () => focusAccessibilityTarget(returnFocusRef) : undefined
      }
      onRequestClose={closeMenu}
      onShow={() => focusAccessibilityTarget(headingRef)}
      transparent
      visible={visible}
    >
      <View style={navigationStyles.modalBackdrop}>
        <View
          accessibilityViewIsModal
          style={[
            navigationStyles.menu,
            { paddingBottom: navigationStyles.menu.paddingBottom + insets.bottom },
          ]}
          testID="overflow-menu-sheet"
        >
          <Text
            accessibilityRole="header"
            ref={headingRef}
            style={navigationStyles.menuHeading}
          >
            More
          </Text>
          {items.map((item) => {
            const selected = item.key === activeTab;
            return (
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={item.key}
                onPress={() => {
                  onNavigate(item.key);
                  closeMenu();
                }}
                style={({ pressed }) => [
                  navigationStyles.menuItem,
                  selected ? navigationStyles.menuItemSelected : null,
                  pressed ? { opacity: 0.72 } : null,
                ]}
              >
                <Text
                  style={[
                    navigationStyles.menuItemLabel,
                    selected ? navigationStyles.menuItemLabelSelected : null,
                  ]}
                >
                  {item.label}
                </Text>
                {selected ? (
                  <Text style={navigationStyles.menuItemState}>Current</Text>
                ) : null}
              </Pressable>
            );
          })}
          <Pressable
            accessibilityLabel="Close More menu"
            accessibilityRole="button"
            onPress={closeMenu}
            style={({ pressed }) => [
              navigationStyles.closeButton,
              pressed ? { opacity: 0.72 } : null,
            ]}
          >
            <Text style={navigationStyles.closeButtonLabel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
