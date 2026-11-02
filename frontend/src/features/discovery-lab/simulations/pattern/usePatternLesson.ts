import { useState } from "react";

export type TransformPrediction = "turn" | "reflection" | "same";
export type CornerPrediction = "exact" | "gap" | "overlap";
export type MotifTransformation =
  | "original"
  | "quarter-turn"
  | "half-turn"
  | "reflection";

const initialState = {
  sides: 5,
  copies: 3,
  transformation: "original" as MotifTransformation,
};

export function usePatternLesson() {
  const [sides, setSides] = useState(initialState.sides);
  const [copies, setCopies] = useState(initialState.copies);
  const [transformation, setTransformation] = useState<MotifTransformation>(
    initialState.transformation,
  );
  const [transformPrediction, setTransformPredictionState] =
    useState<TransformPrediction | null>(null);
  const [cornerPrediction, setCornerPredictionState] =
    useState<CornerPrediction | null>(null);
  const [transformCompared, setTransformCompared] = useState(false);
  const [cornerCompared, setCornerCompared] = useState(false);

  const setTransformPrediction = (prediction: TransformPrediction) => {
    setTransformPredictionState(prediction);
    setTransformCompared(false);
    setTransformation("original");
  };
  const setCornerPrediction = (prediction: CornerPrediction) => {
    setCornerPredictionState(prediction);
    setCornerCompared(false);
    setSides(5);
    setCopies(3);
  };
  const compareTransformations = () => {
    if (!transformPrediction) return;
    setTransformCompared(true);
    setTransformation("quarter-turn");
  };
  const compareCorners = () => {
    if (!cornerPrediction) return;
    setCornerCompared(true);
    setSides(5);
    setCopies(4);
  };
  const reset = () => {
    setSides(initialState.sides);
    setCopies(initialState.copies);
    setTransformation(initialState.transformation);
    setTransformPredictionState(null);
    setCornerPredictionState(null);
    setTransformCompared(false);
    setCornerCompared(false);
  };

  return {
    sides,
    copies,
    transformation,
    transformPrediction,
    cornerPrediction,
    transformCompared,
    cornerCompared,
    explorationUnlocked: transformCompared && cornerCompared,
    setSides,
    setCopies,
    setTransformation,
    setTransformPrediction,
    setCornerPrediction,
    compareTransformations,
    compareCorners,
    reset,
  };
}
