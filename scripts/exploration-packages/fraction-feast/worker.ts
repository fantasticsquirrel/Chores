import * as T from "three";
import { buildPizzaScene } from "./pizzaScene";
import { woodTexture, disposeGroup, type PizzaPlate } from "./tableGeometry";
import { addFractions, simplifyFraction } from "./model";
import { serializeTactile } from "../shared/tactile-scene";
import { createFrameCompactor } from "../shared/compact-frame";
const plate = (n: number, d: number): PizzaPlate => ({
  n,
  d,
  slices: Array.from({ length: n }, (_, i) => i),
});
let plates = [plate(1, 2), plate(2, 4)],
  active = 0,
  selected = 0,
  combined = false,
  prediction = "",
  trial = 0,
  stage = 0,
  mobile = false;
const choose = (p: number, slice: number) => {
  if (p < 0 || p >= plates.length || slice < 0 || slice >= plates[p].d) return;
  active = p;
  stage = 0;
  const v = plates[p],
    slices = v.slices.includes(slice)
      ? v.slices.filter((i) => i !== slice)
      : [...v.slices, slice];
  plates[p] = { ...v, n: slices.length, slices };
  combined = false;
};
function run(i: any) {
  if (i.type === "reset") {
    plates = [plate(1, 2), plate(2, 4)];
    active = 0;
    selected = 0;
    combined = false;
    prediction = "";
    trial = 0;
    stage = 0;
  }
  if (i.width) mobile = i.width < 600;
  const action = i.control,
    value = i.values?.[action];
  if (i.type === "control" && Number.isFinite(value)) {
    if (["active", "denominator", "numerator", "slice"].includes(action))
      stage = 0;
    if (action === "active") {
      active = Math.round(value);
    }
    if (action === "denominator") {
      const d = [2, 3, 4, 6, 8, 12, 16, 24][Math.round(value)];
      if (d) plates[active] = plate(Math.min(plates[active].n, d), d);
    }
    if (action === "numerator")
      plates[active] = plate(
        Math.min(plates[active].d, Math.max(0, Math.round(value))),
        plates[active].d,
      );
    if (action === "slice")
      selected = Math.max(
        0,
        Math.min(plates[active].d - 1, Math.round(value) - 1),
      );
    selected = Math.max(0, Math.min(selected, plates[active].d - 1));
    combined = false;
  }
  if (action === "toggleSlice") choose(active, selected);
  if (action === "split" && plates[active].d <= 12) {
    stage = 0;
    const p = plates[active];
    plates[active] = {
      n: p.n * 2,
      d: p.d * 2,
      slices: p.slices.flatMap((n) => [2 * n, 2 * n + 1]),
    };
    combined = false;
  }
  if (action === "combine") {
    combined = true;
    stage = 0;
  }
  if (action === "trialSplit" || action === "trialSum") {
    trial = action === "trialSplit" ? 0 : 1;
    prediction = "";
    stage = 0;
  }
  if (action === "predictSame")
    prediction = trial === 0 ? "Same amount" : "Fits one whole";
  if (action === "predictDifferent")
    prediction = trial === 0 ? "Different amount" : "Exceeds one whole";
  if (action === "baseline" && prediction) {
    plates =
      trial === 0 ? [plate(1, 2), plate(2, 4)] : [plate(3, 4), plate(2, 3)];
    active = 0;
    selected = 0;
    combined = false;
    stage = 1;
  }
  if (action === "compare" && prediction && stage === 1) {
    if (trial === 0) {
      plates = [plate(2, 4), plate(2, 4)];
    } else combined = true;
    stage = 2;
  }
  let exhibit = buildPizzaScene(plates, active, mobile);
  if (
    i.type === "pointer" &&
    i.pointer?.rayOrigin &&
    i.pointer.phase === "up"
  ) {
    exhibit.updateMatrixWorld(true);
    const ray = new T.Raycaster(
      new T.Vector3(...i.pointer.rayOrigin),
      new T.Vector3(...i.pointer.rayDirection).normalize(),
    );
    for (const hit of ray.intersectObject(exhibit, true)) {
      let o: T.Object3D | null = hit.object;
      while (o && o.userData.slice === undefined) o = o.parent;
      if (o) {
        choose(o.userData.plate, o.userData.slice);
        break;
      }
    }
    disposeGroup(exhibit);
    exhibit = buildPizzaScene(plates, active, mobile);
  }
  const wood = woodTexture();
  wood.wrapS = wood.wrapT = T.RepeatWrapping;
  wood.repeat.set(3, 2);
  const scene3d = serializeTactile(
    exhibit,
    {
      title: "How much is on your plate?",
      subtitle: "Compare equal-sized wholes and equal pieces.",
      background: ["#e8ddc8", "#d4c4a7", "#b9a58a"],
    },
    { pizza: true, mobile, wood },
  );
  disposeGroup(exhibit);
  wood.dispose();
  const [a, b] = plates,
    sum = addFractions(a.n, a.d, b.n, b.d),
    simple = simplifyFraction(plates[active].n, plates[active].d),
    relation =
      a.n * b.d === b.n * a.d
        ? "equal to"
        : a.n * b.d > b.n * a.d
          ? "greater than"
          : "less than";
  const whole = Math.floor(sum.numerator / sum.denominator),
    remainder = sum.numerator % sum.denominator;
  const vector = combined
    ? {
        viewBox: [0, 0, 720, 170],
        description: `Combined amount ${sum.numerator}/${sum.denominator}; ${whole} whole and ${remainder}/${sum.denominator}.`,
        nodes: [
          {
            tag: "text",
            attrs: { x: 20, y: 25, fill: "#263d35", fontSize: 18 },
            children: [
              `${a.n}/${a.d} + ${b.n}/${b.d} = ${sum.numerator}/${sum.denominator}`,
            ],
          },
          ...Array.from(
            { length: Math.max(1, Math.ceil(sum.numerator / sum.denominator)) },
            (_, w) => ({
              tag: "g",
              attrs: { transform: `translate(${20 + w * 340} 50)` },
              children: Array.from({ length: sum.denominator }, (_, j) => ({
                tag: "rect",
                attrs: {
                  x: (j * 300) / sum.denominator,
                  y: 0,
                  width: 300 / sum.denominator,
                  height: 80,
                  fill:
                    w * sum.denominator + j < sum.numerator
                      ? "#d49b43"
                      : "#eee5d1",
                  stroke: "#66573c",
                  strokeWidth: 1,
                },
                children: [],
              })),
            }),
          ),
        ],
      }
    : undefined;
  return {
    readouts: [
      { label: "Plate A", value: `${a.n}/${a.d}` },
      { label: "Plate B", value: `${b.n}/${b.d}` },
      { label: "Comparison", value: `A is ${relation} B` },
      ...(combined
        ? [
            {
              label: "Combined",
              value: `${sum.numerator}/${sum.denominator}`,
              detail: `${whole} whole plus ${remainder}/${sum.denominator}`,
            },
          ]
        : []),
    ],
    animate: false,
    pointer: true,
    pointerMode: "tap",
    scene3d,
    ...(vector ? { vector } : {}),
    shapes: [],
    description: `Plate A ${a.n}/${a.d}; plate B ${b.n}/${b.d}. A is ${relation} B. Active plate simplifies to ${simple.numerator}/${simple.denominator}. ${combined ? `Sum ${sum.numerator}/${sum.denominator}: ${whole} whole plus ${remainder}/${sum.denominator}.` : "Tap numbered slices or choose a slice number and toggle it."}`,
    controls: [
      {
        id: "active",
        label: "Active plate",
        kind: "select",
        min: 0,
        max: 1,
        step: 1,
        value: active,
        options: [
          { value: 0, label: "Plate A" },
          { value: 1, label: "Plate B" },
        ],
      },
      {
        id: "denominator",
        label: "Equal parts per whole",
        kind: "select",
        min: 0,
        max: 7,
        step: 1,
        value: [2, 3, 4, 6, 8, 12, 16, 24].indexOf(plates[active].d),
        options: [2, 3, 4, 6, 8, 12, 16, 24].map((d, value) => ({
          value,
          label: String(d),
        })),
      },
      {
        id: "numerator",
        label: "Selected slices",
        min: 0,
        max: plates[active].d,
        step: 1,
        value: plates[active].n,
      },
      {
        id: "slice",
        label: "Individual slice number",
        min: 1,
        max: plates[active].d,
        step: 1,
        value: Math.min(selected + 1, plates[active].d),
      },
    ],
    buttons: [
      { id: "toggleSlice", label: "Toggle chosen slice" },
      { id: "split", label: "Split each piece in two" },
      { id: "combine", label: "Combine portions" },
      { id: "trialSplit", label: "Equivalent fractions" },
      { id: "trialSum", label: "Add unlike fractions" },
      {
        id: "predictSame",
        label: trial === 0 ? "Predict same amount" : "Predict fits one whole",
      },
      {
        id: "predictDifferent",
        label:
          trial === 0
            ? "Predict different amount"
            : "Predict exceeds one whole",
      },
      { id: "baseline", label: "Set baseline" },
      {
        id: "compare",
        label: trial === 0 ? "Compare split pieces" : "Compare combined amount",
      },
    ],
    sections: [
      {
        heading: "1. Predict",
        text:
          trial === 0
            ? `Will splitting every selected piece change the amount? ${prediction}`
            : `Will combining 3/4 and 2/3 fit in one whole? ${prediction}`,
        buttonIds: ["predictSame", "predictDifferent"],
      },
      {
        heading: "2. Compare",
        text:
          trial === 0
            ? "Compare 1/2 and 2/4 on equal-size pizzas, then split the first portion’s pieces in two."
            : "Compare 3/4 and 2/3, then combine using equal-size twelfths. Count the amount beyond one whole.",
        buttonIds: ["baseline", "compare"],
      },
      {
        heading: "3. Explain",
        text: "Why must the pieces be equal and the whole sizes match? Splitting changes the count and denominator together, not the selected amount. Addition needs a shared unit and can exceed one whole.",
      },
    ],
    footnote:
      "Both pizzas represent equal-sized wholes, divided into equal-angle/equal-area pieces. Moving slices outward is a visual separation, not a change in portion size. Fractions are exact arithmetic; food textures do not affect the calculation.",
  };
}
const compact = createFrameCompactor();
self.onmessage = ({ data }) =>
  self.postMessage(compact(run(data), data.type === "reset"));
