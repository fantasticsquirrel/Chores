import * as T from "three";
import { createFrameCompactor } from "../shared/compact-frame";
import { physicalScene, serializePhysical } from "../shared/physical-scene";
import { createBridgeScene } from "./bridgeScene";
import {
  BRIDGE_DEFAULT_INPUTS,
  BRIDGE_LOAD_COMPARISON,
  BRIDGE_POSITION_COMPARISON,
  BRIDGE_VISUAL_MAX_DEFLECTION_MILLIMETERS,
  bridgeActivity,
  bridgeDeflectionMillimetersAt,
  bridgeDeflectionVisualFraction,
  compareBridgeTrials,
  normalizeBridgeInputs,
  type BridgeInputs,
} from "./model";

type PositionPrediction = "" | "left" | "right" | "equal";
type LoadPrediction = "" | "both-double" | "moment-only" | "quadruple";

let inputs: BridgeInputs = normalizeBridgeInputs(BRIDGE_DEFAULT_INPUTS);
let phase = 0;
let playing = false;
let positionPrediction: PositionPrediction = "";
let loadPrediction: LoadPrediction = "";
let positionComplete = false;
let loadComplete = false;

const positionEvidence = BRIDGE_POSITION_COMPARISON.map(bridgeActivity);
const loadEvidence = BRIDGE_LOAD_COMPARISON.map(bridgeActivity);
const positionVariables = compareBridgeTrials(...BRIDGE_POSITION_COMPARISON);
const loadVariables = compareBridgeTrials(...BRIDGE_LOAD_COMPARISON);

function reset() {
  inputs = normalizeBridgeInputs(BRIDGE_DEFAULT_INPUTS);
  phase = 0;
  playing = false;
  positionPrediction = "";
  loadPrediction = "";
  positionComplete = false;
  loadComplete = false;
}

function showTrial(trial: BridgeInputs) {
  inputs = normalizeBridgeInputs(trial);
  phase = 0;
  playing = false;
}

function updateFromControl(key: string, value: number) {
  if (!(positionComplete && loadComplete) || !Number.isFinite(value)) return;
  if (key === "position") inputs.loadPositionPercent = value;
  if (key === "load") inputs.pointLoadKilonewtons = value;
  if (key === "rigidity")
    inputs.flexuralRigidityMeganewtonMetersSquared = value;
  if (/^brace[0-3]$/.test(key)) {
    const braceIndex = Number(key.slice(-1));
    inputs = {
      ...inputs,
      braces: inputs.braces.map((brace, index) =>
        index === braceIndex ? value === 1 : brace,
      ),
    };
  }
  if (key === "phase") {
    phase = value / 100;
    playing = false;
  }
  inputs = normalizeBridgeInputs(inputs);
}

function formatPositionEvidence(
  label: string,
  evidence: (typeof positionEvidence)[number],
) {
  return `${label}: left ${evidence.leftReactionKilonewtons.toFixed(1)} kN · right ${evidence.rightReactionKilonewtons.toFixed(1)} kN · peak moment ${evidence.peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m · deflection at load ${evidence.deflectionAtLoadMillimeters.toFixed(2)} mm`;
}

