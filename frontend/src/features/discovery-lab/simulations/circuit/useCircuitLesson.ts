import { useState } from "react";

export type PathPrediction = "" | "series-off" | "one-off" | "all-off";
export type VoltagePrediction = "" | "quadratic" | "linear" | "unchanged";

export function useCircuitLesson() {
  const [pathPrediction, setPathPrediction] = useState<PathPrediction>("");
  const [voltagePrediction, setVoltagePrediction] =
    useState<VoltagePrediction>("");
  const [pathComplete, setPathComplete] = useState(false);
  const [voltageComplete, setVoltageComplete] = useState(false);

  return {
    pathPrediction,
    voltagePrediction,
    pathComplete,
    voltageComplete,
    freeExploration: pathComplete && voltageComplete,
    choosePath(value: PathPrediction) {
      setPathPrediction(value);
      setPathComplete(false);
    },
    chooseVoltage(value: VoltagePrediction) {
      setVoltagePrediction(value);
      setVoltageComplete(false);
    },
    completePath() {
      if (pathPrediction) setPathComplete(true);
    },
    completeVoltage() {
      if (voltagePrediction) setVoltageComplete(true);
    },
    resetLesson() {
      setPathPrediction("");
      setVoltagePrediction("");
      setPathComplete(false);
      setVoltageComplete(false);
    },
  };
}

export type CircuitLesson = ReturnType<typeof useCircuitLesson>;
