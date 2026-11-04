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
export const cellParts: Record<
  CellPart,
  { name: string; function: string; plantOnly: boolean }
> = {
  membrane: {
    name: "Cell membrane",
    function:
      "A selectively permeable boundary controls exchange. Small oxygen molecules diffuse through the lipid layer; glucose needs a transport protein in this model.",
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
      "Transfers energy from food into a usable form through cellular respiration. Plant cells have mitochondria too.",
    plantOnly: false,
  },
  chloroplast: {
    name: "Chloroplast",
    function:
      "Captures light energy to help make sugars from carbon dioxide and water. This is a photosynthetic plant cell; many plant cells, such as root cells, lack chloroplasts.",
    plantOnly: true,
  },
  vacuole: {
    name: "Central vacuole",
    function:
      "Stores water and dissolved substances. Its pressure helps support this plant cell. Animal cells can have smaller storage compartments, not this large central vacuole.",
    plantOnly: true,
  },
  wall: {
    name: "Cell wall",
    function:
      "A rigid outer layer supports and protects the plant cell. The cell membrane lies inside it and controls selective exchange.",
    plantOnly: true,
  },
};
export function stepCellTransport(state: CellExplorerState): CellExplorerState {
  if (state.molecule === "glucose" && !state.carrier) return { ...state };
  const transfer =
    Math.sign(state.outside - state.inside) *
    Math.min(1, Math.abs(state.outside - state.inside) / 2);
  return {
    ...state,
    outside: state.outside - transfer,
    inside: state.inside + transfer,
  };
}
export function cellObservation(state: CellExplorerState): string {
  const levels = `Outside ${state.outside.toFixed(1)}; inside ${state.inside.toFixed(1)} relative concentration units.`;
  if (state.molecule === "glucose" && !state.carrier)
    return `${levels} No glucose transfer: this membrane has no glucose carrier.`;
  if (state.inside === state.outside)
    return `${levels} Equal concentrations: molecules still move both ways, but net transfer is zero.`;
  return `${levels} Net ${state.molecule} transfer is ${state.outside > state.inside ? "inward" : "outward"}, from higher to lower concentration.`;
}
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
export const SHAPE_ANGLE_MIN = 0;
export const SHAPE_ANGLE_MAX = 90;
export const SHAPE_OFFSET_MIN = -1.75;
export const SHAPE_OFFSET_MAX = 1.75;
const boundShape = (
  value: number,
  min: number,
  max: number,
  fallback: number,
) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);
export function normalizeShapeSlicerState(
  input: ShapeSlicerState,
): ShapeSlicerState {
  return {
    solid: ["cube", "tetrahedron", "sphere"].includes(input.solid)
      ? input.solid
      : defaultShapeSlicerState.solid,
    tilt: boundShape(
      input.tilt,
      SHAPE_ANGLE_MIN,
      SHAPE_ANGLE_MAX,
      defaultShapeSlicerState.tilt,
    ),
    turn: boundShape(
      input.turn,
      SHAPE_ANGLE_MIN,
      SHAPE_ANGLE_MAX,
      defaultShapeSlicerState.turn,
    ),
    offset: boundShape(
      input.offset,
      SHAPE_OFFSET_MIN,
      SHAPE_OFFSET_MAX,
      defaultShapeSlicerState.offset,
    ),
  };
}
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
export const diagonalCubeState: ShapeSlicerState = {
  solid: "cube",
  tilt: 45,
  turn: 35.26438968,
  offset: 0,
};
export type ShapeSlicerTrial = {
  id: "rotate-cube" | "move-sphere-plane";
  title: string;
  question: string;
  choices: readonly string[];
  correctChoice: string;
  controlled: string;
  before: ShapeSlicerState;
  after: ShapeSlicerState;
  caseLabels: readonly [string, string];
  change: string;
  changed: string;
  held: readonly string[];
  evidence: string;
  explain: string;
};
export const shapeSlicerTrials: readonly ShapeSlicerTrial[] = [
  {
    id: "rotate-cube",
    title: "Rotate a cube",
    question: "Must a plane through the center of a cube make four sides?",
    choices: ["Always four", "Can make more"],
    correctChoice: "Can make more",
    controlled:
      "Keep the same side-2 cube and horizontal plane through its center. Change only the cube orientation relative to that plane.",
    before: defaultShapeSlicerState,
    after: diagonalCubeState,
    caseLabels: ["Face-parallel center", "Diagonal center"],
    change: "Compare diagonal center",
    changed: "cube orientation",
    held: ["same cube", "side length 2", "plane height 0"],
    evidence:
      "The face-parallel section is a square with 4 sides, area 4.00 and boundary length 8.00. The diagonal section is a hexagon with 6 sides, area 5.20 and boundary length 8.49.",
    explain:
      "A cross-section boundary forms where the plane meets cube faces. The diagonal central plane reaches six faces, so the section can have more sides than any one square face.",
  },
  {
    id: "move-sphere-plane",
    title: "Move through a sphere",
    question:
      "When a parallel plane moves from a sphere’s center to height 0.6, what changes?",
    choices: ["Size only", "Shape and size", "Neither"],
    correctChoice: "Size only",
    controlled:
      "Keep an ideal radius-1 sphere and the plane orientation fixed. Change only plane height from 0 to 0.6; compare the equal-scale straight-on sections.",
    before: { ...defaultShapeSlicerState, solid: "sphere" },
    after: {
      ...defaultShapeSlicerState,
      solid: "sphere",
      offset: 0.6,
    },
    caseLabels: ["Sphere · center", "Sphere · height 0.6"],
    change: "Compare height 0.6",
    changed: "plane height, from 0 to 0.6",
    held: ["radius 1", "sphere", "parallel plane", "equal display scale"],
    evidence:
      "Both sections are circles. Radius changes from 1.00 to 0.80 units and area from 3.14 to 2.01 square units, 64% of the central area.",
    explain:
      "Every non-tangent plane section of a sphere is a circle. Away from the center, less of the sphere reaches the plane, so the circle shrinks until a tangent plane meets one point.",
  },
] as const;
export const shapeSlicerCoreBoundary =
  "A cross-section is the two-dimensional intersection of an ideal solid and a plane. It is not the solid’s shadow, outer face or a thick physical slice.";
export const shapeSlicerBoundary =
  "The cube has side length 2, the sphere has radius 1 and the tetrahedron uses alternating cube corners. Polygon readouts use computed edge-plane intersections; sphere readouts use exact circle formulas and are rounded to two decimals. Plane height and angles are model units and degrees. Tangency can make a point or line with zero area; a plane outside the solid makes no section. Camera motion changes only the view. The model omits material thickness, cutting deformation and measurement uncertainty.";
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
