import { installLesson } from "../physical-lesson";
import {
  defaultCellExplorerState as initial,
  cellExplorerBoundary,
  cellExplorerCoreBoundary,
  cellExplorerTrials,
  cellParts,
  normalizeCellExplorerState,
  stepCellTransport,
  cellObservation,
} from "./model";
import { createCellExplorerScene, cellPartOrder } from "./cell";
installLesson({
  initial,
  normalize: normalizeCellExplorerState,
  build: createCellExplorerScene,
  title: "What can cross a cell membrane?",
  introduction:
    "Predict which substance can cross, change one variable, and use concentration evidence to explain selective permeability.",
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
  trials: cellExplorerTrials.map((trial) => ({
    ...trial,
    choices: [...trial.choices],
    held: [...trial.held],
  })),
  note: `${cellExplorerCoreBoundary} A cell wall does not replace a membrane. Use numeric concentrations, not rounded molecule symbols, for comparisons. ${cellExplorerBoundary}`,
});
