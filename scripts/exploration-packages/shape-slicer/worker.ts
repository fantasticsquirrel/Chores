import { installLesson } from "../physical-lesson";
import {
  defaultShapeSlicerState as initial,
  crossSection,
  shapeObservation,
  diagonalCubeState,
  normalizeShapeSlicerState,
  shapeSlicerBoundary,
  shapeSlicerCoreBoundary,
  shapeSlicerTrials,
} from "./model";
import { createShapeSlicerScene } from "./shape";
installLesson({
  initial,
  normalize: normalizeShapeSlicerState,
  build: createShapeSlicerScene,
  title: "How does a plane make a cross-section?",
  introduction:
    "Predict the section, change only orientation or plane height, and use side, radius and area evidence to explain the result.",
  fields: [
    { id: "solid", label: "Solid", options: ["cube", "tetrahedron", "sphere"] },
    { id: "tilt", label: "Solid tilt (degrees)", min: 0, max: 90, step: 0.1 },
    { id: "turn", label: "Solid turn (degrees)", min: 0, max: 90, step: 0.1 },
    {
      id: "offset",
      label: "Cut height (units)",
      min: -1.75,
      max: 1.75,
      step: 0.05,
    },
  ],
  select: (s, d) => ({
    ...s,
    offset:
      Math.round(Math.max(-1.75, Math.min(1.75, s.offset + d * 0.1)) * 20) / 20,
  }),
  actions: [
    {
      id: "center",
      label: "Center the cut",
      run: (s) => ({ ...s, offset: 0 }),
    },
    {
      id: "diagonal",
      label: "Diagonal cube cut",
      run: () => diagonalCubeState,
    },
  ],
  describe: (s) =>
    `${shapeObservation(s)} Amber plane horizontal; solid tilt ${s.tilt.toFixed(1)}°, turn ${s.turn.toFixed(1)}°, height ${s.offset.toFixed(2)}. The straight-on view uses equal scale in both directions; camera motion changes view only.`,
  vector: (s) => {
    const c = crossSection(s),
      points = c.points
        .map((p) => `${130 + p[0] * 52},${130 + p[2] * 52}`)
        .join(" ");
    const node = (tag: string, attrs: any) => ({ tag, attrs, children: [] });
    return {
      viewBox: [0, 0, 260, 260],
      description: `${c.name}, area ${c.area.toFixed(2)} square units. Same scale in both directions.`,
      nodes: [
        node("rect", { x: 0, y: 0, width: 260, height: 260, fill: "#10212b" }),
        ...Array.from({ length: 11 }, (_, i) => [
          node("line", {
            x1: i * 26,
            y1: 0,
            x2: i * 26,
            y2: 260,
            stroke: "#a5b3bd",
            strokeOpacity: 0.16,
          }),
          node("line", {
            x1: 0,
            y1: i * 26,
            x2: 260,
            y2: i * 26,
            stroke: "#a5b3bd",
            strokeOpacity: 0.16,
          }),
        ]).flat(),
        ...(c.points.length > 2
          ? [
              node("polygon", {
                points,
                fill: "#d9b46644",
                stroke: "#eaca85",
                strokeWidth: 2,
              }),
            ]
          : c.points.length === 2
            ? [
                node("polyline", {
                  points,
                  fill: "none",
                  stroke: "#eaca85",
                  strokeWidth: 2,
                }),
              ]
            : c.points.length === 1
              ? [
                  node("circle", {
                    cx: 130 + c.points[0][0] * 52,
                    cy: 130 + c.points[0][2] * 52,
                    r: 3,
                    fill: "#efcf88",
                  }),
                ]
              : []),
        {
          tag: "text",
          attrs: {
            x: 130,
            y: 248,
            textAnchor: "middle",
            fill: "#eaca85",
            fontSize: 12,
          },
          children: ["Grid spacing: 0.5 units"],
        },
      ],
    };
  },
  trials: shapeSlicerTrials.map((trial) => ({
    ...trial,
    choices: [...trial.choices],
    held: [...trial.held],
  })),
  note: `${shapeSlicerCoreBoundary} Use the equal-scale straight-on section for size comparisons. ${shapeSlicerBoundary}`,
});
