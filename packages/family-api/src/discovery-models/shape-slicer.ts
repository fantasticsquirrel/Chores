import {
  crossSection,
  defaultShapeSlicerState,
  type ShapeSlicerState,
} from "./expansion-life-geometry";

export const SHAPE_ANGLE_MIN = 0;
export const SHAPE_ANGLE_MAX = 90;
export const SHAPE_OFFSET_MIN = -1.75;
export const SHAPE_OFFSET_MAX = 1.75;

const bound = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizeShapeSlicerState(
  input: ShapeSlicerState,
): ShapeSlicerState {
  return {
    solid: ["cube", "tetrahedron", "sphere"].includes(input.solid)
      ? input.solid
      : defaultShapeSlicerState.solid,
    tilt: bound(
      input.tilt,
      SHAPE_ANGLE_MIN,
      SHAPE_ANGLE_MAX,
      defaultShapeSlicerState.tilt,
    ),
    turn: bound(
      input.turn,
      SHAPE_ANGLE_MIN,
      SHAPE_ANGLE_MAX,
      defaultShapeSlicerState.turn,
    ),
    offset: bound(
      input.offset,
      SHAPE_OFFSET_MIN,
      SHAPE_OFFSET_MAX,
      defaultShapeSlicerState.offset,
    ),
  };
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

export const shapeSlicerTrialResults = shapeSlicerTrials.map((trial) => ({
  id: trial.id,
  before: crossSection(trial.before),
  after: crossSection(trial.after),
}));
