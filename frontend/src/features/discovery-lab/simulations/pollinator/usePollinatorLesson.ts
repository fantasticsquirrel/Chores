import { useState } from "react";
import {
  POLLINATOR_COMPATIBILITY_TRIAL,
  POLLINATOR_FLOWERS,
  POLLINATOR_HABITAT_TRIAL,
  initialPollinator,
  runPollinatorRoute,
  visitFlower,
  type FlowerSpecies,
  type PollinatorRouteInput,
} from "@family-manager/family-api/discovery-models/pollinators";

export type CompatibilityPrediction = "gold" | "violet" | "neither";
export type HabitatPrediction = "without" | "with" | "both";

export function usePollinatorLesson() {
  const [journey, setJourney] = useState(initialPollinator);
  const [reach, setReachState] = useState(170);
  const [habitat, setHabitatState] = useState(false);
  const [trialSpecies, setTrialSpecies] = useState<FlowerSpecies | "none">(
    "none",
  );
  const [compatibilityPrediction, setCompatibilityPredictionState] =
    useState<CompatibilityPrediction | null>(null);
  const [habitatPrediction, setHabitatPredictionState] =
    useState<HabitatPrediction | null>(null);
  const [compatibilityCompared, setCompatibilityCompared] = useState(false);
  const [habitatCompared, setHabitatCompared] = useState(false);
  const showRoute = (input: PollinatorRouteInput) => {
    setReachState(input.reach);
    setHabitatState(input.habitat);
    setTrialSpecies(input.trialSpecies ?? "none");
    setJourney(runPollinatorRoute(input)!.state);
  };
  const setCompatibilityPrediction = (value: CompatibilityPrediction) => {
    setCompatibilityPredictionState(value);
    setCompatibilityCompared(false);
    showRoute(POLLINATOR_COMPATIBILITY_TRIAL.baseline);
  };
  const setHabitatPrediction = (value: HabitatPrediction) => {
    setHabitatPredictionState(value);
    setHabitatCompared(false);
    showRoute(POLLINATOR_HABITAT_TRIAL.baseline);
  };
  const compareCompatibility = () => {
    if (!compatibilityPrediction) return;
    setCompatibilityCompared(true);
    showRoute(POLLINATOR_COMPATIBILITY_TRIAL.comparison);
  };
  const compareHabitat = () => {
    if (!habitatPrediction) return;
    setHabitatCompared(true);
    showRoute(POLLINATOR_HABITAT_TRIAL.comparison);
  };
  const reset = () => {
    setJourney(initialPollinator());
    setReachState(170);
    setHabitatState(false);
    setTrialSpecies("none");
    setCompatibilityPredictionState(null);
    setHabitatPredictionState(null);
    setCompatibilityCompared(false);
    setHabitatCompared(false);
  };
  const returnToNest = () => {
    setJourney(initialPollinator());
    setTrialSpecies("none");
  };
  const setReach = (value: number) => {
    setReachState(value);
    returnToNest();
  };
  const setHabitat = (value: boolean) => {
    setHabitatState(value);
    returnToNest();
  };
  const visit = (id: string) =>
    setJourney((state) => visitFlower(state, id, reach, habitat));
  return {
    journey,
    reach,
    habitat,
    trialSpecies,
    compatibilityPrediction,
    habitatPrediction,
    compatibilityCompared,
    habitatCompared,
    explorationUnlocked: compatibilityCompared && habitatCompared,
    availableFlowers: POLLINATOR_FLOWERS.filter(
      (flower) => habitat || !("bridge" in flower && flower.bridge),
    ),
    setCompatibilityPrediction,
    setHabitatPrediction,
    compareCompatibility,
    compareHabitat,
    showCompatibilityBaseline: () =>
      showRoute(POLLINATOR_COMPATIBILITY_TRIAL.baseline),
    showCompatibilityComparison: () =>
      showRoute(POLLINATOR_COMPATIBILITY_TRIAL.comparison),
    showHabitatBaseline: () => showRoute(POLLINATOR_HABITAT_TRIAL.baseline),
    showHabitatComparison: () => showRoute(POLLINATOR_HABITAT_TRIAL.comparison),
    setReach,
    setHabitat,
    returnToNest,
    visit,
    reset,
  };
}
export type PollinatorLesson = ReturnType<typeof usePollinatorLesson>;
