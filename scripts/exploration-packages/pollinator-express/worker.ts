import { installLesson } from "../physical-lesson";
import { landscapeScene, serializeLandscape } from "../shared/landscape-scene";
import { buildGarden } from "./garden";
import { initialPollinator, visitFlower, POLLINATOR_FLOWERS } from "./model";
const initial = { reach: 170, habitat: false, journey: initialPollinator() };
const visit = (s: typeof initial, id: string) => ({
  ...s,
  journey: visitFlower(s.journey, id, s.reach, s.habitat),
});
const route = (s: typeof initial, ids: string[]) => ids.reduce(visit, s);
installLesson({
  initial,
  serialize: serializeLandscape,
  title: "Does a visit transfer useful pollen?",
  introduction:
    "Choose a flower and follow the bee’s reach and carried pollen.",
  build: (s) =>
    landscapeScene(
      buildGarden({
        kind: "garden",
        x: s.journey.x,
        y: s.journey.y,
        reach: s.reach,
        habitat: s.habitat,
        pollen: s.journey.pollen?.species ?? "none",
        received: s.journey.pollinated.map((id) =>
          POLLINATOR_FLOWERS.findIndex((f) => f.id === id),
        ),
        path: s.journey.path,
      }),
      "garden",
    ),
  fields: [
    {
      id: "reach",
      label: "Flight reach (garden units)",
      min: 80,
      max: 240,
      step: 10,
    },
    {
      id: "habitat",
      label: "Add habitat patches (starts fresh journey)",
      toggle: true,
    },
  ],
  change: (s, key, value) =>
    key === "habitat"
      ? { ...s, habitat: value, journey: initialPollinator() }
      : { ...s, [key]: value },
  select: (s, index) =>
    POLLINATOR_FLOWERS[index] ? visit(s, POLLINATOR_FLOWERS[index].id) : s,
  actions: [
    {
      id: "nest",
      label: "Return to nest",
      run: (s) => ({ ...s, journey: initialPollinator() }),
    },
    ...POLLINATOR_FLOWERS.map((f) => ({
      id: `flower_${f.id}`,
      label: `Visit ${f.name}`,
      run: (s: typeof initial) => visit(s, f.id),
    })),
  ],
  describe: (s) =>
    `${s.journey.visits} visits, ${s.journey.transfers} compatible pollen transfers. Carried pollen: ${s.journey.pollen?.species ?? "none"}, source ${s.journey.pollen?.sourceId ?? "none"}. Reach ${s.reach} garden units, habitat ${s.habitat ? "connected" : "without extra patches"}. ${s.journey.message} Received flowers: ${s.journey.pollinated.join(", ") || "none"}. A visit is not necessarily a compatible transfer.`,
  trials: [
    {
      title: "Connect habitat",
      question:
        "At reach 170, can the bee cross the gap without extra flowers?",
      choices: ["Yes", "No"],
      controlled:
        "Keep reach 170. Compare Gold 1 → Gold 2 → Gold 3 with the same start plus Gold bridge before Gold 3. Each comparison starts at the nest.",
      before: route(initial, ["a", "b", "d"]),
      after: route({ ...initial, habitat: true }, ["a", "b", "bridge-a", "d"]),
      change: "Compare added habitat",
      explain:
        "Each flight must be within reach from the current position. Which stopping place connects the patches?",
    },
    {
      title: "Compare pollen",
      question: "Will Gold 1 → Violet 1 give a compatible transfer?",
      choices: ["Yes", "No"],
      controlled:
        "Start at the nest each time, reach 170 and no extra habitat. Compare Gold 1 → Gold 2 with Gold 1 → Violet 1.",
      before: route(initial, ["a", "b"]),
      after: route(initial, ["a", "c"]),
      change: "Compare different species",
      explain:
        "Different flowers of the same species can receive compatible pollen here. What did counting visits alone miss?",
    },
  ],
  note: "Garden units and flight reach are teaching assumptions, not real bee flight distances. The bee carries only the last flower’s pollen; real bees carry mixed loads. Compatible transfer needs a different same-species flower here and does not guarantee fertilization or seeds. Flowers and bee are enlarged to show the mechanism.",
});
