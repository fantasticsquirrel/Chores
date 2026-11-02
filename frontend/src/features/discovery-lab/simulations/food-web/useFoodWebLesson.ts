import { useState } from "react";

export type PredatorPrediction = "" | "cascade" | "algae-up" | "unchanged";
export type NutrientPrediction = "" | "fish-lower" | "all-higher" | "same";

export function useFoodWebLesson() {
  const [predatorPrediction, setPredatorPrediction] =
    useState<PredatorPrediction>("");
  const [nutrientPrediction, setNutrientPrediction] =
    useState<NutrientPrediction>("");
  const [predatorComplete, setPredatorComplete] = useState(false);
  const [nutrientComplete, setNutrientComplete] = useState(false);

  return {
    predatorPrediction,
    nutrientPrediction,
    predatorComplete,
    nutrientComplete,
    freeExploration: predatorComplete && nutrientComplete,
    choosePredator(value: PredatorPrediction) {
      setPredatorPrediction(value);
      setPredatorComplete(false);
    },
    chooseNutrient(value: NutrientPrediction) {
      setNutrientPrediction(value);
      setNutrientComplete(false);
    },
    completePredator() {
      if (predatorPrediction) setPredatorComplete(true);
    },
    completeNutrient() {
      if (nutrientPrediction) setNutrientComplete(true);
    },
    resetLesson() {
      setPredatorPrediction("");
      setNutrientPrediction("");
      setPredatorComplete(false);
      setNutrientComplete(false);
    },
  };
}

export type FoodWebLesson = ReturnType<typeof useFoodWebLesson>;
