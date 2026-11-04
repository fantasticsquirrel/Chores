/** Bounded, deterministic teaching models. No browser or renderer dependencies. */
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
export const defaultCellExplorerState: CellExplorerState = {
  cellType: "plant",
  selected: "membrane",
  molecule: "oxygen",
  carrier: false,
  outside: 12,
  inside: 4,
};
export const CELL_CONCENTRATION_MIN = 0;
export const CELL_CONCENTRATION_MAX = 20;
export const CELL_TRANSFER_STEP = 1;
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
  if (state.molecule === "glucose" && !state.carrier) return { ...state };
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
export type Point3 = [number, number, number];
export type ShapeSlicerState = {
  solid: "cube" | "tetrahedron" | "sphere";
  tilt: number;
  turn: number;
  offset: number;
};
export const defaultShapeSlicerState: ShapeSlicerState = {
  solid: "cube",
  tilt: 0,
  turn: 0,
  offset: 0,
};
export const solidVertices: Record<"cube" | "tetrahedron", Point3[]> = {
  cube: [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ],
  tetrahedron: [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ],
};
export const solidEdges: Record<"cube" | "tetrahedron", [number, number][]> = {
  cube: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ],
  tetrahedron: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 2],
    [1, 3],
    [2, 3],
  ],
};
export function rotateSolidPoint(
  [x, y, z]: Point3,
  tilt: number,
  turn: number,
): Point3 {
  const a = (tilt * Math.PI) / 180,
    b = (turn * Math.PI) / 180;
  const yy = y * Math.cos(a) - z * Math.sin(a),
    zz = y * Math.sin(a) + z * Math.cos(a);
  return [
    x * Math.cos(b) - yy * Math.sin(b),
    x * Math.sin(b) + yy * Math.cos(b),
    zz,
  ];
}
export type CrossSection = {
  name: string;
  points: Point3[];
  area: number;
  perimeter: number;
  radius: number | null;
};
const distance = (a: Point3, b: Point3) =>
  Math.hypot(...a.map((n, i) => n - b[i]));
