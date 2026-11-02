import { Text, View } from "react-native";
import { colors } from "../../../../styles/colors";
import { Dot, Line } from "../Primitives";

export function FractionPizza({
  numerator,
  denominator,
  label,
}: {
  numerator: number;
  denominator: number;
  label: string;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${label}: ${numerator} of ${denominator} equal pizza pieces selected`}
      style={{
        width: 150,
        height: 150,
        borderRadius: 75,
        overflow: "hidden",
        backgroundColor: "#fff1cf",
        borderWidth: 3,
        borderColor: "#9a5a2c",
      }}
    >
      {Array.from({ length: 7 }, (_, ring) =>
        Array.from({ length: (ring + 1) * 8 }, (_, index) => {
          const angle = (index / ((ring + 1) * 8)) * Math.PI * 2;
          const selected = angle < (numerator / denominator) * Math.PI * 2;
          return (
            <Dot
              key={`${ring}-${index}`}
              x={72 + Math.sin(angle) * (ring * 10 + 5)}
              y={72 - Math.cos(angle) * (ring * 10 + 5)}
              size={10}
              color={selected ? "#eeaa4a" : "#fff1cf"}
            />
          );
        }),
      )}
      {Array.from({ length: denominator }, (_, index) => (
        <Line
          key={index}
          x={72}
          y={72}
          x2={72 + Math.sin((index / denominator) * Math.PI * 2) * 72}
          y2={72 - Math.cos((index / denominator) * Math.PI * 2) * 72}
          color="#8c552d"
        />
      ))}
    </View>
  );
}

export function CommonDenominatorStrip({ selected }: { selected: number }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${selected} of 24 twelfths selected across two equal wholes: 17/12, or 1 whole and 5/12.`}
      style={{ gap: 8 }}
    >
      {[0, 1].map((whole) => (
        <View key={whole} style={{ flexDirection: "row", minHeight: 28 }}>
          {Array.from({ length: 12 }, (_, piece) => {
            const active = whole * 12 + piece < selected;
            return (
              <View
                key={piece}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "#725c37",
                  backgroundColor: active ? "#d49b43" : colors.surface,
                }}
              >
                <Text style={{ color: active ? "#332818" : colors.text }}>
                  {active ? "•" : ""}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
