import { installLesson } from "../physical-lesson";
import { physicalScene, serializePhysical } from "../shared/physical-scene";
import { createBridgeScene } from "./bridgeScene";
import { bridge, type BridgeMaterial } from "./model";
const initial = {
  material: "timber" as BridgeMaterial,
  brace0: false,
  brace1: false,
  brace2: false,
  brace3: false,
  load: 10,
  position: 50,
};
const braces = (s: typeof initial) => [s.brace0, s.brace1, s.brace2, s.brace3];
const result = (s: typeof initial) =>
  bridge(s.material, braces(s), s.load, s.position);
installLesson({
  initial,
  serialize: serializePhysical,
  title: "Which support carries the load?",
  introduction:
    "Move the truck, compare support forces and reinforce one section.",
  drag: true,
  build: (s) =>
    physicalScene(
      createBridgeScene({
        kind: "bridge",
        ...s,
        braces: braces(s),
        ...result(s),
      }),
      "bridge",
    ),
  select: (s, position) => ({ ...s, position }),
  fields: [
    { id: "position", label: "Load position (%)", min: 5, max: 95 },
    { id: "load", label: "Point load (kN)", min: 0, max: 30 },
    { id: "material", label: "Beam material", options: ["timber", "steel"] },
    ...[0, 1, 2, 3].map((i) => ({
      id: `brace${i}`,
      label: `Reinforce section ${i + 1}`,
      toggle: true,
    })),
  ],
  actions: [
    { id: "left", label: "Left bank", run: (s) => ({ ...s, position: 15 }) },
    { id: "center", label: "Center", run: (s) => ({ ...s, position: 50 }) },
    { id: "right", label: "Right bank", run: (s) => ({ ...s, position: 85 }) },
  ],
  describe: (s) => {
    const r = result(s);
    return `Left reaction ${r.leftReaction.toFixed(2)} kN + right ${r.rightReaction.toFixed(2)} kN = ${s.load} kN applied load. Maximum bending moment ${r.maxMoment.toFixed(2)} kN m. Four section capacity uses: ${r.utilization.map((v) => (v * 100).toFixed(0) + "%").join(", ")}. Cost ${r.cost}/400 illustrative credits. Reinforcement increases capacity, not applied force.`;
  },
  trials: [
    {
      title: "Move the load",
      question:
        "After moving the truck left, which support carries more of the same load?",
      choices: ["Left", "Right", "Equal"],
      controlled:
        "Keep timber, no braces and load 10 kN. Compare center 50% with left 15%.",
      before: initial,
      after: { ...initial, position: 15 },
      change: "Move truck left",
      explain:
        "The upward reactions sum to the downward load. Why does the nearer support carry more?",
    },
    {
      title: "Reinforce one section",
      question: "Will one brace change support forces or section capacity?",
      choices: ["Forces", "Capacity", "Both"],
      controlled:
        "Keep truck at 50%, load 10 kN and timber. Reinforce only section 2, one of the two equal highest-use central zones.",
      before: initial,
      after: { ...initial, brace1: true },
      change: "Reinforce section 2",
      explain:
        "Compare the four capacity-use values and unchanged support forces. Why can the unreinforced central zone remain limiting?",
    },
  ],
  note: "10 m simply supported beam, one static point load. Truss appearance is not a solved truss. Capacities, brace benefits and credit costs are illustrative. Self-weight, joints, buckling and moving-load effects omitted. Not a construction design or safety rating.",
});
