import { PondTrend } from "./PondTrend";
import { svgNodes } from "../shared/vector-author";
import { installLesson } from "../physical-lesson";
import { landscapeScene, serializeLandscape } from "../shared/landscape-scene";
import { buildPond } from "./pond";
import { initialPond, pondWeek, type PondState } from "./model";
const initial = {
  nutrients: 50,
  drought: 0,
  week: 0,
  pond: { ...initialPond },
  trail: [{ ...initialPond }],
};
const step = (s: typeof initial) => {
  const pond = pondWeek(s.pond, s);
  return { ...s, week: s.week + 1, pond, trail: [...s.trail.slice(-20), pond] };
};
const five = (s: typeof initial) => {
  for (let i = 0; i < 5; i++) s = step(s);
  return s;
};
installLesson({
  vector: (s) => ({
    viewBox: [0, 0, 800, 130],
    description: `Population and oxygen trends through week ${s.week}; relative indices 0–100.`,
    nodes: [
      ...svgNodes(PondTrend(s))[0].children,
      {
        tag: "text",
        attrs: { x: 5, y: 120, fontSize: 14, fill: "#35493a" },
        children: [
          "Algae (green), zooplankton (blue), fish (brown), oxygen (purple): relative indices 0–100",
        ],
      },
    ],
  }),
  initial,
  serialize: serializeLandscape,
  title: "What changes when one consumer disappears?",
  introduction:
    "Follow food from algae to grazers to fish. Compare equal elapsed weeks.",
  build: (s) =>
    landscapeScene(
      buildPond({
        kind: "pond",
        ...s.pond,
        nutrients: s.nutrients,
        drought: s.drought,
      }),
      "pond",
    ),
  fields: [
    { id: "nutrients", label: "Nutrient supply", min: 0, max: 100 },
    { id: "drought", label: "Drought severity (%)", min: 0, max: 100 },
  ],
  actions: [
    { id: "week", label: "Advance one week", run: step },
    ...(["algae", "zooplankton", "fish"] as const).map((key) => ({
      id: key,
      label: `Remove / restore ${key}`,
      run: (s: typeof initial) => {
        const pond = {
          ...s.pond,
          [key]: s.pond[key] > 0 ? 0 : initialPond[key],
        };
        return { ...s, pond, trail: [...s.trail.slice(0, -1), pond] };
      },
    })),
  ],
  describe: (s) =>
    `Week ${s.week}. Algae ${s.pond.algae.toFixed(1)}, zooplankton ${s.pond.zooplankton.toFixed(1)}, fish ${s.pond.fish.toFixed(1)}, oxygen ${s.pond.oxygen.toFixed(1)}: relative indices, not counts. ${s.pond.oxygen < 40 ? "Oxygen below 40 adds stress to fish and grazers." : "Population effects develop over several weeks."} Recent trend (oldest first): ${s.trail.map((p) => `${p.algae.toFixed(0)}/${p.zooplankton.toFixed(0)}/${p.fish.toFixed(0)}/${p.oxygen.toFixed(0)}`).join(" → ")} (algae/grazers/fish/oxygen).`,
  trials: [
    {
      title: "Remove fish",
      question:
        "Without fish, which group changes first through reduced predation?",
      choices: ["Algae", "Zooplankton"],
      controlled:
        "Compare five weeks at nutrients 50 and drought 0, all species present versus fish absent. Both start with the same other populations.",
      before: five(initial),
      after: five({
        ...initial,
        pond: { ...initialPond, fish: 0 },
        trail: [{ ...initialPond, fish: 0 }],
      }),
      change: "Compare five weeks without fish",
      explain:
        "Fish eat zooplankton; zooplankton eat algae. How can removing a consumer affect a producer indirectly? Use the five-week trends.",
    },
    {
      title: "Add nutrients",
      question: "Does extra nutrient supply necessarily help every population?",
      choices: ["Yes", "No"],
      controlled:
        "Start with all species, no drought and original populations. Compare five weeks at nutrients 20 versus 100.",
      before: five({ ...initial, nutrients: 20 }),
      after: five({ ...initial, nutrients: 100 }),
      change: "Compare high nutrients",
      explain:
        "Nutrients raise algae’s growth limit. Grazing and oxygen change the outcome for other groups. Which trend contradicts the claim that more nutrients always help?",
    },
  ],
  note: "A three-group chain within a larger food web. Populations, oxygen and weeks are bounded illustrative indices/rates, not field measurements or forecasts. Oxygen represents a net balance including respiration and decomposition; algae make oxygen in daylight. Organisms/bubbles are enlarged symbols. Drought previews water level; biological changes require advancing time.",
});
