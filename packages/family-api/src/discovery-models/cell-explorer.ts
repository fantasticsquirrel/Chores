/** Pure, bounded Cell Explorer teaching model shared by web and native. */
export type CellPart =
  | "membrane"
  | "nucleus"
  | "mitochondrion"
  | "chloroplast"
  | "vacuole"
  | "wall";

export type CellExplorerState = {
  cellType: "plant" | "animal";
  selected: CellPart;
  molecule: "oxygen" | "glucose";
  carrier: boolean;
  outside: number;
  inside: number;
};

export const CELL_CONCENTRATION_MIN = 0;
export const CELL_CONCENTRATION_MAX = 20;
export const CELL_TRANSFER_STEP = 1;

export const defaultCellExplorerState: CellExplorerState = {
  cellType: "plant",
  selected: "membrane",
  molecule: "oxygen",
  carrier: false,
  outside: 12,
  inside: 4,
};

export const cellParts: Record<
  CellPart,
  { name: string; function: string; plantOnly: boolean }
> = {
  membrane: {
    name: "Cell membrane",
    function:
      "A selectively permeable lipid boundary controls exchange. Oxygen crosses the model bilayer directly; glucose crosses only through its specific carrier.",
    plantOnly: false,
  },
  nucleus: {
    name: "Nucleus",
    function:
      "Contains most of the cell’s DNA, including instructions used to make proteins. Both model cells have a nucleus.",
    plantOnly: false,
  },
  mitochondrion: {
    name: "Mitochondrion",
    function:
      "Transfers energy from food into ATP through cellular respiration. Plant cells have mitochondria too.",
    plantOnly: false,
  },
  chloroplast: {
    name: "Chloroplast",
    function:
      "Captures light energy for photosynthesis. This is a photosynthetic plant cell; many plant cells, including root cells, lack chloroplasts.",
    plantOnly: true,
  },
  vacuole: {
    name: "Central vacuole",
    function:
      "Stores water and dissolved substances. Water pressure in this large compartment helps support the plant cell.",
    plantOnly: true,
  },
  wall: {
    name: "Cell wall",
    function:
      "A rigid outer layer supports and protects the plant cell. The selectively permeable cell membrane lies inside it.",
    plantOnly: true,
  },
};

const cellPartValues = Object.keys(cellParts) as CellPart[];
const boundConcentration = (value: number, fallback: number) =>
  Number.isFinite(value)
    ? Math.min(CELL_CONCENTRATION_MAX, Math.max(CELL_CONCENTRATION_MIN, value))
    : fallback;

export function normalizeCellExplorerState(
  input: CellExplorerState,
): CellExplorerState {
  const cellType = input.cellType === "animal" ? "animal" : "plant";
  const requestedPart = cellPartValues.includes(input.selected)
    ? input.selected
    : defaultCellExplorerState.selected;
  return {
    cellType,
    selected:
      cellType === "animal" && cellParts[requestedPart].plantOnly
        ? "membrane"
        : requestedPart,
    molecule: input.molecule === "glucose" ? "glucose" : "oxygen",
    carrier: input.carrier === true,
    outside: boundConcentration(
      input.outside,
      defaultCellExplorerState.outside,
    ),
    inside: boundConcentration(input.inside, defaultCellExplorerState.inside),
  };
}

export function stepCellTransport(input: CellExplorerState): CellExplorerState {
  const state = normalizeCellExplorerState(input);
  if (state.molecule === "glucose" && !state.carrier) return state;
  const transfer =
    Math.sign(state.outside - state.inside) *
    Math.min(CELL_TRANSFER_STEP, Math.abs(state.outside - state.inside) / 2);
  return {
    ...state,
    outside: state.outside - transfer,
    inside: state.inside + transfer,
  };
}

