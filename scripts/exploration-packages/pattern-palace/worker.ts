import { PatternWorkbench } from "./PatternWorkbench";
import { svgNodes } from "../shared/vector-author";
import { vertexFit, transformPoint } from "./model";
let sides = 5,
  copies = 3,
  rotation = 0,
  mirror = false,
  repeat = 5,
  trial = 0,
  prediction = "";
function run(i: any) {
  if (i.type === "reset") {
    sides = 5;
    copies = 3;
    rotation = 0;
    mirror = false;
    repeat = 5;
    trial = 0;
    prediction = "";
  }
  const key = i.control,
    value = i.values?.[key];
  if (i.type === "control" && Number.isFinite(value)) {
    if (key === "sides") sides = Math.round(value) + 3;
    if (key === "copies") copies = Math.max(1, Math.min(6, Math.round(value)));
    if (key === "rotation") rotation = Math.max(0, Math.min(345, value));
    if (key === "mirror") mirror = value === 1;
    if (key === "repeat") repeat = Math.max(1, Math.min(8, Math.round(value)));
  }
  if (key === "quarter") rotation = (rotation + 90) % 360;
  if (key === "trialFit" || key === "trialTransform") {
    trial = key === "trialFit" ? 0 : 1;
    prediction = "";
  }
  if (key === "predictYes") prediction = "Yes";
  if (key === "predictNo") prediction = "No";
  if (key === "baseline" && prediction) {
    if (trial === 0) {
      sides = 5;
      copies = 3;
    } else {
      rotation = 0;
      mirror = false;
    }
  }
  if (key === "compare" && prediction) {
    if (trial === 0) {
      sides = 4;
      copies = 4;
    } else {
      rotation = 90;
      mirror = true;
    }
  }
  const fit = vertexFit(sides, copies),
    marker = transformPoint(-28, -26, rotation, mirror),
    svgs = svgNodes(
      PatternWorkbench({ sides, copies, rotation, mirror, repeat }),
    );
  const transforms = [
    "translate(0 0)",
    "translate(660 50)",
    "translate(800 50)",
    "translate(660 280) scale(.32)",
  ];
  const nodes = svgs.map((svg, index) => ({
    tag: "g",
    attrs: { transform: transforms[index] ?? "translate(0 0)" },
    children: svg.children,
  }));
  nodes.push({
    tag: "g",
    attrs: { transform: "translate(660 30)" },
    children: [
      {
        tag: "text",
        attrs: { x: 0, y: 0, fill: "#263c35", fontSize: 16 },
        children: ["Original → transformed motif"],
      },
      {
        tag: "text",
        attrs: { x: 0, y: 230, fill: "#263c35", fontSize: 16 },
        children: [`${repeat} identical copies`],
      },
    ],
  } as any);
  return {
    animate: false,
    shapes: [],
    vector: {
      viewBox: [0, 0, 950, 560],
      nodes,
      description: `${copies} regular ${sides}-sided tiles: ${fit.angle}° each, gap ${fit.gap}°, overlap ${fit.overlap}°. Rotation ${rotation}°, reflection ${mirror ? "yes" : "no"}, marker (${marker.x.toFixed(1)},${marker.y.toFixed(1)}).`,
    },
    description: `Each interior angle ${fit.angle}°. ${copies} tiles occupy ${fit.angle * copies}°: ${fit.gap ? `${fit.gap}° gap` : fit.overlap ? `${fit.overlap}° overlap` : "exact 360° corner fit"}. Red marker at (${marker.x.toFixed(1)}, ${marker.y.toFixed(1)}) after ${mirror ? "reflection, then " : ""}${rotation}° rotation. Lengths and angles are preserved.`,
    controls: [
      {
        id: "sides",
        label: "Regular polygon",
        kind: "select",
        min: 0,
        max: 3,
        step: 1,
        value: sides - 3,
        options: ["Triangle", "Square", "Pentagon", "Hexagon"].map(
          (label, value) => ({ value, label }),
        ),
      },
      {
        id: "copies",
        label: "Tiles around one point",
        min: 1,
        max: 6,
        step: 1,
        value: copies,
      },
      {
        id: "rotation",
        label: "Motif rotation (°)",
        min: 0,
        max: 345,
        step: 15,
        value: rotation,
      },
      {
        id: "mirror",
        label: "Reflect left to right",
        kind: "toggle",
        min: 0,
        max: 1,
        step: 1,
        value: mirror ? 1 : 0,
      },
      {
        id: "repeat",
        label: "Repeated motifs",
        min: 1,
        max: 8,
        step: 1,
        value: repeat,
      },
    ],
    buttons: [
      { id: "quarter", label: "Turn a quarter turn" },
      { id: "trialFit", label: "Compare corner fit" },
      { id: "trialTransform", label: "Transform a motif" },
      { id: "predictYes", label: "Predict yes" },
      { id: "predictNo", label: "Predict no" },
      { id: "baseline", label: "Set baseline" },
      {
        id: "compare",
        label: trial === 0 ? "Compare four squares" : "Reflect, then turn 90°",
      },
    ],
    sections: [
      {
        heading: "1. Predict",
        text:
          trial === 0
            ? `Will three regular pentagons fill 360° around a point? ${prediction}`
            : `Will reflecting then turning change the motif’s lengths or angles? ${prediction}`,
        buttonIds: ["predictYes", "predictNo"],
      },
      {
        heading: "2. Compare",
        text:
          trial === 0
            ? "Compare three regular pentagons with four squares. Calculate each interior angle and the total at the corner."
            : "Compare the original asymmetric motif with a left-right reflection followed by 90° rotation. Follow the red marker and compare shapes.",
        buttonIds: ["baseline", "compare"],
      },
      {
        heading: "3. Explain",
        text: "A corner needs 360° without gap or overlap; that test alone does not prove a tiling extends across a plane. Rotations and reflections preserve lengths/angles, but can change direction and handedness. Why does an asymmetric marker help distinguish them?",
      },
    ],
    footnote:
      "Polygons in the corner test are regular: equal sides and angles. Conclusions about these regular shapes do not apply to every irregular polygon with the same number of sides. Reflection is applied before rotation.",
  };
}
self.onmessage = ({ data }) => self.postMessage(run(data));
