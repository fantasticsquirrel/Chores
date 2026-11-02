import { useState } from "react";

export type NativeTransformPrediction = "turn" | "reflection" | "same";
export type NativeCornerPrediction = "exact" | "gap" | "overlap";
export type NativeMotifTransformation =
  | "original"
  | "quarter-turn"
  | "half-turn"
  | "reflection";

export function useNativePatternLesson() {
  const [sides, setSides] = useState("5");
  const [copies, setCopies] = useState(3);
  const [transformation, setTransformation] =
    useState<NativeMotifTransformation>("original");
  const [transformPrediction, setTransformPredictionState] =
    useState<NativeTransformPrediction | null>(null);
  const [cornerPrediction, setCornerPredictionState] =
    useState<NativeCornerPrediction | null>(null);
  const [transformCompared, setTransformCompared] = useState(false);
  const [cornerCompared, setCornerCompared] = useState(false);

  const setTransformPrediction = (value: NativeTransformPrediction) => {
    setTransformPredictionState(value);
    setTransformCompared(false);
    setTransformation("original");
  };
  const setCornerPrediction = (value: NativeCornerPrediction) => {
    setCornerPredictionState(value);
    setCornerCompared(false);
    setSides("5");
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
    setSides("5");
    setCopies(4);
  };
  const reset = () => {
    setSides("5");
    setCopies(3);
    setTransformation("original");
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
