import { useState } from "react";

export type EquivalentPrediction = "" | "more" | "same" | "less";
export type AdditionPrediction = "" | "below" | "one" | "above";

export function useFractionLesson() {
  const [equivalentPrediction, setEquivalentPrediction] =
    useState<EquivalentPrediction>("");
  const [additionPrediction, setAdditionPrediction] =
    useState<AdditionPrediction>("");
  const [equivalentComplete, setEquivalentComplete] = useState(false);
  const [additionComplete, setAdditionComplete] = useState(false);

  return {
    equivalentPrediction,
    additionPrediction,
    equivalentComplete,
    additionComplete,
    freeExploration: equivalentComplete && additionComplete,
    chooseEquivalent(value: EquivalentPrediction) {
      setEquivalentPrediction(value);
      setEquivalentComplete(false);
    },
    chooseAddition(value: AdditionPrediction) {
      setAdditionPrediction(value);
      setAdditionComplete(false);
    },
    completeEquivalent() {
      if (equivalentPrediction) setEquivalentComplete(true);
    },
    completeAddition() {
      if (additionPrediction) setAdditionComplete(true);
    },
    resetLesson() {
      setEquivalentPrediction("");
      setAdditionPrediction("");
      setEquivalentComplete(false);
      setAdditionComplete(false);
    },
  };
}

export type FractionLesson = ReturnType<typeof useFractionLesson>;
