import { useState } from "react";
import {
  CARAVAN_ROUTE_TRIAL,
  CARAVAN_SEASON_TRIAL,
  calculateCaravanJourney,
  type CaravanCargo,
  type CaravanJourneyInput,
  type CaravanRoute,
  type CaravanSeason,
} from "@family-manager/family-api/discovery-models/caravans";

export type NativeSeasonPrediction = "more" | "same" | "fewer";
export type NativeRoutePrediction = "mountain" | "oasis" | "same";

export function useNativeCaravanLesson() {
  const [plan, setPlan] = useState<CaravanJourneyInput>(
    CARAVAN_SEASON_TRIAL.baseline,
  );
  const [seasonPrediction, setSeasonPredictionState] =
    useState<NativeSeasonPrediction | null>(null);
  const [routePrediction, setRoutePredictionState] =
    useState<NativeRoutePrediction | null>(null);
  const [seasonCompared, setSeasonCompared] = useState(false);
  const [routeCompared, setRouteCompared] = useState(false);

  const updatePlan = (change: Partial<CaravanJourneyInput>) =>
    setPlan((current) => ({ ...current, ...change }));
  const setSeasonPrediction = (value: NativeSeasonPrediction) => {
    setSeasonPredictionState(value);
    setSeasonCompared(false);
    setPlan(CARAVAN_SEASON_TRIAL.baseline);
  };
  const setRoutePrediction = (value: NativeRoutePrediction) => {
    setRoutePredictionState(value);
    setRouteCompared(false);
    setPlan(CARAVAN_ROUTE_TRIAL.baseline);
  };
  const compareSeasons = () => {
    if (!seasonPrediction) return;
    setSeasonCompared(true);
    setPlan(CARAVAN_SEASON_TRIAL.comparison);
  };
  const compareRoutes = () => {
    if (!routePrediction) return;
    setRouteCompared(true);
    setPlan(CARAVAN_ROUTE_TRIAL.comparison);
  };
  const reset = () => {
    setPlan(CARAVAN_SEASON_TRIAL.baseline);
    setSeasonPredictionState(null);
    setRoutePredictionState(null);
    setSeasonCompared(false);
    setRouteCompared(false);
  };
  const packExactDays = () => {
    const result = calculateCaravanJourney(plan);
    if (result) updatePlan({ supplyDays: result.days });
  };

  return {
    plan,
    seasonPrediction,
    routePrediction,
    seasonCompared,
    routeCompared,
    explorationUnlocked: seasonCompared && routeCompared,
    setSeasonPrediction,
    setRoutePrediction,
    compareSeasons,
    compareRoutes,
    showSeasonBaseline: () => setPlan(CARAVAN_SEASON_TRIAL.baseline),
    showSeasonComparison: () => setPlan(CARAVAN_SEASON_TRIAL.comparison),
    showRouteBaseline: () => setPlan(CARAVAN_ROUTE_TRIAL.baseline),
    showRouteComparison: () => setPlan(CARAVAN_ROUTE_TRIAL.comparison),
    setRoute: (route: CaravanRoute) => updatePlan({ route }),
    setSeason: (season: CaravanSeason) => updatePlan({ season }),
    setCargo: (cargo: CaravanCargo) => updatePlan({ cargo }),
    setUnits: (units: number) => updatePlan({ units }),
    setSupplyDays: (supplyDays: number) => updatePlan({ supplyDays }),
    packExactDays,
    reset,
  };
}
