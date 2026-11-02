import { landscapeScene, serializeLandscape } from "../shared/landscape-scene";
import { buildCaravan } from "./caravan";
import {
  CARAVAN_CARGO,
  CARAVAN_ROUTES,
  CARAVAN_ROUTE_TRIAL,
  CARAVAN_SEASON_TRIAL,
  calculateCaravanJourney,
  compareCaravanPlans,
  type CaravanCargo,
  type CaravanJourneyInput,
  type CaravanRoute,
  type CaravanSeason,
} from "./caravans";

type SeasonPrediction = "more" | "same" | "fewer" | "";
type RoutePrediction = "mountain" | "oasis" | "same" | "";

let plan: CaravanJourneyInput = { ...CARAVAN_SEASON_TRIAL.baseline };
let seasonPrediction: SeasonPrediction = "";
let routePrediction: RoutePrediction = "";
let seasonCompared = false;
let routeCompared = false;

const seasonEvidence = compareCaravanPlans(
  CARAVAN_SEASON_TRIAL.baseline,
  CARAVAN_SEASON_TRIAL.comparison,
)!;
const routeEvidence = compareCaravanPlans(
  CARAVAN_ROUTE_TRIAL.baseline,
  CARAVAN_ROUTE_TRIAL.comparison,
)!;
const credits = (value: number) =>
  `${value < 0 ? "−" : ""}${Math.abs(value)} teaching credits`;

function reset() {
  plan = { ...CARAVAN_SEASON_TRIAL.baseline };
  seasonPrediction = "";
  routePrediction = "";
  seasonCompared = false;
  routeCompared = false;
}

function setPlan(next: CaravanJourneyInput) {
  plan = { ...next };
}