const near = (a: number, b: number) => Math.abs(a - b) < 0.000001;
function polygonName(points: Point3[]): string {
  if (points.length < 3)
    return points.length === 0
      ? "no intersection"
      : points.length === 1
        ? "point"
        : "line segment";
  if (points.length !== 4)
    return (
      (
        { 3: "triangle", 5: "pentagon", 6: "hexagon" } as Record<number, string>
      )[points.length] ?? `${points.length}-sided polygon`
    );
  const lengths = points.map((p, i) => distance(p, points[(i + 1) % 4]));
  const equal = lengths.every((length) => near(length, lengths[0]));
  const right = points.every((p, i) => {
    const next = points[(i + 1) % 4],
      previous = points[(i + 3) % 4];
    return near(
      p.reduce((sum, n, j) => sum + (next[j] - n) * (previous[j] - n), 0),
      0,
    );
  });
  return right
    ? equal
      ? "square"
      : "rectangle"
    : equal
      ? "rhombus"
      : "quadrilateral";
}
export function crossSection(state: ShapeSlicerState): CrossSection {
  const empty: CrossSection = {
    name: "no intersection",
    points: [],
    area: 0,
    perimeter: 0,
    radius: null,
  };
  if (state.solid === "sphere") {
    if (Math.abs(state.offset) > 1) return empty;
    const radius = Math.sqrt(Math.max(0, 1 - state.offset ** 2));
    return {
      name: radius === 0 ? "point" : "circle",
      points:
        radius === 0
          ? [[0, state.offset, 0]]
          : Array.from({ length: 96 }, (_, i) => [
              radius * Math.cos((i * Math.PI) / 48),
              state.offset,
              radius * Math.sin((i * Math.PI) / 48),
            ]),
      area: Math.PI * radius ** 2,
      perimeter: 2 * Math.PI * radius,
      radius,
    };
  }
  const vertices = solidVertices[state.solid].map((point) =>
    rotateSolidPoint(point, state.tilt, state.turn),
  );
  const points: Point3[] = [];
  const add = (point: Point3) => {
    if (!points.some((p) => distance(p, point) < 0.000001)) points.push(point);
  };
  for (const [start, end] of solidEdges[state.solid]) {
    const a = vertices[start],
      b = vertices[end],
      da = a[1] - state.offset,
      db = b[1] - state.offset;
    if (Math.abs(da) < 1e-8) add(a);
    if (Math.abs(db) < 1e-8) add(b);
    if (da * db < -1e-12) {
      const t = da / (da - db);
      add(a.map((value, index) => value + t * (b[index] - value)) as Point3);
    }
  }
  const center = points.reduce(
    (acc, point) =>
      [
        acc[0] + point[0] / points.length,
        0,
        acc[2] + point[2] / points.length,
      ] as Point3,
    [0, 0, 0] as Point3,
  );
  points.sort(
    (a, b) =>
      Math.atan2(a[2] - center[2], a[0] - center[0]) -
      Math.atan2(b[2] - center[2], b[0] - center[0]),
  );
  const area =
    Math.abs(
      points.reduce((sum, p, i) => {
        const q = points[(i + 1) % points.length];
        return sum + p[0] * q[2] - q[0] * p[2];
      }, 0),
    ) / 2;
  const perimeter =
    points.length < 3
      ? 0
      : points.reduce(
          (sum, p, i) => sum + distance(p, points[(i + 1) % points.length]),
          0,
        );
  return { name: polygonName(points), points, area, perimeter, radius: null };
}
export function shapeObservation(state: ShapeSlicerState): string {
  const result = crossSection(state);
  return `The ${state.solid} cross-section is ${result.name === "no intersection" ? "empty" : `a ${result.name}`}. Area ${result.area.toFixed(2)} square units; boundary length ${result.perimeter.toFixed(2)} units.${result.radius !== null ? ` Radius ${result.radius.toFixed(2)} units.` : result.points.length > 2 ? ` ${result.points.length} sides.` : ""}`;
}
export type AdaptationIslandState = {
  habitat: "dark" | "light";
  predators: boolean;
  generation: number;
  darkCount: number;
  lightCount: number;
  initialDark: number;
};
export const defaultAdaptationIslandState: AdaptationIslandState = {
  habitat: "dark",
  predators: true,
  generation: 0,
  darkCount: 50,
  lightCount: 50,
  initialDark: 50,
};
export function nextIslandGeneration(
  state: AdaptationIslandState,
): AdaptationIslandState {
  if (state.generation >= 20) return { ...state };
  const darkSurvival = !state.predators || state.habitat === "dark" ? 0.9 : 0.5;
  const lightSurvival =
    !state.predators || state.habitat === "light" ? 0.9 : 0.5;
  const total =
    state.darkCount * darkSurvival + state.lightCount * lightSurvival;
  const darkCount =
    total === 0 ? 0 : (100 * state.darkCount * darkSurvival) / total;
  return {
    ...state,
    generation: state.generation + 1,
    darkCount,
    lightCount: total === 0 ? 0 : 100 - darkCount,
  };
}
export function resetIsland(
  state: AdaptationIslandState,
): AdaptationIslandState {
  return {
    ...state,
    generation: 0,
    darkCount: state.initialDark,
    lightCount: 100 - state.initialDark,
  };
}
export function islandObservation(state: AdaptationIslandState): string {
  return `Generation ${state.generation}: dark shells ${state.darkCount.toFixed(1)}%, pale shells ${state.lightCount.toFixed(1)}%. ${state.predators ? `On ${state.habitat} ground, ${state.habitat === "dark" ? "dark" : "pale"} shells have the higher survival weight.` : "Without predation, both shell colors have the same survival weight."} Individuals do not change shell color; inherited variants change in proportion across generations.`;
}
