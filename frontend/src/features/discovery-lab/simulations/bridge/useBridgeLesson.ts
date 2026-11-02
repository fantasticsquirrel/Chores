import { useState } from "react";

export type PositionPrediction = "left" | "right" | "equal";
export type LoadPrediction = "both-double" | "moment-only" | "quadruple";

export function useBridgeLesson() {
  const [positionPrediction, setPositionPrediction] =
    useState<PositionPrediction | null>(null);
  const [loadPrediction, setLoadPrediction] = useState<LoadPrediction | null>(
    null,
  );
  const [positionComplete, setPositionComplete] = useState(false);
  const [loadComplete, setLoadComplete] = useState(false);

  return {
    positionPrediction,
    loadPrediction,
    positionComplete,
    loadComplete,
    freeExploration: positionComplete && loadComplete,
    choosePosition(value: PositionPrediction) {
      setPositionPrediction(value);
      setPositionComplete(false);
    },
    chooseLoad(value: LoadPrediction) {
      setLoadPrediction(value);
      setLoadComplete(false);
    },
    completePosition() {
      setPositionComplete(true);
    },
    completeLoad() {
      setLoadComplete(true);
    },
    resetLesson() {
      setPositionPrediction(null);
      setLoadPrediction(null);
      setPositionComplete(false);
      setLoadComplete(false);
    },
  };
}

export type BridgeLesson = ReturnType<typeof useBridgeLesson>;
