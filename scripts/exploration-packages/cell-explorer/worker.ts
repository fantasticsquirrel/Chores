import { installLesson } from "../physical-lesson";
import {
  defaultCellExplorerState as initial,
  cellParts,
  stepCellTransport,
  cellObservation,
} from "./model";
import { createCellExplorerScene, cellPartOrder } from "./cell";
const trial = (molecule: "oxygen" | "glucose", carrier: boolean) =>
  stepCellTransport({ ...initial, molecule, carrier, outside: 12, inside: 4 });
installLesson({
  initial,
  build: createCellExplorerScene,
  title: "What can cross a cell membrane?",
  introduction:
    "Select a cell part, then compare oxygen and glucose moving between equal-sized compartments.",
  fields: [
    {
      id: "cellType",
      label: "Cell type",
      options: ["plant", "animal"],
      labels: ["Photosynthetic plant cell", "Animal cell"],
    },
    {
      id: "selected",
      label: "Cell part",
      options: cellPartOrder,
      labels: cellPartOrder.map((k) => cellParts[k].name),
    },
    { id: "molecule", label: "Molecule", options: ["oxygen", "glucose"] },
    { id: "carrier", label: "Glucose carrier", toggle: true },
    {
      id: "outside",
      label: "Outside concentration (relative units)",
      min: 0,
      max: 20,
      step: 0.5,
    },
    {
      id: "inside",
      label: "Inside concentration (relative units)",
      min: 0,
      max: 20,
      step: 0.5,
    },
  ],
  change: (s, k, v) => {
    const n = { ...s, [k]: v };
    if (n.cellType === "animal" && cellParts[n.selected].plantOnly)
      n.selected = "membrane";
    return n;
  },
  select: (s, i) =>
    cellPartOrder[i] &&
    (s.cellType === "plant" || !cellParts[cellPartOrder[i]].plantOnly)
      ? { ...s, selected: cellPartOrder[i] }
      : s,
  actions: [
    { id: "transfer", label: "Transfer one step", run: stepCellTransport },
    {
      id: "resetConcentrations",
      label: "Reset concentrations",
      run: (s) => ({ ...s, outside: 12, inside: 4 }),
    },
  ],
  describe: (s) =>
    `${s.cellType === "plant" ? "Photosynthetic plant cell with wall, membrane, central vacuole and chloroplasts." : "Animal cell without wall or chloroplasts."} Both have nucleus and mitochondria. ${cellParts[s.selected].name}: ${cellParts[s.selected].function} ${cellObservation(s)} Total concentration units in equal volumes ${(s.inside + s.outside).toFixed(1)}; a transfer step conserves this total.`,
  trials: [
    {
      title: "Compare molecules",
      question: "With no carrier, will both molecules enter at the same rate?",
      choices: ["Same transfer", "Different transfer"],
      controlled:
        "Start both trials at outside 12, inside 4 with the same cell type and carrier off. Compare one transfer step for oxygen and glucose.",
      before: trial("oxygen", false),
      after: trial("glucose", false),
      change: "Compare glucose after one step",
      explain:
        "Which changed inside concentration? What does that show about a selectively permeable membrane?",
    },
    {
      title: "Add a carrier",
      question:
        "Can a carrier change glucose transfer without changing the starting concentration difference?",
      choices: ["Transfer changes", "No change"],
      controlled:
        "Start glucose at outside 12 and inside 4 for each trial. Compare one step without and with the carrier.",
      before: trial("glucose", false),
      after: trial("glucose", true),
      change: "Compare carrier after one step",
      explain:
        "Compare amounts on each side and total. Does a carrier create glucose, or provide a path?",
    },
  ],
  note: "Organelles enlarged and arranged for inspection, not to scale. Concentrations are relative units in two equal volumes. Each step shows net transfer, not individual molecular motion or elapsed time. Only passive oxygen diffusion and carrier-mediated glucose diffusion; active transport and reactions omitted. A cell wall does not replace a membrane. Molecule symbols rounded; use numeric concentrations.",
});
