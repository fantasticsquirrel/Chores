import { PatternWorkbench } from "./PatternWorkbench";
import { svgNodes } from "../shared/vector-author";
import { PATTERN_MARKER, patternVertexFit, rigidTransformPoint } from "./model";

type TransformPrediction = "turn" | "reflection" | "same" | "";
type CornerPrediction = "exact" | "gap" | "overlap" | "";

let sides = 5;
let copies = 3;
let transformation = 0;
let transformPrediction: TransformPrediction = "";
let cornerPrediction: CornerPrediction = "";
let transformCompared = false;
let cornerCompared = false;

const transformState = () => ({
  rotation: transformation === 1 ? 90 : transformation === 2 ? 180 : 0,
  mirror: transformation === 3,
  label:
    transformation === 1
      ? "90° clockwise turn"
      : transformation === 2
        ? "180° turn"
        : transformation === 3
          ? "vertical reflection"
          : "original position",
});

function reset() {
  sides = 5;
  copies = 3;
  transformation = 0;
  transformPrediction = "";
  cornerPrediction = "";
  transformCompared = false;
  cornerCompared = false;
}

function run(input: any) {
  if (input.type === "reset") reset();
  const key = input.control;
  const value = input.values?.[key];
  const unlocked = transformCompared && cornerCompared;

  if (input.type === "control" && unlocked && Number.isFinite(value)) {
    if (key === "sides")
      sides = Math.max(3, Math.min(6, Math.round(value) + 3));
    if (key === "copies") copies = Math.max(1, Math.min(8, Math.round(value)));
    if (key === "transformation")
      transformation = Math.max(0, Math.min(3, Math.round(value)));
  }

  if (key === "predictTurn") {
    transformPrediction = "turn";
    transformCompared = false;
    transformation = 0;
  }
  if (key === "predictReflection") {
    transformPrediction = "reflection";
    transformCompared = false;
    transformation = 0;
  }
  if (key === "predictSame") {
    transformPrediction = "same";
    transformCompared = false;
    transformation = 0;
  }
  if (key === "compareTransform" && transformPrediction) {
    transformCompared = true;
    transformation = 1;
  }
  if (key === "predictExact") {
    cornerPrediction = "exact";
    cornerCompared = false;
    sides = 5;
    copies = 3;
  }
  if (key === "predictGap") {
    cornerPrediction = "gap";
    cornerCompared = false;
    sides = 5;
    copies = 3;
  }
  if (key === "predictOverlap") {
    cornerPrediction = "overlap";
    cornerCompared = false;
    sides = 5;
    copies = 3;
  }
  if (key === "compareCorners" && cornerPrediction) {
    cornerCompared = true;
    sides = 5;
    copies = 4;
  }

  const nowUnlocked = transformCompared && cornerCompared;
  const transform = transformState();
  const fit = patternVertexFit(sides, copies)!;
  const marker = rigidTransformPoint(PATTERN_MARKER, {
    rotationDegreesClockwise: transform.rotation,
    reflectAcrossVertical: transform.mirror,
  })!;
  const mobileLayout = Number(input.viewportWidth) < 600;
  const svgs = svgNodes(
    PatternWorkbench({
      sides,
      copies,
      rotation: transform.rotation,
      mirror: transform.mirror,
      repeat: 5,
    }),
  );
  const transforms = mobileLayout
    ? [
        "translate(0 0)",
        "translate(90 590)",
        "translate(255 590)",
        "translate(420 590)",
        "translate(85 765) scale(.9)",
      ]
    : [
        "translate(0 0)",
        "translate(650 70)",
        "translate(770 70)",
        "translate(890 70)",
        "translate(660 300) scale(.32)",
      ];
  const nodes = svgs.map((svg, index) => ({
    tag: "g",
    attrs: { transform: transforms[index] ?? "translate(0 0)" },
    children: svg.children,
  }));
  nodes.push({
    tag: "g",
    attrs: {
      transform: mobileLayout ? "translate(55 565)" : "translate(660 35)",
    },
    children: [
      {
        tag: "text",
        attrs: { x: 0, y: 0, fill: "#263c35", fontSize: 16 },
        children: ["Original · 90° clockwise · vertical reflection"],
      },
      {
        tag: "text",
        attrs: {
          x: 0,
          y: mobileLayout ? 185 : 250,
          fill: "#263c35",
          fontSize: 14,
        },
        children: [
          `Point M: ${Math.abs(marker.x)} ${marker.x < 0 ? "left" : "right"}, ${Math.abs(marker.y)} ${marker.y < 0 ? "up" : "down"}`,
        ],
      },
    ],
  } as any);

  const transformFeedback = transformCompared
    ? `${transformPrediction === "reflection" ? "The evidence matches your prediction." : "The evidence differs from your prediction."} Quarter-turn: M is 18 right and 30 up. Reflection: M is 30 right and 18 up. M moved farther right after the reflection. Changed: transformation. Held: motif dimensions · center · marked point M. Corresponding lengths and angles stay equal.`
    : "Choose which operation moves point M farther right. The comparison button stays locked until you predict.";
  const cornerFeedback = cornerCompared
    ? `${cornerPrediction === "overlap" ? "The evidence matches your prediction." : "The evidence differs from your prediction."} 3 × 108° = 324°, leaving 36°. 4 × 108° = 432°, so the fourth pentagon creates a 72° overlap. Changed: number of pentagons. Held: regular shape · side length · 108° interior angle · meeting point.`
    : "Predict what happens when one same-size regular pentagon is added. The comparison button stays locked until you predict.";
  const fitResult =
    fit.relation === "gap"
      ? `${fit.gapAngle}° gap`
      : fit.relation === "overlap"
        ? `${fit.overlapAngle}° overlap`
        : "exact 360° fit";

  return {
    animate: false,
    shapes: [],
    vector: {
      viewBox: mobileLayout ? [0, 0, 640, 880] : [0, 0, 1030, 580],
      nodes,
      description: `${copies} regular ${sides}-sided tiles have ${fit.interiorAngle}° corners and total ${fit.occupiedAngle}°: ${fitResult}. Motif image: ${transform.label}; point M is ${Math.abs(marker.x)} ${marker.x < 0 ? "left" : "right"} and ${Math.abs(marker.y)} ${marker.y < 0 ? "up" : "down"} from center.`,
    },
    description:
      !transformPrediction && !cornerPrediction
        ? "Choose a prediction to begin. Compare one changed variable while the named shape, size and center stay fixed."
        : `Corner calculation: ${copies} × ${fit.interiorAngle}° = ${fit.occupiedAngle}° · ${fitResult}. Current motif: ${transform.label}.`,
    controls: nowUnlocked
      ? [
          {
            id: "sides",
            label: "Regular tile shape",
            kind: "select",
            min: 0,
            max: 3,
            step: 1,
            value: sides - 3,
            options: [
              "Equilateral triangle",
              "Square",
              "Regular pentagon",
              "Regular hexagon",
            ].map((label, optionValue) => ({ value: optionValue, label })),
          },
          {
            id: "copies",
            label: "Tiles around one point",
            min: 1,
            max: 8,
            step: 1,
            value: copies,
          },
          {
            id: "transformation",
            label: "Motif transformation",
            kind: "select",
            min: 0,
            max: 3,
            step: 1,
            value: transformation,
            options: [
              "Original",
              "90° clockwise turn",
              "180° turn",
              "Vertical reflection",
            ].map((label, optionValue) => ({ value: optionValue, label })),
          },
        ]
      : [],
    buttons: [
      { id: "predictTurn", label: "Quarter-turn" },
      { id: "predictReflection", label: "Reflection" },
      { id: "predictSame", label: "Same horizontal position" },
      {
        id: "compareTransform",
        label: "Compare the two transformations",
        disabled: !transformPrediction,
      },
      { id: "predictExact", label: "Exact fit" },
      { id: "predictGap", label: "Still a gap" },
      { id: "predictOverlap", label: "72° overlap" },
      {
        id: "compareCorners",
        label: "Compare 3 and 4 pentagons",
        disabled: !cornerPrediction,
      },
    ],
    sections: [
      {
        heading: "1 · Turn or reflect?",
        text: transformFeedback,
        buttonIds: [
          "predictTurn",
          "predictReflection",
          "predictSame",
          "compareTransform",
        ],
      },
      {
        heading: "2 · Add one pentagon",
        text: cornerFeedback,
        buttonIds: [
          "predictExact",
          "predictGap",
          "predictOverlap",
          "compareCorners",
        ],
      },
      {
        heading: "Explore one change at a time",
        text: nowUnlocked
          ? "The controls are unlocked. Reset a control before a new comparison; use the corner total and point M coordinates as evidence."
          : "Complete both prediction-first comparisons to unlock the regular-polygon and motif controls.",
      },
    ],
    footnote:
      "Every corner tile shown is a regular polygon. A 360° fit at one observed point is necessary for this local arrangement, but a finite example alone does not prove a rule extends across the plane. Irregular polygons can behave differently. Reflection is across the vertical line; positive SVG rotation appears clockwise.",
  };
}

self.onmessage = ({ data }) => self.postMessage(run(data));
