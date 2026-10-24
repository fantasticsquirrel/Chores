import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ActionButton } from "../../../components/ActionButton";
import type { OfflineSceneState } from "@family-manager/discovery-scenes/protocol";
import { NativeSceneSurface } from "./NativeSceneSurface";
import { colors } from "../../../styles/colors";

export function LearningFrame({
  children,
  onReset,
}: {
  children: ReactNode;
  onReset: () => void;
}) {
  return (
    <View style={{ gap: 16 }}>
      {children}
      <ActionButton
        label="Reset experiment"
        variant="secondary"
        onPress={onReset}
      />
    </View>
  );
}

export function Explanation({ children }: { children: ReactNode }) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={{ color: colors.text, lineHeight: 23 }}
    >
      {children}
    </Text>
  );
}

export function ModelNote({ children }: { children: ReactNode }) {
  return (
    <Text style={{ color: colors.textMuted, lineHeight: 22 }}>{children}</Text>
  );
}

export function Diagram({
  label,
  children,
  height = 220,
  visualState,
}: {
  label: string;
  children: ReactNode | ((width: number) => ReactNode);
  height?: number;
  visualState?: OfflineSceneState;
}) {
  const [width, setWidth] = useState(280);
  if (visualState)
    return (
      <NativeSceneSurface
        state={visualState}
        label={label}
        fallback={typeof children === "function" ? children(width) : children}
        onWidthChange={setWidth}
        height={
          visualState.kind === "pattern" && visualState.view === "motif"
            ? height
            : Math.max(320, height)
        }
      />
    );
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{
        height,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#13203b",
        borderWidth: 1,
        borderColor: "#67749a",
      }}
    >
      {typeof children === "function" ? children(width) : children}
    </View>
  );
}

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            focusable
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: option.value === value }}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: 48,
              padding: 12,
              justifyContent: "center",
              borderWidth: 2,
              borderColor:
                option.value === value ? colors.primary : colors.borderStrong,
              borderRadius: 10,
              backgroundColor:
                option.value === value ? colors.primarySoft : colors.surface,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontWeight: option.value === value ? "700" : "400",
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function Meter({
  label,
  value,
  max = 100,
  color = "#217d69",
  detail,
}: {
  label: string;
  value: number;
  max?: number;
  color?: string;
  detail?: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${detail ?? value.toFixed(1)}`}
      style={{ gap: 5 }}
    >
      <Text style={{ color: colors.text }}>
        {label}: {detail ?? value.toFixed(1)}
      </Text>
      <View
        style={{
          height: 14,
          backgroundColor: colors.surfaceSoft,
          borderRadius: 7,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`,
            height: 14,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

export function DiagramLabel({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <Text
      style={{
        position: "absolute",
        left: x,
        top: y,
        color: "#fff9ef",
        fontSize: 13,
      }}
    >
      {children}
    </Text>
  );
}
