import * as T from "three";
import { buildPizzaScene } from "./pizzaScene";
import { woodTexture, disposeGroup, type PizzaPlate } from "./tableGeometry";
import { addFractionParts, simplifyFraction } from "./model";
import { serializeTactile } from "../shared/tactile-scene";
import { createFrameCompactor } from "../shared/compact-frame";

type EquivalentPrediction = "" | "more" | "same" | "less";
type AdditionPrediction = "" | "below" | "one" | "above";
const denominators = [2, 3, 4, 6, 8, 12, 16, 24];
const plate = (n: number, d: number): PizzaPlate => ({
  n,
  d,
  slices: Array.from({ length: n }, (_, index) => index),
});

let plates: [PizzaPlate, PizzaPlate],
  active: number,
  selected: number,
  combined: boolean,
  equivalentPrediction: EquivalentPrediction,
  additionPrediction: AdditionPrediction,
  equivalentComplete: boolean,
  additionComplete: boolean,
  mobile: boolean;

function reset() {
  plates = [plate(1, 2), plate(2, 4)];
  active = 0;
  selected = 0;
  combined = false;
  equivalentPrediction = "";
  additionPrediction = "";
  equivalentComplete = false;
  additionComplete = false;
  mobile = false;
}
reset();

const showEquivalentBefore = () => {
  plates = [plate(1, 2), plate(2, 4)];
  active = 0;
  selected = 0;
  combined = false;
};
const showEquivalentAfter = () => {
  plates = [plate(2, 4), plate(2, 4)];
  active = 0;
  selected = 0;
  combined = false;
};
const showAdditionParts = () => {
  plates = [plate(2, 3), plate(3, 4)];
  active = 0;
  selected = 0;
  combined = false;
};
const showAdditionTotal = () => {
  showAdditionParts();
  combined = true;
};
const choose = (plateIndex: number, slice: number) => {
  if (
    plateIndex < 0 ||
    plateIndex >= plates.length ||
    slice < 0 ||
    slice >= plates[plateIndex].d
  )
    return;
  active = plateIndex;
  const value = plates[plateIndex];
  const slices = value.slices.includes(slice)
    ? value.slices.filter((index) => index !== slice)
    : [...value.slices, slice].sort((a, b) => a - b);
  plates[plateIndex] = { ...value, n: slices.length, slices };
  combined = false;
};

