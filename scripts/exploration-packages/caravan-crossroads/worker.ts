import { installLesson } from "../physical-lesson";
import { landscapeScene, serializeLandscape } from "../shared/landscape-scene";
import { buildCaravan } from "./caravan";
import {
  caravanJourney,
  CARAVAN_ROUTES,
  type CaravanRoute,
  type CaravanSeason,
  type CaravanCargo,
} from "./model";
const initial = {
  route: "river" as CaravanRoute,
  season: "wet" as CaravanSeason,
  cargo: "grain" as CaravanCargo,
  units: 6,
  supplies: 10,
};
const result = (s: typeof initial) =>
  caravanJourney(s.route, s.season, s.cargo, s.units, s.supplies);
installLesson<typeof initial>({
  initial,
  serialize: serializeLandscape,
  title: "Which route fits the cargo?",
  introduction:
    "Compare fictional markets, weather, supplies and cargo losses.",
  build: (s) => {
    const r = result(s);
    return landscapeScene(
      buildCaravan({ kind: "caravan", ...s, days: r.days, load: r.load }),
      "caravan",
    );
  },
  fields: [
    {
      id: "route",
      label: "Trade route",
      options: ["ridge", "river", "oasis"],
      labels: ["Mountain pass", "River road", "Oasis trail"],
    },
    { id: "season", label: "Season", options: ["wet", "dry"] },
    { id: "cargo", label: "Cargo", options: ["grain", "cloth", "pottery"] },
    { id: "units", label: "Cargo units", min: 1, max: 15 },
    { id: "supplies", label: "Supply days", min: 0, max: 20 },
  ],
  actions: [
    {
      id: "pack",
      label: "Pack enough supplies",
      run: (s) => ({ ...s, supplies: CARAVAN_ROUTES[s.route][s.season] }),
    },
  ],
  describe: (s) => {
    const r = result(s);
    return `${CARAVAN_ROUTES[s.route].name}, ${s.season} season: ${r.days} days. ${s.units} cargo units with ${s.supplies} supply days weigh ${r.load} kg of 100 kg capacity. ${r.shortfall} supply days missing; ${r.delivered} units delivered, ${r.spoiled} spoiled and ${r.broken} broken. Costs ${r.costs}, revenue ${r.revenue}, margin ${r.margin} invented credits. ${r.viable ? "Enough supplies and carrying capacity." : "Journey constraints not satisfied."}`;
  },
  trials: [
    {
      title: "Compare seasons",
      question: "Will a dry-season river journey need more or fewer supplies?",
      choices: ["More", "Fewer"],
      controlled:
        "Keep six grain units on the river road. Compare wet and dry seasons, packing enough supply days for each.",
      before: { ...initial, supplies: 8 },
      after: { ...initial, season: "dry", supplies: 14 },
      change: "Compare dry season",
      explain:
        "Low water slows this fictional river route. Longer travel needs supplies and crosses the grain-spoilage threshold. Why is time not the only cost?",
    },
    {
      title: "Compare cargo routes",
      question: "Is the shortest route always best for pottery?",
      choices: ["Always", "Not always"],
      controlled:
        "Carry six pottery units in the dry season. Compare the mountain pass with the oasis trail, packing enough days for each.",
      before: {
        ...initial,
        route: "ridge",
        season: "dry",
        cargo: "pottery",
        supplies: 9,
      },
      after: {
        ...initial,
        route: "oasis",
        season: "dry",
        cargo: "pottery",
        supplies: 12,
      },
      change: "Compare oasis trail",
      explain:
        "The pass is shorter but breaks pottery; the oasis needs more supplies but has a lower toll. Compare delivered units, carrying capacity and margin.",
    },
  ],
  note: "Fictional composite map, not a historical reconstruction. Trade connected many communities in multiple directions. Locations, durations, prices and losses are invented. Supplies weigh 2 kg/day. Grain loses 25% after ten days; mountain travel breaks 15% of pottery, rounded up. Fixed teaching rules are not historical probabilities.",
});
