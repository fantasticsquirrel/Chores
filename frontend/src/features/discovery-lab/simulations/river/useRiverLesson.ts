import { useState } from "react";

export type VegetationPrediction = "both" | "runoff-only" | "neither";
export type SlopePrediction = "both" | "soil-only" | "neither";

export function useRiverLesson() {
  const [vegetationPrediction, setVegetationPrediction] =
    useState<VegetationPrediction | null>(null);
  const [slopePrediction, setSlopePrediction] =
    useState<SlopePrediction | null>(null);
  const [vegetationComplete, setVegetationComplete] = useState(false);
  const [slopeComplete, setSlopeComplete] = useState(false);

  return {
    vegetationPrediction,
    slopePrediction,
    vegetationComplete,
    slopeComplete,
    freeExploration: vegetationComplete && slopeComplete,
    chooseVegetation(value: VegetationPrediction) {
      setVegetationPrediction(value);
      setVegetationComplete(false);
    },
    chooseSlope(value: SlopePrediction) {
      setSlopePrediction(value);
      setSlopeComplete(false);
    },
    completeVegetation() {
      setVegetationComplete(true);
    },
    completeSlope() {
      setSlopeComplete(true);
    },
    resetLesson() {
      setVegetationPrediction(null);
      setSlopePrediction(null);
      setVegetationComplete(false);
      setSlopeComplete(false);
    },
  };
}

export type RiverLesson = ReturnType<typeof useRiverLesson>;