function run(input: any) {
  if (input.type === "reset") reset();
  const key = input.control as string | undefined;
  const value = key ? input.values?.[key] : undefined;
  if (input.type === "control" && Number.isFinite(value))
    updateFromControl(key ?? "", value);

  if (key === "positionLeft") {
    positionPrediction = "left";
    positionComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "positionRight") {
    positionPrediction = "right";
    positionComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "positionEqual") {
    positionPrediction = "equal";
    positionComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "comparePosition" && positionPrediction) {
    positionComplete = true;
    showTrial(BRIDGE_POSITION_COMPARISON[1]);
  }
  if (key === "showPositionCenter") showTrial(BRIDGE_POSITION_COMPARISON[0]);
  if (key === "showPositionLeft") showTrial(BRIDGE_POSITION_COMPARISON[1]);

  if (key === "loadBothDouble") {
    loadPrediction = "both-double";
    loadComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "loadMomentOnly") {
    loadPrediction = "moment-only";
    loadComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "loadQuadruple") {
    loadPrediction = "quadruple";
    loadComplete = false;
    phase = 0;
    playing = false;
  }
  if (key === "compareLoad" && loadPrediction) {
    loadComplete = true;
    showTrial(BRIDGE_LOAD_COMPARISON[1]);
  }
  if (key === "showLoadLight") showTrial(BRIDGE_LOAD_COMPARISON[0]);
  if (key === "showLoadHeavy") showTrial(BRIDGE_LOAD_COMPARISON[1]);

  const freeExploration = positionComplete && loadComplete;
  if (freeExploration && key === "play") playing = !playing;
  if (freeExploration && key === "start") {
    phase = 0;
    playing = false;
  }
  if (playing && input.dt > 0) phase = (phase + input.dt / 4.5) % 1;

  if (
    freeExploration &&
    input.type === "pointer" &&
    Array.isArray(input.pointer?.rayOrigin) &&
    Array.isArray(input.pointer?.rayDirection)
  ) {
    const ray = new T.Raycaster(
      new T.Vector3(...input.pointer.rayOrigin),
      new T.Vector3(...input.pointer.rayDirection).normalize(),
    );
    const point = new T.Vector3();
    if (
      input.pointer.phase !== "up" &&
      ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -1.5), point)
    )
      inputs = normalizeBridgeInputs({
        ...inputs,
        loadPositionPercent: Math.round((point.x + 5) * 10),
      });
  }

  const result = bridgeActivity(inputs);
  const model = physicalScene(
    createBridgeScene({
      kind: "bridge",
      material: "timber",
      braces: result.inputs.braces,
      load: result.inputs.pointLoadKilonewtons,
      position: result.inputs.loadPositionPercent,
      utilization: result.braceReferenceUseIndex,
      leftReaction: result.leftReactionKilonewtons,
      rightReaction: result.rightReactionKilonewtons,
      progress: phase,
      deflectionMillimeters: result.deflectionAtLoadMillimeters,
    }),
    "bridge",
  );
  const scene3d = serializePhysical(model, {
    title: `${result.inputs.pointLoadKilonewtons} kN at ${result.inputs.loadPositionPercent}% of span`,
    subtitle:
      "Static equivalent-beam evidence; the timber truss is illustrative.",
    background: ["#10212b", "#142b35", "#10212b"],
  });
  model.dispose();

  const deflectionPoints = Array.from({ length: 41 }, (_, index) => {
    const xMeters = (index / 40) * result.spanMeters;
    return bridgeDeflectionMillimetersAt(result.inputs, xMeters);
  });
  const profile = deflectionPoints
    .map(
      (deflection, index) =>
        `${18 + (index / 40) * 684},${28 + bridgeDeflectionVisualFraction(deflection) * 42}`,
    )
    .join(" ");

  const buttons = [
    {
      id: "positionLeft",
      label: "Left support carries more",
      pressed: positionPrediction === "left",
    },
    {
      id: "positionRight",
      label: "Right support carries more",
      pressed: positionPrediction === "right",
    },
    {
      id: "positionEqual",
      label: "Both supports stay equal",
      pressed: positionPrediction === "equal",
    },
    {
      id: "comparePosition",
      label: "Compare load positions",
      disabled: !positionPrediction,
    },
    ...(positionComplete
      ? [
          { id: "showPositionCenter", label: "Show center evidence" },
          { id: "showPositionLeft", label: "Show 20% evidence" },
        ]
      : []),
    {
      id: "loadBothDouble",
      label: "Moment and deflection both double",
      pressed: loadPrediction === "both-double",
    },
    {
      id: "loadMomentOnly",
      label: "Moment doubles; deflection stays the same",
      pressed: loadPrediction === "moment-only",
    },
    {
      id: "loadQuadruple",
      label: "Moment and deflection both quadruple",
      pressed: loadPrediction === "quadruple",
    },
    {
      id: "compareLoad",
      label: "Compare point loads",
      disabled: !loadPrediction,
    },
    ...(loadComplete
      ? [
          { id: "showLoadLight", label: "Show 8 kN evidence" },
          { id: "showLoadHeavy", label: "Show 16 kN evidence" },
        ]
      : []),
    ...(freeExploration
      ? [
          { id: "play", label: playing ? "Pause load path" : "Play load path" },
          { id: "start", label: "Start load path" },
        ]
      : []),
  ];

  const positionText = positionComplete
    ? `The evidence ${positionPrediction === "left" ? "matches" : "differs from"} your prediction. ${formatPositionEvidence("Center", positionEvidence[0])}. ${formatPositionEvidence("20%", positionEvidence[1])}. Changed: ${positionVariables.changed.join(", ")}. Held: ${positionVariables.held.join(" · ")}. The nearer support carries more, while peak moment and load-point deflection are smaller than at midspan.`
    : "Move 12 kN from the center to 20% of the span. Predict which support carries more while span, flexural rigidity and brace index stay fixed.";
  const loadText = loadComplete
    ? `The evidence ${loadPrediction === "both-double" ? "matches" : "differs from"} your prediction. 8 kN: ${loadEvidence[0].peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m and ${loadEvidence[0].deflectionAtLoadMillimeters.toFixed(2)} mm · 16 kN: ${loadEvidence[1].peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m and ${loadEvidence[1].deflectionAtLoadMillimeters.toFixed(2)} mm. Changed: ${loadVariables.changed.join(", ")}. Held: ${loadVariables.held.join(" · ")}. This linear model doubles both quantities; it does not establish a safe load.`
    : "At midspan, change only the point load from 8 to 16 kN. Predict what happens to peak moment and deflection at the load.";

  return {
    vector: {
      viewBox: [0, 0, 720, 132],
      description: `Equivalent-beam deflection profile on one fixed deflection scale across every state: 0–${BRIDGE_VISUAL_MAX_DEFLECTION_MILLIMETERS.toFixed(1)} millimeters. Deflection at the point load is ${result.deflectionAtLoadMillimeters.toFixed(2)} millimeters. Supports remain at zero deflection.`,
      nodes: [
        {
          tag: "line",
          attrs: {
            x1: 18,
            y1: 28,
            x2: 702,
            y2: 28,
            stroke: "#78908e",
            strokeWidth: 1,
            strokeDasharray: "5 5",
          },
          children: [],
        },
        {
          tag: "polyline",
          attrs: {
            points: profile,
            fill: "none",
            stroke: "#339a92",
            strokeWidth: 3,
          },
          children: [],
        },
        {
          tag: "text",
          attrs: { x: 18, y: 96, fill: "#294c49", fontSize: 14 },
          children: [
            `Fixed deflection scale across every state: 0–${BRIDGE_VISUAL_MAX_DEFLECTION_MILLIMETERS.toFixed(1)} mm`,
          ],
        },
        {
          tag: "text",
          attrs: { x: 18, y: 119, fill: "#294c49", fontSize: 15 },
          children: [
            `Peak moment ${result.peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m · deflection at load ${result.deflectionAtLoadMillimeters.toFixed(2)} mm`,
          ],
        },
      ],
    },
    animate: playing,
    pointer: freeExploration,
    pointerMode: "drag",
    scene3d,
    shapes: [],
    description: `Left reaction ${result.leftReactionKilonewtons.toFixed(1)} kN; right reaction ${result.rightReactionKilonewtons.toFixed(1)} kN; peak moment ${result.peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m; deflection at load ${result.deflectionAtLoadMillimeters.toFixed(2)} mm. Point load ${result.inputs.pointLoadKilonewtons.toFixed(1)} kN at ${result.inputs.loadPositionPercent}% of a 10 m span. Flexural rigidity ${result.inputs.flexuralRigidityMeganewtonMetersSquared} MN·m². Brace reference-use indices ${result.braceReferenceUseIndex.map((index) => index.toFixed(2)).join(", ")}. ${playing ? "The slowed force-path diagram is playing." : "The force-path diagram is paused."}`,
    readoutColumns: 3,
    readouts: [
      {
        label: "Left reaction",
        value: `${result.leftReactionKilonewtons.toFixed(1)} kN`,
      },
      {
        label: "Right reaction",
        value: `${result.rightReactionKilonewtons.toFixed(1)} kN`,
      },
      {
        label: "Peak moment",
        value: `${result.peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m`,
      },
      {
        label: "Deflection at load",
        value: `${result.deflectionAtLoadMillimeters.toFixed(2)} mm`,
      },
      {
        label: "Flexural rigidity EI",
        value: `${result.inputs.flexuralRigidityMeganewtonMetersSquared} MN·m²`,
      },
    ],
    controls: freeExploration
      ? [
          {
            id: "position",
            label: "Load position (%)",
            min: 5,
            max: 95,
            step: 1,
            value: result.inputs.loadPositionPercent,
          },
          {
            id: "load",
            label: "Point load (kN)",
            min: 0,
            max: 30,
            step: 1,
            value: result.inputs.pointLoadKilonewtons,
          },
          {
            id: "rigidity",
            label: "Beam flexural rigidity (MN·m²)",
            min: 50,
            max: 250,
            step: 10,
            value: result.inputs.flexuralRigidityMeganewtonMetersSquared,
          },
          ...result.inputs.braces.map((brace, index) => ({
            id: `brace${index}`,
            label: `Section ${index + 1} brace index modifier`,
            min: 0,
            max: 1,
            step: 1,
            value: brace ? 1 : 0,
            kind: "toggle",
          })),
          {
            id: "phase",
            label: "Load-path phase (%)",
            min: 0,
            max: 100,
            step: 1,
            value: Math.round(phase * 100),
          },
        ]
      : [],
    buttons,
    sections: [
      {
        heading: "1. Move the same load",
        text: positionText,
        buttonIds: buttons
          .filter(
            (button) =>
              button.id.startsWith("position") ||
              button.id === "comparePosition" ||
              button.id.startsWith("showPosition"),
          )
          .map((button) => button.id),
      },
      {
        heading: "2. Double the point load",
        text: loadText,
        buttonIds: buttons
          .filter(
            (button) =>
              button.id.startsWith("load") ||
              button.id === "compareLoad" ||
              button.id.startsWith("showLoad"),
          )
          .map((button) => button.id),
      },
      {
        heading: "3. Explore one variable",
        text: freeExploration
          ? "Controls are unlocked. Change one value at a time. Moving dots are a slowed force-path diagram, not structural vibration or truck speed."
          : "Complete both fixed comparisons to unlock the controls and optional load-path motion.",
        buttonIds: buttons
          .filter((button) => ["play", "start"].includes(button.id))
          .map((button) => button.id),
      },
      {
        heading: "Explain the evidence",
        text: "Static equilibrium makes the support reactions sum to the applied load and balances torque. Moving a point load changes the reaction split and peak moment. With EI fixed, this small-deflection beam equation is linear in load.",
      },
    ],
    footnote:
      "Model boundary: one static point load on a 10 m simply supported Euler–Bernoulli equivalent beam with constant EI. Deflection uses one fixed, visibly enlarged 0–12.5 mm scale across every state. The timber truss is illustrative, not the solved structure. Self-weight, multiple axles, connections, shear, buckling, fatigue, impact, wind, material limits and safety factors are omitted. Brace reference-use is an invented comparison index, not a capacity or safety rating; it does not change the beam reactions, moment or deflection. Not a construction design, load rating or safety certification.",
  };
}

const compact = createFrameCompactor();
self.onmessage = ({ data }) =>
  self.postMessage(compact(run(data), data.type === "reset"));
