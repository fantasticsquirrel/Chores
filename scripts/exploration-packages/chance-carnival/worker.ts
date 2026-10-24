import { buildChanceScene } from "./chanceScene";
import { disposeGroup } from "./tableGeometry";
import { probabilities, sampleOutcomes, fairnessDistance } from "./model";
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
        title: "Can fair chances give uneven results?",
        subtitle:
          "Compare theoretical probabilities with observed frequencies.",
        background: ["#efe4cc", "#ded0b3", "#baa483"],
      },
      { pizza: false },
    );
  disposeGroup(exhibit);
  const nodes: any[] = [
    {
      tag: "text",
      attrs: { x: 15, y: 24, fontSize: 16, fill: "#243b37" },
      children: ["Solid bars: observed. Outlined bars: theoretical."],
    },
  ];
  for (let n = 0; n < weights.length; n++) {
    const x = 40 + n * 105,
      p = chances[n],
      observed = total ? counts[n] / total : 0;
    nodes.push(
      {
        tag: "rect",
        attrs: {
          x,
          y: 200 - observed * 150,
          width: 28,
          height: observed * 150,
          fill: "#398b88",
        },
        children: [],
      },
      {
        tag: "rect",
        attrs: {
          x: x + 32,
          y: 200 - p * 150,
          width: 28,
          height: p * 150,
          fill: "none",
          stroke: "#9d6737",
          strokeWidth: 2,
        },
        children: [],
      },
      {
        tag: "text",
        attrs: { x, y: 225, fontSize: 12, fill: "#243b37" },
        children: [`${n + 1}: ${counts[n]} / ${(p * 100).toFixed(1)}%`],
      },
    );
  }
  return {
    animate: false,
    scene3d,
    vector: {
      viewBox: [0, 0, 700, 250],
      nodes,
      description: `${total} observed trials. Counts ${counts.join(", ")}; theoretical probabilities ${chances.map((p) => (p * 100).toFixed(1) + "%").join(", ")}.`,
    },
    shapes: [],
    description: `${die ? "Six die" : "Four spinner"} outcomes. ${fair ? "Equal" : "Unequal"} theoretical chances: ${chances.map((p) => (p * 100).toFixed(1) + "%").join(", ")}. ${total} trials; counts ${counts.join(", ")}. Last actual sampled outcome ${last === null ? "none" : last + 1}. ${valid ? `Largest observed/theory difference ${fairnessDistance(counts, weights).toFixed(3)} percentage points.` : "All weights are zero: no possible draw."}`,
    controls: [
      {
        id: "mode",
        label: "Probability device",
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
        label: "Outcome to edit",
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
        label: "Selected outcome weight",
        min: 0,
        max: 10,
        step: 1,
        value: weights[selected],
      },
      {
        id: "batch",
        label: "Trials per batch",
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
      { id: "run", label: "Run batch" },
      { id: "clear", label: "Clear sample" },
      { id: "trialSample", label: "Compare sample sizes" },
      { id: "trialWeight", label: "Change a weight" },
      { id: "predictYes", label: "Predict yes" },
      { id: "predictNo", label: "Predict no" },
      { id: "baseline", label: "Set baseline" },
      {
        id: "compare",
        label:
          trial === 0 ? "Extend to 1000 trials" : "Weight outcome 1 four times",
      },
    ],
    sections: [
      {
        heading: "1. Predict",
        text:
          trial === 0
            ? `Must equal chances produce equal counts in ten trials? ${prediction}`
            : `If one weight becomes four times larger, is that outcome guaranteed next? ${prediction}`,
        buttonIds: ["predictYes", "predictNo"],
      },
      {
        heading: "2. Compare",
        text:
          trial === 0
            ? "Use four equal weights. Record ten trials, then extend that same sample to 1000. Compare observed with theoretical bars."
            : "Start with four weights of 1. Set outcome 1 to 4, clear the old sample and compare fresh 1000 trials with new theoretical chances.",
        buttonIds: ["baseline", "compare"],
      },
      {
        heading: "3. Explain",
        text: "Finite samples can differ from theory. Independent trials do not make an overdue outcome more likely. More trials often improve the approximation, but not exactly or monotonically. Use both probabilities and counts as evidence.",
      },
    ],
    footnote:
      "Weights define theoretical probabilities; changing weights or device clears incompatible observations. The die’s top face and spinner pointer show the actual last sampled outcome. A weighted die is a probability model, not a physical prediction for a particular manufactured die.",
  };
}
const compact = createFrameCompactor();
self.onmessage = ({ data }) =>
  self.postMessage(compact(run(data), data.type === "reset"));
