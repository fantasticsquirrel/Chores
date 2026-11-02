import { useState } from "react";

export type LengthPrediction = "half" | "same" | "double";
export type AmplitudePrediction = "same" | "double" | "quadruple";

export function useSoundLesson() {
  const [lengthPrediction, setLengthPrediction] =
    useState<LengthPrediction | null>(null);
  const [amplitudePrediction, setAmplitudePrediction] =
    useState<AmplitudePrediction | null>(null);
  const [lengthComplete, setLengthComplete] = useState(false);
  const [amplitudeComplete, setAmplitudeComplete] = useState(false);

  return {
    lengthPrediction,
    amplitudePrediction,
    lengthComplete,
    amplitudeComplete,
    freeExploration: lengthComplete && amplitudeComplete,
    chooseLength(value: LengthPrediction) {
      setLengthPrediction(value);
      setLengthComplete(false);
    },
    chooseAmplitude(value: AmplitudePrediction) {
      setAmplitudePrediction(value);
      setAmplitudeComplete(false);
    },
    completeLength() {
      setLengthComplete(true);
    },
    completeAmplitude() {
      setAmplitudeComplete(true);
    },
    resetLesson() {
      setLengthPrediction(null);
      setAmplitudePrediction(null);
      setLengthComplete(false);
      setAmplitudeComplete(false);
    },
  };
}

export type SoundLesson = ReturnType<typeof useSoundLesson>;
