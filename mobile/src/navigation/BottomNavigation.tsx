import type { RefObject } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { navigationStyles } from "../styles/navigation";
import { isMoreSelected } from "./tabs";
import type { AppTab, NavigationLayout } from "./types";

export function BottomNavigation({
  activeTab,
  layout,
  moreButtonRef,
  onNavigate,
  onOpenMore,
}: {
  activeTab: AppTab;
  layout: NavigationLayout;
  moreButtonRef?: RefObject<View | null>;
  onNavigate: (tab: AppTab) => void;
  onOpenMore: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        navigationStyles.bottomBar,
        { paddingBottom: navigationStyles.bottomBar.paddingBottom + insets.bottom },
      ]}
      testID="bottom-navigation"
    >
      {layout.primary.map((item) => {
        const selected =
          item.key === "more"
            ? isMoreSelected(layout, activeTab)
            : item.key === activeTab;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={item.key}
            onPress={() =>
              item.key === "more" ? onOpenMore() : onNavigate(item.key)
            }
            ref={item.key === "more" ? moreButtonRef : undefined}
            style={({ pressed }) => [
              navigationStyles.bottomButton,
              selected ? navigationStyles.bottomButtonSelected : null,
              pressed ? { opacity: 0.72 } : null,
            ]}
          >
            <Text
              style={[
                navigationStyles.bottomLabel,
                selected ? navigationStyles.bottomLabelSelected : null,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
