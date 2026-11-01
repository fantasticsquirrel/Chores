import {
  CASTLE_DEFAULT_INPUTS,
  CASTLE_GATE_COMPARISON,
  CASTLE_TOWER_COMPARISON,
  castleActivity,
  compareCastleTrials,
  normalizeCastleInputs,
  type CastleInputs,
} from "@family-manager/family-api/discovery-models/castle";
import { resetVectorIds } from "../exploration-packages/space-life-support/vector-author";
import { CastleDrawing } from "./CastleDrawing";
import {
  createEvidence,
  createLandscape,
  updateLandscape,
} from "./castleLandscape";
import { castleMaterials } from "./castleMaterials";
import { createFortress } from "./castleStructure";
import type { CastleState } from "./castleState";
import { resetResources, resources } from "./scene-builder";

/** All castle-specific visual construction, teaching and interaction live in this package. */
type Topic = "routes" | "views";
type RoutePrediction = "both" | "bridge" | "neither";
type ViewPrediction = "tower" | "same" | "flat";
type Prediction = RoutePrediction | ViewPrediction;
type Input = {
  type: string;
  values: Record<string, number>;
  control?: string;
};

let topic: Topic = "routes";
let prediction: Prediction | null = null;
let tested = false;

const routeEvidence = CASTLE_GATE_COMPARISON.map(castleActivity);
const towerEvidence = CASTLE_TOWER_COMPARISON.map(castleActivity);
const routeVariables = compareCastleTrials(...CASTLE_GATE_COMPARISON);
const towerVariables = compareCastleTrials(...CASTLE_TOWER_COMPARISON);
const modelNote =
  "13th-century English-inspired composite, not a reconstruction. Dimensions are schematic; ditch width is compressed in the view. Ditches could be wet or dry. Sight lines illustrate positions, not weapon ranges. Routes and visibility do not predict a siege result.";

function inputsFrom(values: Record<string, number>): CastleInputs {
  return normalizeCastleInputs({
    ...CASTLE_DEFAULT_INPUTS,
    ditchWidthMeters: values.moat ?? 22,
    towers: (values.towers ?? 1) === 1,
    gate: (values.gate ?? 1) === 1,
    inner: (values.inner ?? 0) === 1,
    approach: values.approach === 1 ? "north" : "bridge",
    sight: (values.sight ?? 0) === 1,
  });
}

const toState = (inputs: CastleInputs): CastleState => ({
  moat: inputs.ditchWidthMeters,
  wallHeightMeters: inputs.wallHeightMeters,
  towers: inputs.towers,
  gate: inputs.gate,
  inner: inputs.inner,
  approach: inputs.approach,
  sight: inputs.sight,
});

