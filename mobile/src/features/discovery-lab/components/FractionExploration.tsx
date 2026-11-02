import { useState } from "react";
import { Text, View } from "react-native";
import {
  FRACTION_ADDITION_TRIAL,
  FRACTION_EQUIVALENCE_TRIAL,
  addFractionParts,
  normalizeFraction,
} from "@family-manager/family-api/discovery-models/fractions";
import { ActionButton } from "../../../components/ActionButton";
import { Control } from "./Primitives";
import {
  Choice,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";
import { NativeSceneSurface } from "./NativeSceneSurface";
import {
  CommonDenominatorStrip,
  FractionPizza,
} from "./fraction/FractionVisuals";

type Plate = { n: number; d: number };
type EquivalentPrediction = "" | "more" | "same" | "less";
type AdditionPrediction = "" | "below" | "one" | "above";

const initialPlates = (): [Plate, Plate] => [
  { n: 1, d: 2 },
  { n: 2, d: 4 },
];

export function FractionExploration() {
  const [plates, setPlates] = useState<[Plate, Plate]>(initialPlates);
  const [equivalentPrediction, setEquivalentPrediction] =
    useState<EquivalentPrediction>("");
  const [additionPrediction, setAdditionPrediction] =
    useState<AdditionPrediction>("");
  const [equivalentComplete, setEquivalentComplete] = useState(false);
  const [additionComplete, setAdditionComplete] = useState(false);
  const [combined, setCombined] = useState(false);
  const [active, setActive] = useState(0);
  const freeExploration = equivalentComplete && additionComplete;
  const [first, second] = plates;
  const addition = addFractionParts(first.n, first.d, second.n, second.d)!;

  const showEquivalentBefore = () => {
    setPlates(initialPlates());
    setCombined(false);
    setActive(0);
  };
  const showAdditionParts = () => {
    setPlates([
      {
        n: FRACTION_ADDITION_TRIAL.left.numerator,
        d: FRACTION_ADDITION_TRIAL.left.denominator,
      },
      {
        n: FRACTION_ADDITION_TRIAL.right.numerator,
        d: FRACTION_ADDITION_TRIAL.right.denominator,
      },
    ]);
    setCombined(false);
    setActive(0);
  };
  const reset = () => {
    setPlates(initialPlates());
    setEquivalentPrediction("");
    setAdditionPrediction("");
    setEquivalentComplete(false);
    setAdditionComplete(false);
    setCombined(false);
    setActive(0);
  };
  const setPlate = (index: number, plate: Plate) =>
    setPlates(
      (current) =>
        current.map((value, plateIndex) =>
          plateIndex === index ? plate : value,
        ) as [Plate, Plate],
    );

  return (
    <LearningFrame onReset={reset} resetLabel="Reset lesson">
      <NativeSceneSurface
        state={{
          kind: "pizza",
          plates: plates.map((plate) => ({
            ...plate,
            slices: Array.from({ length: plate.n }, (_, index) => index),
          })),
          active,
        }}
        label={`Two equal-area pizzas. Plate A has ${first.n} of ${first.d} equal pieces selected. Plate B has ${second.n} of ${second.d}. ${combined ? `Their exact total is ${addition.commonSumNumerator}/${addition.commonDenominator}.` : "The unselected spaces keep each whole visible."}`}
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
            <FractionPizza
              label="Plate A"
              numerator={first.n}
              denominator={first.d}
            />
            <FractionPizza
              label="Plate B"
              numerator={second.n}
              denominator={second.d}
            />
          </View>
        }
      />

      <Text accessibilityRole="header">1. Split the same amount</Text>
      <Explanation>
        Plate A starts at 1/2. Split every piece in two while holding the whole
        area and selected area fixed. What changes?
      </Explanation>
      <Choice
        label="Your split prediction"
        value={equivalentPrediction}
        onChange={(value) => {
          setEquivalentPrediction(value);
          setEquivalentComplete(false);
          showEquivalentBefore();
        }}
        options={[
          { value: "more", label: "More pizza" },
          { value: "same", label: "The same amount" },
          { value: "less", label: "Less pizza" },
        ]}
      />
      <ActionButton
        label="Compare 1/2 with 2/4"
        disabled={!equivalentPrediction || equivalentComplete}
        onPress={() => {
          setEquivalentComplete(true);
          setPlates([
            { n: 2, d: 4 },
            { n: 2, d: 4 },
          ]);
          setCombined(false);
        }}
      />
      {equivalentComplete && (
        <Explanation>
          The evidence{" "}
          {equivalentPrediction === "same" ? "matches" : "differs from"} your
          prediction. 1/2 = 2/4: both cover half of an equal-area whole.
          Changed: {FRACTION_EQUIVALENCE_TRIAL.changed.join(" · ")}. Held:{" "}
          {FRACTION_EQUIVALENCE_TRIAL.held.join(" · ")}. Twice as many selected
          pieces are each half as large, so the amount stays fixed.
        </Explanation>
      )}

      <Text accessibilityRole="header">2. Add unlike fractions</Text>
      <Explanation>
        Join 2/3 and 3/4 from equal-area wholes. Predict whether the exact total
        fits in one whole.
      </Explanation>
      <Choice
        label="Your addition prediction"
        value={additionPrediction}
        onChange={(value) => {
          setAdditionPrediction(value);
          setAdditionComplete(false);
          showAdditionParts();
        }}
        options={[
          { value: "below", label: "Less than one whole" },
          { value: "one", label: "Exactly one whole" },
          { value: "above", label: "More than one whole" },
        ]}
      />
      <ActionButton
        label="Combine 2/3 and 3/4"
        disabled={!additionPrediction || additionComplete}
        onPress={() => {
          setAdditionComplete(true);
          setCombined(true);
        }}
      />
      {additionComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {additionPrediction === "above" ? "matches" : "differs from"} your
            prediction. 2/3 = 8/12 and 3/4 = 9/12. 8/12 + 9/12 = 17/12 = 1 whole
            and 5/12. Twelfths are the shared unit; adding the denominators
            would change that unit.
          </Explanation>
          <CommonDenominatorStrip selected={17} />
        </>
      )}

      {freeExploration && (
        <>
          <Text accessibilityRole="header">Explore fractions</Text>
          <Explanation>
            Keep the whole areas equal. Change one plate, then compare its exact
            amount before changing another variable.
          </Explanation>
          <ActionButton
            label={active === 0 ? "Use Plate B" : "Use Plate A"}
            variant="secondary"
            onPress={() => {
              setActive(active === 0 ? 1 : 0);
              setCombined(false);
            }}
          />
          <Control
            label="Equal slices"
            value={plates[active].d}
            min={2}
            max={24}
            step={1}
            onChange={(d) => {
              setPlate(active, { n: Math.min(plates[active].n, d), d });
              setCombined(false);
            }}
          />
          <Control
            label="Selected slices"
            value={plates[active].n}
            min={0}
            max={plates[active].d}
            onChange={(n) => {
              setPlate(active, { ...plates[active], n });
              setCombined(false);
            }}
          />
          <ActionButton
            label="Split every active-plate slice in half"
            disabled={plates[active].d > 12}
            onPress={() => {
              setPlate(active, {
                n: plates[active].n * 2,
                d: plates[active].d * 2,
              });
              setCombined(false);
            }}
          />
          <ActionButton
            label={combined ? "Separate portions" : "Combine portions"}
            variant="secondary"
            onPress={() => setCombined((value) => !value)}
          />
          <Explanation>
            Plate A: {first.n}/{first.d} ={" "}
            {normalizeFraction(first.n, first.d)!.numerator}/
            {normalizeFraction(first.n, first.d)!.denominator}. Plate B:{" "}
            {second.n}/{second.d} ={" "}
            {normalizeFraction(second.n, second.d)!.numerator}/
            {normalizeFraction(second.n, second.d)!.denominator}. Exact total:{" "}
            {addition.commonSumNumerator}/{addition.commonDenominator}.
          </Explanation>
        </>
      )}

      <ModelNote>
        Model boundary: both pizzas represent the same whole area, divided into
        equal-area pieces. Pizza textures, toppings, plate depth, and lighting
        do not affect the exact arithmetic. Native controls use a simpler
        platform layout; the offline scene retains the dimensional tabletop.
      </ModelNote>
    </LearningFrame>
  );
}
