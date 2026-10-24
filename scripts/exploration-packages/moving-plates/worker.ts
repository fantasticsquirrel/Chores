import { installLesson } from "../physical-lesson";
import {
  initialPlate,
  normalizePlate,
  advancePlate,
  plateResult,
} from "./model";
import { createMovingPlatesScene } from "./plates";
installLesson({
  initial: initialPlate,
  normalize: normalizePlate,
  build: createMovingPlatesScene,
  title: "How does plate motion change a boundary?",
  introduction:
    "Earth’s rigid outer plates move over a slowly deforming mantle. Compare the arrows and cutaway, not just the surface.",
  fields: [
    {
      id: "boundary",
      label: "Boundary type",
      options: ["divergent", "convergent", "transform"],
      labels: ["Apart", "Together", "Sideways"],
    },
    { id: "movement", label: "Terrain diagram progress (%)", min: 0, max: 100 },
  ],
  change: (s, k, v) =>
    k === "boundary"
      ? { ...initialPlate, boundary: v, movement: 0 }
      : s.boundary === "transform" && k === "movement"
        ? s
        : { ...s, [k]: v },
  select: (s) => advancePlate(s),
  actions: [
    {
      id: "step",
      label: "Advance diagram / add one loading step",
      run: (s) => advancePlate(s),
    },
    {
      id: "resetBoundary",
      label: "Reset this boundary",
      run: (s) => ({ ...initialPlate, boundary: s.boundary, movement: 0 }),
    },
  ],
  describe: (s) => {
    const r = plateResult(s);
    return `${r.terrain}. Plates move ${r.motion}. Diagram progress ${s.movement}%; stored deformation index ${s.stress} / 60 threshold; ${s.slips} illustrated slips. ${s.boundary === "transform" ? (s.slips > 0 && s.stress === 12 ? "The latest slip released stored deformation; the road is now offset." : "Loading bends the road before the next illustrated slip.") : "Progress is not elapsed years."}`;
  },
  trials: [
    {
      title: "Compare directions",
      question:
        "At equal diagram progress, will pulling apart and pushing together make the same boundary shape?",
      choices: ["Same shape", "Different shapes"],
      controlled:
        "Compare Apart and Together at the same 40% diagram stage; vertical relief is not a measurement.",
      before: { ...initialPlate, movement: 40 },
      after: { ...initialPlate, boundary: "convergent", movement: 40 },
      change: "Compare Together at 40%",
      explain:
        "Which adds crust at the boundary and which carries oceanic crust beneath another plate? Use arrows and cutaway.",
    },
    {
      title: "Load, then slip",
      question:
        "Will the road shift gradually at every loading step, or suddenly after deformation builds?",
      choices: ["Gradually each step", "After deformation builds"],
      controlled:
        "Compare Sideways after four identical loading steps and one further step. Use the index, offset and slip count.",
      before: advancePlate(
        { ...initialPlate, boundary: "transform", movement: 0 },
        4,
      ),
      after: advancePlate(
        { ...initialPlate, boundary: "transform", movement: 0 },
        5,
      ),
      change: "Add the fifth loading step",
      explain:
        "Why can slowly accumulating motion lead to a sudden slip? Does this invented threshold predict a real earthquake?",
    },
  ],
  note: "Terrain and time are schematic. Together shows oceanic–continental subduction, not every collision. Earthquakes occur at all three boundary types and within plates; only Sideways has a loading model here. Its threshold, regular repetition and index are invented, not timing or magnitude predictions. The mantle is mostly solid, not liquid magma.",
});