function run(input: Input) {
  if (input.type === "reset") {
    topic = "routes";
    prediction = null;
    tested = false;
  }
  let inputs = inputsFrom(input.type === "reset" ? {} : input.values);
  if (input.control === "compareRoutes" || input.control === "compareViews") {
    topic = input.control === "compareRoutes" ? "routes" : "views";
    prediction = null;
    tested = false;
  } else if (
    ["routeBoth", "routeBridge", "routeNeither"].includes(input.control ?? "")
  ) {
    prediction = input
      .control!.replace("route", "")
      .toLowerCase() as RoutePrediction;
    tested = false;
  } else if (
    ["viewTower", "viewSame", "viewFlat"].includes(input.control ?? "")
  ) {
    prediction = input
      .control!.replace("view", "")
      .toLowerCase() as ViewPrediction;
    tested = false;
  } else if (input.control === "testPrediction" && prediction) {
    tested = true;
    inputs =
      topic === "routes"
        ? CASTLE_GATE_COMPARISON[0]
        : CASTLE_TOWER_COMPARISON[1];
  } else if (tested && input.control === "showFirst") {
    inputs =
      topic === "routes"
        ? CASTLE_GATE_COMPARISON[0]
        : CASTLE_TOWER_COMPARISON[0];
  } else if (tested && input.control === "showSecond") {
    inputs =
      topic === "routes"
        ? CASTLE_GATE_COMPARISON[1]
        : CASTLE_TOWER_COMPARISON[1];
  }

  const state = toState(inputs);
  const activity = castleActivity(inputs);
  resetResources();
  resetVectorIds();
  const material = castleMaterials();
  const fortress = createFortress(material);
  const landscape = createLandscape(material);
  fortress.towers.visible = state.towers;
  fortress.inner.visible = state.inner;
  fortress.gate.position.y = state.gate ? 0 : 4.9;
  updateLandscape(landscape.ditch, landscape.bridge, state, material);
  const evidence = createEvidence(state, material);
  const question =
    topic === "routes"
      ? "With the gate open, which routes reach an entrance?"
      : "Which position shows more adjoining wall faces?";
  const action =
    topic === "routes"
      ? "Keep the gate open and ditch at 22 m. Compare the bridge route with the north wall route."
      : "Keep the bridge route, closed gate and 22 m ditch fixed. Compare the front corner with and without its projecting tower.";
  const feedback =
    topic === "routes"
      ? `The result ${prediction === "bridge" ? "matches" : "differs from"} your prediction. Bridge: ${routeEvidence[0].routeOutcome} · North: ${routeEvidence[1].routeOutcome}. Changed: ${routeVariables.changed.join(", ")}. Held: ${routeVariables.held.join(" · ")}. Opening the gate does not create an entrance through the north wall.`
      : `The result ${prediction === "tower" ? "matches" : "differs from"} your prediction. Flat wall: ${towerEvidence[0].sightLineCount} illustrated direction · Projecting tower: ${towerEvidence[1].sightLineCount}. Changed: ${towerVariables.changed.join(", ")}. Held: ${towerVariables.held.join(" · ")}. Projecting outward changes the wall faces visible from this example position. The dashed directions are not complete visibility or weapon ranges.`;
  const choiceIds =
    topic === "routes"
      ? ["routeBoth", "routeBridge", "routeNeither"]
      : ["viewTower", "viewSame", "viewFlat"];
  const evidenceIds = ["showFirst", "showSecond"];
  const toggle = (id: string, label: string, checked: boolean) => ({
    id,
    label,
    kind: "toggle",
    min: 0,
    max: 1,
    step: 1,
    value: checked ? 1 : 0,
  });

  return {
    animate: false,
    shapes: [],
    fallbackVector: {
      viewBox: [0, 0, 720, 420],
      description: `Castle plan: the ${state.approach} route ${activity.routeOutcome}.`,
      nodes: [CastleDrawing(state)],
    },
    description: `${state.moat} m ditch; ${state.gate ? "closed" : "raised"} portcullis; ${state.towers ? "four projecting corner towers" : "flat curtain-wall corners"}; ${state.inner ? "an additional inner wall" : "one outer wall"}. The ${state.approach} route ${activity.routeOutcome}. ${state.sight ? `${activity.sightLineCount} illustrative sight-line directions are shown.` : "Sight-line directions are hidden."} ${state.inner ? "The inner wall adds another barrier; it does not make the castle invincible." : ""}`,
    sections: [
      {
        heading: "1. Predict",
        text: `${question}${prediction ? ` Your prediction: ${prediction}.` : " Choose a prediction before comparing."}`,
        buttonIds: choiceIds,
      },
      {
        heading: "2. Compare",
        text: action,
        buttonIds: ["testPrediction", ...(tested ? evidenceIds : [])],
      },
      {
        heading: "3. Explain",
        text: tested
          ? feedback
          : topic === "routes"
            ? "Predict first. Then use both route endpoints as evidence."
            : "Predict first. Then count the illustrated directions in both views.",
      },
    ],
    footnote: modelNote,
    controls: [
      {
        id: "approach",
        label: "Approach route",
        kind: "select",
        min: 0,
        max: 1,
        step: 1,
        value: state.approach === "bridge" ? 0 : 1,
        options: [
          { value: 0, label: "Bridge and gate" },
          { value: 1, label: "Across the north ditch" },
        ],
      },
      {
        id: "moat",
        label: "Ditch width (m)",
        min: 0,
        max: 36,
        step: 1,
        value: state.moat,
      },
      toggle("gate", "Close gate", state.gate),
      toggle("towers", "Projecting towers", state.towers),
      toggle("inner", "Inner wall", state.inner),
      toggle("sight", "Sight-line overlay (not structures)", state.sight),
    ],
    buttons: [
      { id: "compareRoutes", label: "Compare routes" },
      { id: "compareViews", label: "Compare sight lines" },
      ...(topic === "routes"
        ? [
            { id: "routeBoth", label: "Both routes" },
            { id: "routeBridge", label: "Bridge only" },
            { id: "routeNeither", label: "Neither route" },
          ]
        : [
            { id: "viewTower", label: "Projecting tower" },
            { id: "viewSame", label: "Same view" },
            { id: "viewFlat", label: "Flat wall" },
          ]),
      {
        id: "testPrediction",
        label:
          topic === "routes"
            ? "Compare open-gate routes"
            : "Compare wall-side views",
        disabled: !prediction,
      },
      ...(tested
        ? [
            {
              id: "showFirst",
              label:
                topic === "routes"
                  ? "Show bridge evidence"
                  : "Show flat-wall evidence",
            },
            {
              id: "showSecond",
              label:
                topic === "routes"
                  ? "Show north evidence"
                  : "Show tower evidence",
            },
          ]
        : []),
    ],
    scene3d: {
      ...resources(),
      nodes: [
        landscape.group.record(),
        fortress.group.record(),
        evidence.record(),
      ],
      camera: {
        target: [0, 3.2, 0],
        radius: 80,
        yaw: 0.62,
        elevation: 0.7,
        zoom: 0.88,
        halfHeight: 21.5,
        narrowHalfWidth: 28,
        narrowAspect: 1.25,
        presets: [
          {
            id: "courtyard",
            label: "Courtyard",
            yaw: 0.62,
            elevation: 0.7,
            zoom: 0.88,
          },
          {
            id: "entrance",
            label: "Entrance",
            yaw: 0.1,
            elevation: 0.3,
            zoom: 1,
          },
          {
            id: "north",
            label: "North wall",
            yaw: Math.PI + 0.3,
            elevation: 0.7,
            zoom: 0.88,
          },
          {
            id: "overhead",
            label: "Above",
            yaw: 0.62,
            elevation: 1.42,
            zoom: 0.88,
          },
        ],
      },
      lighting: {
        hemisphere: { sky: 0xbcd4d4, ground: 0x343b2b, intensity: 1.45 },
        directional: [
          {
            color: 0xffd79c,
            intensity: 2.7,
            position: [-32, 60, 35],
            shadow: {
              size: 2048,
              extent: 48,
              near: 1,
              far: 130,
              bias: -0.0003,
              normalBias: 0.06,
              radius: 3,
            },
          },
          { color: 0x85b9cf, intensity: 0.82, position: [25, 16, -25] },
        ],
      },
      labels: [],
      presentation: {
        title: "Test one castle defense",
        subtitle: "Compare a route or wall-side view.",
        route: `${state.approach === "bridge" ? "Bridge route" : "North route"} · ${activity.routeOutcome}`,
        background: ["#e8e1cf", "#c4cec0", "#879b88"],
      },
    },
  };
}

self.onmessage = ({ data }: MessageEvent<Input>) => self.postMessage(run(data));