export function cellObservation(input: CellExplorerState): string {
  const state = normalizeCellExplorerState(input);
  const levels = `Outside ${state.outside.toFixed(1)}; inside ${state.inside.toFixed(1)} relative concentration units.`;
  if (state.molecule === "glucose" && !state.carrier)
    return `${levels} No glucose transfer: this membrane has no glucose carrier.`;
  if (state.inside === state.outside)
    return `${levels} Equal concentrations: molecules still move both ways, but net transfer is zero.`;
  return `${levels} Net ${state.molecule} transfer is ${state.outside > state.inside ? "inward" : "outward"}, from higher to lower concentration.`;
}

export type CellExplorerTrial = {
  id: "compare-molecules" | "add-carrier";
  title: string;
  question: string;
  choices: readonly string[];
  correctChoice: string;
  controlled: string;
  before: CellExplorerState;
  after: CellExplorerState;
  caseLabels: readonly [string, string];
  change: string;
  changed: string;
  held: readonly string[];
  evidence: string;
  explain: string;
};

const oxygenBaseline = stepCellTransport(defaultCellExplorerState);
const glucoseBlocked = stepCellTransport({
  ...defaultCellExplorerState,
  molecule: "glucose",
});
const glucoseCarrier = stepCellTransport({
  ...defaultCellExplorerState,
  molecule: "glucose",
  carrier: true,
});

export const cellExplorerTrials: readonly CellExplorerTrial[] = [
  {
    id: "compare-molecules",
    title: "Compare molecules",
    question:
      "With the same concentration difference and no glucose carrier, will oxygen and glucose show the same net transfer?",
    choices: ["Same transfer", "Different transfer"],
    correctChoice: "Different transfer",
    controlled:
      "Start each trial at outside 12 and inside 4. Keep equal compartment size, cell type, carrier off and one model step fixed; change only the molecule.",
    before: oxygenBaseline,
    after: glucoseBlocked,
    caseLabels: ["Oxygen · one step", "Glucose · one step"],
    change: "Compare glucose after one step",
    changed: "molecule, from oxygen to glucose",
    held: [
      "outside 12 and inside 4",
      "equal-size compartments",
      "glucose carrier absent",
      "one model step",
    ],
    evidence:
      "Oxygen changed outside/inside from 12.0/4.0 to 11.0/5.0, a net inward transfer of 1.0 relative unit. Glucose stayed at 12.0/4.0 without its carrier.",
    explain:
      "A concentration difference can drive passive net movement only when the membrane provides a path. Oxygen crosses this model bilayer directly; glucose does not.",
  },
  {
    id: "add-carrier",
    title: "Add a carrier",
    question:
      "With the same glucose concentration difference, does adding its carrier change net transfer?",
    choices: ["Transfer changes", "No change"],
    correctChoice: "Transfer changes",
    controlled:
      "Use glucose at outside 12 and inside 4 in both trials. Keep equal compartment size and one model step fixed; change only whether the glucose carrier is present.",
    before: glucoseBlocked,
    after: glucoseCarrier,
    caseLabels: ["No carrier · one step", "Carrier · one step"],
    change: "Compare carrier after one step",
    changed: "glucose carrier, from absent to present",
    held: [
      "glucose",
      "outside 12 and inside 4",
      "equal-size compartments",
      "one model step",
    ],
    evidence:
      "Without the carrier, glucose stayed at 12.0/4.0. With the carrier, it changed to 11.0/5.0 while the two-compartment total stayed 16.0 relative units.",
    explain:
      "The carrier supplies a selective path; it does not create glucose or pump it uphill. Net movement remains from higher to lower concentration, so this is facilitated diffusion in the model.",
  },
] as const;

export const cellExplorerCoreBoundary =
  "This model compares passive net transport in two equal-size compartments. Relative concentration units and one-step changes are teaching quantities, not measurements or elapsed time.";

export const cellExplorerBoundary =
  "The model treats its membrane as a lipid bilayer through which oxygen can diffuse and gives glucose one specific carrier for facilitated diffusion. It preserves the two-compartment total, stops net transfer at equal concentrations and omits random molecular motion, water, electrical gradients, carrier saturation, competing solutes, active transport, metabolism and changing cell volume. Organelle size, number and placement are schematic; the pictured plant cell is photosynthetic, not representative of every plant cell.";
