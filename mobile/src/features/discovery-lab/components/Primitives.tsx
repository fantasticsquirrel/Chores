import { Text, View } from "react-native";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
export function Dot({
  x,
  y,
  size = 10,
  color = "#8fe5ed",
}: {
  x: number;
  y: number;
  size?: number;
  color?: string;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: color,
      }}
    />
  );
}
export function Line({
  x,
  y,
  x2,
  y2,
  color = "#8fe5ed",
}: {
  x: number;
  y: number;
  x2: number;
  y2: number;
  color?: string;
}) {
  const dx = x2 - x,
    dy = y2 - y;
  return (
    <View
      style={{
        position: "absolute",
        left: (x + x2) / 2 - Math.hypot(dx, dy) / 2,
        top: (y + y2) / 2,
        height: 2,
        width: Math.hypot(dx, dy),
        backgroundColor: color,
        transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
      }}
    />
  );
}
export function Control({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.text }}>
        {label}: {Number(value.toFixed(2))}
      </Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <ActionButton
          label={`Decrease ${label}`}
          disabled={value <= min}
          onPress={() =>
            onChange(Math.max(min, Number((value - step).toFixed(2))))
          }
          variant="secondary"
        />
        <ActionButton
          label={`Increase ${label}`}
          disabled={value >= max}
          onPress={() =>
            onChange(Math.min(max, Number((value + step).toFixed(2))))
          }
        />
      </View>
    </View>
  );
}
