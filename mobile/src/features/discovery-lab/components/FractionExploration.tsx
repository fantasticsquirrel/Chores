import { NativeSceneSurface } from "./NativeSceneSurface";
import { useState } from "react";
import { View } from "react-native";
import { ActionButton } from "../../../components/ActionButton";
import {
  addFractions,
  simplifyFraction,
} from "@family-manager/family-api/discovery-models/math-life";
import { Control, Dot, Line } from "./Primitives";
import { Explanation, LearningFrame, ModelNote } from "./LearningPrimitives";

function Pizza({
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
      accessibilityLabel={`${label}: ${numerator} of ${denominator} equal pizza slices selected`}
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
        Array.from({ length: (ring + 1) * 8 }, (_, i) => {
          const angle = (i / ((ring + 1) * 8)) * Math.PI * 2;
          const selected = angle < (numerator / denominator) * Math.PI * 2;
          return (
            <Dot
              key={`${ring}-${i}`}
              x={72 + Math.sin(angle) * (ring * 10 + 5)}
              y={72 - Math.cos(angle) * (ring * 10 + 5)}
              size={10}
              color={selected ? "#eeaa4a" : "#fff1cf"}
            />
          );
        }),
      )}
      {Array.from({ length: denominator }, (_, i) => (
        <Line
          key={i}
          x={72}
          y={72}
          x2={72 + Math.sin((i / denominator) * Math.PI * 2) * 72}
          y2={72 - Math.cos((i / denominator) * Math.PI * 2) * 72}
          color="#8c552d"
        />
      ))}
    </View>
  );
}

export function FractionExploration() {
  const [slices, setSlices] = useState(4);
  const [selected, setSelected] = useState(2);
  const [otherSlices, setOtherSlices] = useState(8);
  const [otherSelected, setOtherSelected] = useState(4);
  const first = simplifyFraction(selected, slices),
    second = simplifyFraction(otherSelected, otherSlices);
  const sum = addFractions(selected, slices, otherSelected, otherSlices);
  const equivalent = selected * otherSlices === otherSelected * slices;
  return (
    <LearningFrame
      onReset={() => {
        setSlices(4);
        setSelected(2);
        setOtherSlices(8);
        setOtherSelected(4);
      }}
    >
      <NativeSceneSurface
        state={{
          kind: "pizza",
          plates: [
            {
              n: selected,
              d: slices,
              slices: Array.from({ length: selected }, (_, i) => i),
            },
            {
              n: otherSelected,
              d: otherSlices,
              slices: Array.from({ length: otherSelected }, (_, i) => i),
            },
          ],
          active: 0,
        }}
        label={`Two equal-sized pizzas. First ${selected}/${slices}; second ${otherSelected}/${otherSlices}.`}
        height={420}
        fallback={
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
            }}
          >
            <Pizza
              label="First pizza"
              numerator={selected}
              denominator={slices}
            />
            <Pizza
              label="Second pizza"
              numerator={otherSelected}
              denominator={otherSlices}
            />
          </View>
        }
      />
      <Explanation>
        First share: {selected}/{slices} = {first.numerator}/{first.denominator}
        . Second share: {otherSelected}/{otherSlices} = {second.numerator}/
        {second.denominator}.{" "}
        {equivalent
          ? "The shares are equal, even if the slices are different sizes."
          : "The shares are different fractions of the same-sized whole."}
      </Explanation>
      <Control
        label="Equal slices"
        value={slices}
        min={2}
        max={24}
        onChange={(value) => {
          setSlices(value);
          setSelected(Math.min(selected, value));
        }}
      />
      <ActionButton
        label="Split every first-pizza slice in half"
        disabled={slices > 12}
        onPress={() => {
          setSlices(slices * 2);
          setSelected(selected * 2);
        }}
      />
      <Control
        label="First selected slices"
        value={selected}
        min={0}
        max={slices}
        onChange={setSelected}
      />
      <Control
        label="Second equal slices"
        value={otherSlices}
        min={2}
        max={12}
        onChange={(value) => {
          setOtherSlices(value);
          setOtherSelected(Math.min(otherSelected, value));
        }}
      />
      <Control
        label="Second selected slices"
        value={otherSelected}
        min={0}
        max={otherSlices}
        onChange={setOtherSelected}
      />
      <Explanation>
        Put the selected portions together: {selected}/{slices} +{" "}
        {otherSelected}/{otherSlices} = {sum.numerator}/{sum.denominator}{" "}
        pizzas.{" "}
        {sum.numerator > sum.denominator
          ? "The combined amount is greater than one whole pizza."
          : sum.numerator === sum.denominator
            ? "The combined amount is exactly one whole pizza."
            : "The combined amount is less than one whole pizza."}
      </Explanation>
      <ModelNote>
        Both pizzas represent equal-sized wholes. A denominator counts equal
        pieces, not the size of the food. Adding fractions requires common-sized
        pieces; adding the denominators would change their size.
      </ModelNote>
    </LearningFrame>
  );
}
