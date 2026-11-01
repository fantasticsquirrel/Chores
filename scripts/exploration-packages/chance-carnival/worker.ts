import { buildChanceScene } from "./chanceScene";
import { disposeGroup } from "./tableGeometry";
import { probabilities, sampleOutcomes } from "./model";
import { serializeTactile } from "../shared/tactile-scene";
import { createFrameCompactor } from "../shared/compact-frame";
let die = false,
  weights = [1, 1, 1, 1],
  counts = [0, 0, 0, 0],
  selected = 0,
  batch = 10,
  last: number | null = null,
  trial = 0,
  stage = 0,
  prediction = "";
const clear = () => {
  counts = weights.map(() => 0);
  last = null;
};
const sample = (n: number) => {
  if (!weights.some((w) => w > 0)) return;
  const earlier = sampleOutcomes(weights, n - 1),
    final = sampleOutcomes(weights, 1);
  last = final.findIndex((v) => v === 1);
  counts = counts.map((v, i) => v + earlier[i] + final[i]);
};
function run(i: any) {
  if (i.type === "reset") {
    die = false;
    weights = [1, 1, 1, 1];
    counts = [0, 0, 0, 0];
    selected = 0;
    batch = 10;
    last = null;
    trial = 0;
    stage = 0;
    prediction = "";
  }
  const key = i.control,
    value = i.values?.[key];
  if (i.type === "control" && Number.isFinite(value)) {
    if (["mode", "selected", "weight", "batch"].includes(key)) stage = 0;
    if (key === "mode") {
      die = value === 1;
      weights = Array(die ? 6 : 4).fill(1);
      selected = 0;
      clear();
    }
    if (key === "selected")
      selected = Math.min(weights.length - 1, Math.max(0, Math.round(value)));
    if (key === "weight") {
      weights[selected] = Math.min(10, Math.max(0, Math.round(value)));
      clear();
    }
    if (key === "batch") batch = [1, 10, 100, 1000][Math.round(value)] ?? 10;
  }
  if (key === "one") {
    sample(1);
    stage = 0;
  }
  if (key === "run") {
    sample(batch);
    stage = 0;
  }
  if (key === "clear") {
    clear();
    stage = 0;
  }
  if (key === "trialSample" || key === "trialWeight") {
    trial = key === "trialSample" ? 0 : 1;
    prediction = "";
    stage = 0;
  }
  if (key === "predictYes") prediction = "Yes";
  if (key === "predictNo") prediction = "No";
  if (key === "baseline" && prediction) {
    die = false;
    weights = [1, 1, 1, 1];
    selected = 0;
    clear();
    if (trial === 0) sample(10);
    stage = 1;
  }
  if (key === "compare" && prediction && stage === 1) {
    if (trial === 0) sample(990);
    else {
      weights = [4, 1, 1, 1];
      clear();
      sample(1000);
    }
    stage = 2;
  }
  const chances = probabilities(weights),
    total = counts.reduce((a, b) => a + b, 0),
    valid = weights.some((w) => w > 0),
    fair = valid && weights.every((w) => w === weights[0]);
  const exhibit = buildChanceScene(chances, die, last, selected),
    scene3d = serializeTactile(
      exhibit,
      {
        title: "Chance results",
        subtitle: "Compare observed and expected shares.",
        background: ["#f8f4e7", "#e7ddc4", "#c9b78f"],
      },
      { pizza: false },
    );
  disposeGroup(exhibit);
  const palette = [
    "#c76646",
    "#2f8782",
    "#8063a5",
    "#bd8f28",
    "#618d53",
    "#4f789f",
  ];
  const nodes: any[] = [
    {
      tag: "text",
      attrs: { x: 22, y: 28, fontSize: 16, fill: "#193f3a" },
      children: ["Bar: observed · mark: expected"],
    },
  ];
  for (let n = 0; n < weights.length; n++) {
    const y = 48 + n * 43,
      p = chances[n],
      observed = total ? counts[n] / total : 0;
    nodes.push(
      {
        tag: "circle",
        attrs: { cx: 34, cy: y + 10, r: 13, fill: palette[n] },
        children: [],
      },
      {
        tag: "text",
        attrs: {
          x: 34,
          y: y + 15,
          fontSize: 12,
          fontWeight: "700",
          textAnchor: "middle",
          fill: "#fffdf5",
        },
        children: [String(n + 1)],
      },
      {
        tag: "rect",
        attrs: {
          x: 62,
          y: y + 2,
          width: 430,
          height: 16,
          rx: 8,
          fill: "#e2e5d9",
          stroke: "#b5bda9",
          strokeWidth: 1,
        },
        children: [],
      },
      {
        tag: "rect",
        attrs: {
          x: 62,
          y: y + 2,
          width: observed * 430,
          height: 16,
          rx: 8,
          fill: palette[n],
        },
        children: [],
      },
      {
        tag: "rect",
        attrs: {
          x: 60 + p * 430,
          y: y,
          width: 4,
          height: 20,
          fill: "#173f38",
        },
        children: [],
      },
      {
        tag: "text",
        attrs: { x: 510, y: y + 15, fontSize: 12, fill: "#243b37" },
        children: [
          `${n + 1}: ${total ? ((counts[n] / total) * 100).toFixed(1) + "%" : "—"} · expected ${(p * 100).toFixed(1)}%`,
        ],
      },
    );
  }
  return {
    animate: false,
    scene3d,
    vector: {
      viewBox: [0, 0, 700, 330],
      nodes,
      description: `${total} trials. Observed shares ${counts.map((count) => (total ? ((count / total) * 100).toFixed(1) + "%" : "—")).join(", ")}; expected shares ${chances.map((p) => (p * 100).toFixed(1) + "%").join(", ")}.`,
    },
    shapes: [],
    description: `${die ? "Six die" : "Four spinner"} outcomes. ${fair ? "Equal" : "Unequal"} expected chances. ${total} trials. Last draw: ${last === null ? "none" : last + 1}. ${valid ? chances.map((chance, index) => `${index + 1}: ${total ? ((counts[index] / total) * 100).toFixed(1) + "%" : "—"} observed · expected ${(chance * 100).toFixed(1)}%`).join("; ") : "All weights are zero: no possible draw."}`,
    controls: [
      {
        id: "mode",
        label: "Device",
        kind: "select",
        min: 0,
        max: 1,
        step: 1,
        value: die ? 1 : 0,
        options: [
          { value: 0, label: "Four-outcome spinner" },
          { value: 1, label: "Six-outcome die" },
        ],
      },
      {
        id: "selected",
        label: "Outcome",
        kind: "select",
        min: 0,
        max: weights.length - 1,
        step: 1,
        value: selected,
        options: weights.map((_, value) => ({
          value,
          label: `Outcome ${value + 1}`,
        })),
      },
      {
        id: "weight",
        label: "Outcome weight",
        min: 0,
        max: 10,
        step: 1,
        value: weights[selected],
      },
      {
        id: "batch",
        label: "Trials to add",
        kind: "select",
        min: 0,
        max: 3,
        step: 1,
        value: [1, 10, 100, 1000].indexOf(batch),
        options: [1, 10, 100, 1000].map((n, value) => ({
          value,
          label: String(n),
        })),
      },
    ],
    buttons: [
      { id: "one", label: "Run one trial" },
      { id: "run", label: "Add trials" },
      { id: "clear", label: "Clear sample" },
      { id: "trialSample", label: "Compare sample sizes" },
      { id: "trialWeight", label: "Change a weight" },
      { id: "predictYes", label: "Yes" },
      { id: "predictNo", label: "No" },
      { id: "baseline", label: "Run first sample" },
      {
        id: "compare",
        label: trial === 0 ? "Extend to 1,000 trials" : "Run weighted sample",
      },
    ],
    sections: [
      {
        heading: "1. Predict",
        text:
          trial === 0
            ? `Do equal chances require equal counts in 10 trials? ${prediction}`
            : `If outcome 1 has four times the weight, is it guaranteed next? ${prediction}`,
        buttonIds: ["predictYes", "predictNo"],
      },
      {
        heading: "2. Compare",
        text:
          trial === 0
            ? "Keep four equal weights. Run 10 trials, then extend the same sample to 1,000."
            : "Start with four weights of 1. Change outcome 1 to 4, then run a fresh 1,000-trial sample.",
        buttonIds: ["baseline", "compare"],
      },
      {
        heading: "3. Explain",
        text: "Compare observed and expected percentages. Equal chances can give uneven counts. Larger samples usually settle closer, but any one larger sample can be farther away. Past draws do not change the next independent draw.",
      },
    ],
    footnote:
      "Changing the device or a weight clears the sample. This is a computer model, not a physical spin, roll, or loaded-die prediction.",
  };
}
const compact = createFrameCompactor();
self.onmessage = ({ data }) =>
  self.postMessage(compact(run(data), data.type === "reset"));