function run(input: any) {
  if (input.type === "reset") reset();
  if (input.width) mobile = input.width < 600;
  const key = input.control;
  const value = input.values?.[key];
  const freeExploration = equivalentComplete && additionComplete;

  if (input.type === "control" && freeExploration && Number.isFinite(value)) {
    if (key === "active") active = Math.max(0, Math.min(1, Math.round(value)));
    if (key === "denominator") {
      const denominator = denominators[Math.round(value)];
      if (denominator)
        plates[active] = plate(
          Math.min(plates[active].n, denominator),
          denominator,
        );
    }
    if (key === "numerator")
      plates[active] = plate(
        Math.min(plates[active].d, Math.max(0, Math.round(value))),
        plates[active].d,
      );
    if (key === "slice")
      selected = Math.max(
        0,
        Math.min(plates[active].d - 1, Math.round(value) - 1),
      );
    selected = Math.max(0, Math.min(selected, plates[active].d - 1));
    if (["active", "denominator", "numerator", "slice"].includes(key))
      combined = false;
  }
  if (
    key === "equivalentMore" ||
    key === "equivalentSame" ||
    key === "equivalentLess"
  ) {
    equivalentPrediction = key
      .replace("equivalent", "")
      .toLowerCase() as EquivalentPrediction;
    equivalentComplete = false;
    showEquivalentBefore();
  }
  if (key === "compareEquivalent" && equivalentPrediction) {
    equivalentComplete = true;
    showEquivalentAfter();
  }
  if (
    key === "additionBelow" ||
    key === "additionOne" ||
    key === "additionAbove"
  ) {
    additionPrediction = key
      .replace("addition", "")
      .toLowerCase() as AdditionPrediction;
    additionComplete = false;
    showAdditionParts();
  }
  if (key === "compareAddition" && additionPrediction) {
    additionComplete = true;
    showAdditionTotal();
  }
  if (key === "showEquivalentBefore") showEquivalentBefore();
  if (key === "showEquivalentAfter") showEquivalentAfter();
  if (key === "showAdditionParts") showAdditionParts();
  if (key === "showAdditionTotal") showAdditionTotal();
  if (key === "toggleSlice" && freeExploration) choose(active, selected);
  if (key === "split" && freeExploration && plates[active].d <= 12) {
    const current = plates[active];
    plates[active] = {
      n: current.n * 2,
      d: current.d * 2,
      slices: current.slices.flatMap((slice) => [slice * 2, slice * 2 + 1]),
    };
    combined = false;
  }
  if (key === "combine" && freeExploration) combined = !combined;

  let exhibit = buildPizzaScene(plates, active, mobile);
  if (
    input.type === "pointer" &&
    input.pointer?.rayOrigin &&
    input.pointer.phase === "up" &&
    equivalentComplete &&
    additionComplete
  ) {
    exhibit.updateMatrixWorld(true);
    const ray = new T.Raycaster(
      new T.Vector3(...input.pointer.rayOrigin),
      new T.Vector3(...input.pointer.rayDirection).normalize(),
    );
    for (const hit of ray.intersectObject(exhibit, true)) {
      let object: T.Object3D | null = hit.object;
      while (object && object.userData.slice === undefined)
        object = object.parent;
      if (object) {
        choose(object.userData.plate, object.userData.slice);
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
      title: "Fractions need a fair whole",
      subtitle: "Equal-area pizzas · equal pieces within each whole",
      background: ["#e8ddc8", "#d4c4a7", "#b9a58a"],
    },
    { pizza: true, mobile, wood },
  );
  disposeGroup(exhibit);
  wood.dispose();

  const [left, right] = plates;
  const addition = addFractionParts(left.n, left.d, right.n, right.d)!;
  const simple = simplifyFraction(plates[active].n, plates[active].d);
  const relation =
    left.n * right.d === right.n * left.d
      ? "equal to"
      : left.n * right.d > right.n * left.d
        ? "greater than"
        : "less than";
  const mixed = addition.remainder.numerator
    ? `${addition.wholeCount} whole and ${addition.remainder.numerator}/${addition.remainder.denominator}`
    : `${addition.wholeCount} whole${addition.wholeCount === 1 ? "" : "s"}`;
  const vector = combined
    ? {
        viewBox: [0, 0, 720, 170],
        description: `Exact common-denominator model. ${left.n}/${left.d} becomes ${addition.leftCommonNumerator}/${addition.commonDenominator}; ${right.n}/${right.d} becomes ${addition.rightCommonNumerator}/${addition.commonDenominator}. Total ${addition.commonSumNumerator}/${addition.commonDenominator}, or ${mixed}.`,
        nodes: [
          {
            tag: "text",
            attrs: { x: 20, y: 25, fill: "#263d35", fontSize: 18 },
            children: [
              `${addition.leftCommonNumerator}/${addition.commonDenominator} + ${addition.rightCommonNumerator}/${addition.commonDenominator} = ${addition.commonSumNumerator}/${addition.commonDenominator}`,
            ],
          },
          ...Array.from(
            {
              length: Math.max(
                1,
                Math.ceil(
                  addition.commonSumNumerator / addition.commonDenominator,
                ),
              ),
            },
            (_, whole) => ({
              tag: "g",
              attrs: { transform: `translate(${20 + whole * 340} 50)` },
              children: Array.from(
                { length: addition.commonDenominator },
                (_, piece) => ({
                  tag: "rect",
                  attrs: {
                    x: (piece * 300) / addition.commonDenominator,
                    y: 0,
                    width: 300 / addition.commonDenominator,
                    height: 80,
                    fill:
                      whole * addition.commonDenominator + piece <
                      addition.commonSumNumerator
                        ? "#d49b43"
                        : "#eee5d1",
                    stroke: "#66573c",
                    strokeWidth: 1,
                  },
                  children: [],
                }),
              ),
            }),
          ),
        ],
      }
    : undefined;
  const unlocked = equivalentComplete && additionComplete;

  return {
    readouts: [
      { label: "Plate A", value: `${left.n}/${left.d}` },
      { label: "Plate B", value: `${right.n}/${right.d}` },
      { label: "Comparison", value: `A is ${relation} B` },
      ...(combined
        ? [
            {
              label: "Exact total",
              value: `${addition.commonSumNumerator}/${addition.commonDenominator}`,
              detail: mixed,
            },
          ]
        : []),
    ],
    animate: false,
    pointer: unlocked,
    pointerMode: "tap",
    scene3d,
    ...(vector ? { vector } : {}),
    shapes: [],
    description: `Plate A ${left.n}/${left.d}; plate B ${right.n}/${right.d}. A is ${relation} B. Active plate simplifies to ${simple.numerator}/${simple.denominator}. ${combined ? `Sum ${addition.commonSumNumerator}/${addition.commonDenominator}: ${mixed}.` : "Unselected spaces keep each whole visible."}`,
    controls: unlocked
      ? [
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
            max: denominators.length - 1,
            step: 1,
            value: denominators.indexOf(plates[active].d),
            options: denominators.map((denominator, value) => ({
              value,
              label: String(denominator),
            })),
          },
          {
            id: "numerator",
            label: "Selected pieces",
            min: 0,
            max: plates[active].d,
            step: 1,
            value: plates[active].n,
          },
          {
            id: "slice",
            label: "Individual piece number",
            min: 1,
            max: plates[active].d,
            step: 1,
            value: Math.min(selected + 1, plates[active].d),
          },
        ]
      : [],
    buttons: [
      { id: "equivalentMore", label: "More pizza" },
      { id: "equivalentSame", label: "The same amount" },
      { id: "equivalentLess", label: "Less pizza" },
      {
        id: "compareEquivalent",
        label: "Compare 1/2 with 2/4",
        disabled: !equivalentPrediction || equivalentComplete,
      },
      { id: "additionBelow", label: "Less than one whole" },
      { id: "additionOne", label: "Exactly one whole" },
      { id: "additionAbove", label: "More than one whole" },
      {
        id: "compareAddition",
        label: "Combine 2/3 and 3/4",
        disabled: !additionPrediction || additionComplete,
      },
      ...(equivalentComplete
        ? [
            { id: "showEquivalentBefore", label: "Show 1/2 before split" },
            { id: "showEquivalentAfter", label: "Show 2/4 after split" },
          ]
        : []),
      ...(additionComplete
        ? [
            { id: "showAdditionParts", label: "Show separate portions" },
            { id: "showAdditionTotal", label: "Show combined total" },
          ]
        : []),
      ...(unlocked
        ? [
            { id: "toggleSlice", label: "Toggle chosen piece" },
            { id: "split", label: "Split each piece in two" },
            {
              id: "combine",
              label: combined ? "Separate portions" : "Combine portions",
            },
          ]
        : []),
    ],
    sections: [
      {
        heading: "1. Split the same amount",
        text: equivalentComplete
          ? `The evidence ${equivalentPrediction === "same" ? "matches" : "differs from"} your prediction. 1/2 = 2/4. Changed: piece count · piece size. Held: whole area · selected amount. Twice as many selected pieces are each half as large.`
          : "Predict whether splitting every piece in two changes the selected amount while whole area and selected area stay fixed.",
        buttonIds: [
          "equivalentMore",
          "equivalentSame",
          "equivalentLess",
          "compareEquivalent",
          ...(equivalentComplete
            ? ["showEquivalentBefore", "showEquivalentAfter"]
            : []),
        ],
      },
      {
        heading: "2. Add unlike fractions",
        text: additionComplete
          ? `The evidence ${additionPrediction === "above" ? "matches" : "differs from"} your prediction. 2/3 = 8/12; 3/4 = 9/12. 8/12 + 9/12 = 17/12 = 1 whole and 5/12. Twelfths are the shared unit.`
          : "Predict whether 2/3 plus 3/4 from equal-area wholes fits in one whole, then combine using equal twelfths.",
        buttonIds: [
          "additionBelow",
          "additionOne",
          "additionAbove",
          "compareAddition",
          ...(additionComplete
            ? ["showAdditionParts", "showAdditionTotal"]
            : []),
        ],
      },
      {
        heading: unlocked
          ? "3. Explore fractions"
          : "Complete both comparisons to unlock exploration",
        text: unlocked
          ? "Keep the whole areas equal. Change one input, then compare the exact fractions."
          : "Each fixed trial identifies what changes and what stays fixed.",
        buttonIds: unlocked ? ["toggleSlice", "split", "combine"] : [],
      },
    ],
    footnote:
      "Model boundary: both pizzas represent the same whole area and use equal-area pieces within each whole. Textures, toppings, depth, and lighting do not affect the exact arithmetic. This package keeps its own sandboxed model copy, checked against the shared model during repository tests.",
  };
}

const compact = createFrameCompactor();
self.onmessage = ({ data }) =>
  self.postMessage(compact(run(data), data.type === "reset"));