function run(input: any) {
  if (input.type === "reset") reset();
  const key = input.control;
  const value = input.values?.[key];
  const unlocked = seasonCompared && routeCompared;

  if (key === "seasonMore" || key === "seasonSame" || key === "seasonFewer") {
    seasonPrediction =
      key === "seasonMore" ? "more" : key === "seasonSame" ? "same" : "fewer";
    seasonCompared = false;
    setPlan(CARAVAN_SEASON_TRIAL.baseline);
  }
  if (key === "compareSeasons" && seasonPrediction) {
    seasonCompared = true;
    setPlan(CARAVAN_SEASON_TRIAL.comparison);
  }
  if (key === "showWet" && seasonCompared)
    setPlan(CARAVAN_SEASON_TRIAL.baseline);
  if (key === "showDry" && seasonCompared)
    setPlan(CARAVAN_SEASON_TRIAL.comparison);

  if (key === "routeMountain" || key === "routeOasis" || key === "routeSame") {
    routePrediction =
      key === "routeMountain"
        ? "mountain"
        : key === "routeOasis"
          ? "oasis"
          : "same";
    routeCompared = false;
    setPlan(CARAVAN_ROUTE_TRIAL.baseline);
  }
  if (key === "compareRoutes" && routePrediction) {
    routeCompared = true;
    setPlan(CARAVAN_ROUTE_TRIAL.comparison);
  }
  if (key === "showMountain" && routeCompared)
    setPlan(CARAVAN_ROUTE_TRIAL.baseline);
  if (key === "showOasis" && routeCompared)
    setPlan(CARAVAN_ROUTE_TRIAL.comparison);

  if (input.type === "control" && unlocked && Number.isFinite(value)) {
    if (key === "route") {
      const routes: CaravanRoute[] = ["ridge", "river", "oasis"];
      plan = {
        ...plan,
        route: routes[Math.max(0, Math.min(2, Math.round(value)))],
      };
    }
    if (key === "season") {
      const seasons: CaravanSeason[] = ["wet", "dry"];
      plan = {
        ...plan,
        season: seasons[Math.max(0, Math.min(1, Math.round(value)))],
      };
    }
    if (key === "cargo") {
      const cargo: CaravanCargo[] = ["grain", "cloth", "pottery"];
      plan = {
        ...plan,
        cargo: cargo[Math.max(0, Math.min(2, Math.round(value)))],
      };
    }
    if (key === "units")
      plan = { ...plan, units: Math.max(1, Math.min(15, Math.round(value))) };
    if (key === "supplyDays")
      plan = {
        ...plan,
        supplyDays: Math.max(0, Math.min(20, Math.round(value))),
      };
  }
  if (key === "packExact" && unlocked) {
    const current = calculateCaravanJourney(plan)!;
    plan = { ...plan, supplyDays: current.days };
  }

  const nowUnlocked = seasonCompared && routeCompared;
  const result = calculateCaravanJourney(plan)!;
  const built = buildCaravan({
    kind: "caravan",
    route: plan.route,
    season: plan.season,
    cargo: plan.cargo,
    units: plan.units,
    supplies: plan.supplyDays,
    days: result.days,
    load: result.load,
  });
  const scene = landscapeScene(built, "caravan");
  const scene3d = serializeLandscape(scene, {
    title: "Caravan Crossroads",
    subtitle: "Compare one invented route rule at a time",
    background: ["#ece9d8", "#dfe6ce", "#c3d0b5"],
  });
  scene.dispose();

  const seasonFeedback = seasonCompared
    ? `${seasonPrediction === "more" ? "The evidence matches your prediction." : "The evidence differs from your prediction."} Wet: ${seasonEvidence.baseline.days} days · ${seasonEvidence.baseline.delivered} of 6 delivered · ${seasonEvidence.baseline.load} / 100 kg · ${credits(seasonEvidence.baseline.margin)}. Dry: ${seasonEvidence.comparison.days} days · ${seasonEvidence.comparison.delivered} of 6 delivered · ${seasonEvidence.comparison.load} / 100 kg · ${credits(seasonEvidence.comparison.margin)}. Changed: season. Held: River Road, 6 grain units, 14 supply days, the 100 kg limit and all price and loss rules. The invented dry rule adds 6 days and crosses the invented grain-spoilage threshold.`
    : "River Road, 6 grain units and 14 packed supply days stay fixed. Predict whether changing only wet season to dry creates more, the same or fewer travel days.";
  const routeFeedback = routeCompared
    ? `${routePrediction === "oasis" ? "The evidence matches your prediction." : "The evidence differs from your prediction."} Mountain: ${routeEvidence.baseline.days} days · ${routeEvidence.baseline.delivered} of 6 delivered · ${routeEvidence.baseline.load} / 100 kg · toll ${routeEvidence.baseline.toll} · margin ${credits(routeEvidence.baseline.margin)}. Oasis: ${routeEvidence.comparison.days} days · ${routeEvidence.comparison.delivered} of 6 delivered · ${routeEvidence.comparison.load} / 100 kg · toll ${routeEvidence.comparison.toll} · margin ${credits(routeEvidence.comparison.margin)}. Changed: route. Held: dry season, 6 pottery units, 12 supply days, the 100 kg limit and all price and loss rules. In this model, the longer Oasis Trail avoids the invented mountain breakage and has the lower toll.`
    : "Dry season, 6 pottery units and 12 packed supply days stay fixed. Predict whether Mountain Pass, Oasis Trail or neither delivers more pottery and keeps the larger margin.";

  return {
    animate: false,
    shapes: [],
    scene3d,
    description:
      !seasonPrediction && !routePrediction
        ? "Choose a prediction to begin. Compare one changed variable while every named cargo, packing, capacity, price and loss rule stays fixed."
        : `${CARAVAN_ROUTES[plan.route].name}, ${plan.season} season: ${result.days} days · ${result.delivered} of ${plan.units} delivered · ${result.load} / 100 kg · margin ${credits(result.margin)}.`,
    controls: nowUnlocked
      ? [
          {
            id: "route",
            label: "Route",
            kind: "select",
            min: 0,
            max: 2,
            step: 1,
            value: ["ridge", "river", "oasis"].indexOf(plan.route),
            options: (["ridge", "river", "oasis"] as CaravanRoute[]).map(
              (route, optionValue) => ({
                value: optionValue,
                label: CARAVAN_ROUTES[route].name,
              }),
            ),
          },
          {
            id: "season",
            label: "Season",
            kind: "select",
            min: 0,
            max: 1,
            step: 1,
            value: plan.season === "wet" ? 0 : 1,
            options: [
              { value: 0, label: "Wet season" },
              { value: 1, label: "Dry season" },
            ],
          },
          {
            id: "cargo",
            label: "Cargo",
            kind: "select",
            min: 0,
            max: 2,
            step: 1,
            value: ["grain", "cloth", "pottery"].indexOf(plan.cargo),
            options: (["grain", "cloth", "pottery"] as CaravanCargo[]).map(
              (cargo, optionValue) => ({
                value: optionValue,
                label: CARAVAN_CARGO[cargo].name,
              }),
            ),
          },
          {
            id: "units",
            label: "Cargo units",
            min: 1,
            max: 15,
            step: 1,
            value: plan.units,
          },
          {
            id: "supplyDays",
            label: "Supply days",
            min: 0,
            max: 20,
            step: 1,
            value: plan.supplyDays,
          },
        ]
      : [],
    buttons: [
      {
        id: "seasonMore",
        label: "More travel days",
        pressed: seasonPrediction === "more",
      },
      {
        id: "seasonSame",
        label: "Same travel time",
        pressed: seasonPrediction === "same",
      },
      {
        id: "seasonFewer",
        label: "Fewer travel days",
        pressed: seasonPrediction === "fewer",
      },
      {
        id: "compareSeasons",
        label: "Compare wet and dry river plans",
        disabled: !seasonPrediction,
      },
      { id: "showWet", label: "Show wet evidence", disabled: !seasonCompared },
      { id: "showDry", label: "Show dry evidence", disabled: !seasonCompared },
      {
        id: "routeMountain",
        label: "Mountain Pass",
        pressed: routePrediction === "mountain",
      },
      {
        id: "routeOasis",
        label: "Oasis Trail",
        pressed: routePrediction === "oasis",
      },
      {
        id: "routeSame",
        label: "Same outcome",
        pressed: routePrediction === "same",
      },
      {
        id: "compareRoutes",
        label: "Compare mountain and oasis plans",
        disabled: !routePrediction,
      },
      {
        id: "showMountain",
        label: "Show mountain evidence",
        disabled: !routeCompared,
      },
      {
        id: "showOasis",
        label: "Show oasis evidence",
        disabled: !routeCompared,
      },
      {
        id: "packExact",
        label: `Pack exactly ${result.days} days`,
        disabled: !nowUnlocked,
      },
    ],
    sections: [
      {
        heading: "1 · Change the season",
        text: seasonFeedback,
        buttonIds: [
          "seasonMore",
          "seasonSame",
          "seasonFewer",
          "compareSeasons",
          "showWet",
          "showDry",
        ],
      },
      {
        heading: "2 · Change the route",
        text: routeFeedback,
        buttonIds: [
          "routeMountain",
          "routeOasis",
          "routeSame",
          "compareRoutes",
          "showMountain",
          "showOasis",
        ],
      },
      {
        heading: "Explore one change at a time",
        text: nowUnlocked
          ? "The controls are unlocked. Reset other controls before a new comparison; read travel days, delivered cargo, load and margin together."
          : "Complete both prediction-first comparisons to unlock route, cargo and packing controls.",
        buttonIds: ["packExact"],
      },
    ],
    footnote:
      "Historical Silk Roads were overlapping land and sea networks connecting many communities in many directions; goods often changed hands between merchants. This is one fictional composite segment, not a reconstruction of a place, people or century. Every location, duration, season effect, 100 kg limit, price, toll, margin and loss is invented. Fixed rules use 2 kg per supply day, 25% grain spoilage after 10 days and 15% mountain pottery breakage, rounded up. They are not historical measurements, probabilities or forecasts.",
  };
}

self.onmessage = ({ data }) => self.postMessage(run(data));
