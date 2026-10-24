import { BotanicalLeaf } from "./BotanicalLeaf";
const fixedCamera = <T extends { camera: object }>(s: T) => ({
  ...s,
  camera: { ...s.camera, interactive: false },
});
import { photosynthesis } from "./physics";
import { createLeafScene } from "./createLeafScene";
import { serializeScene } from "../shared/serialize-scene";
import {
  range,
  button,
  install,
  type Input,
} from "../space-life-support/worker";
const visual = createLeafScene();
let light = 70,
  water = 60,
  carbon = 80,
  saved: number | null = null,
  prediction = "",
  tested = false;
function run(i: Input) {
  const narrow = (i.viewportWidth ?? i.width ?? 800) <= 650;
  if (["light", "water", "carbon"].includes(i.control ?? "")) tested = false;
  if (i.type === "reset") {
    light = 70;
    water = 60;
    carbon = 80;
    saved = null;
    prediction = "";
    tested = false;
  }
  if (i.control === "light") light = i.values.light;
  if (i.control === "water") water = i.values.water;
  if (i.control === "carbon") carbon = i.values.carbon;
  if (i.control === "predictYes" || i.control === "predictNo") {
    prediction = i.control === "predictYes" ? "Yes" : "No";
    tested = false;
  }
  if (i.control === "test") {
    water = 0;
    light = 100;
    tested = true;
  }
  const result = photosynthesis(light, water, carbon);
  if (i.control === "save") saved = result.rate;
  visual.resize((i.width ?? 800) / (i.height ?? 480));
  visual.setState({ light, water, carbon, rate: result.rate });
  return {
    animate: false,
    shapes: [],
    fallbackVector: {
      viewBox: [0, 0, 720, 420],
      description: `Leaf diagram. Relative activity ${Math.round(result.rate)} / 100. The resource controls remain available without 3D.`,
      nodes: [
        BotanicalLeaf(),
        {
          tag: "circle",
          attrs: {
            cx: 115,
            cy: 105,
            r: 30,
            fill: "#ffe19a",
            opacity: 0.15 + light / 120,
          },
          children: [],
        },
        {
          tag: "text",
          attrs: { x: 190, y: 370, fill: "#e8f4df", fontSize: 20 },
          children: [`Relative activity: ${Math.round(result.rate)} / 100`],
        },
      ],
    },
    description: `Magnified leaf section with chloroplast-containing cells and water transport. Light ${light}%, water ${water}%, carbon dioxide ${carbon}%. Relative activity ${Math.round(result.rate)} / 100. Limiting resource: ${result.limiting}.${saved === null ? "" : ` Saved trial ${Math.round(saved)} / 100; change ${result.rate - saved >= 0 ? "+" : ""}${Math.round(result.rate - saved)}.`} Light + water + carbon dioxide → sugar + oxygen. Water enters through veins, sugar leaves through veins; carbon dioxide enters and oxygen leaves through gas openings.`,
    readouts: [
      { label: "Relative activity", value: `${Math.round(result.rate)} / 100` },
      { label: "Limiting resource", value: result.limiting },
      ...(saved === null
        ? []
        : [
            {
              label: "Saved trial",
              value: `${Math.round(saved)} / 100`,
              detail: `Change ${result.rate - saved >= 0 ? "+" : ""}${Math.round(result.rate - saved)}`,
            },
          ]),
    ],
    controls: [
      range("light", "Light availability (%)", 0, 100, 1, light),
      range("water", "Water availability (%)", 0, 100, 1, water),
      range("carbon", "Carbon dioxide (%)", 0, 100, 1, carbon),
    ],
    buttons: [
      button("save", "Save comparison"),
      button("predictYes", "Predict yes", prediction === "Yes"),
      button("predictNo", "Predict no", prediction === "No"),
      button("test", "Test zero water and extra light"),
    ],
    sections: [
      {
        heading: "1. Predict",
        text: `With water at zero, can extra light restore sugar production?${prediction ? " Your prediction: " + prediction + "." : ""}`,
        buttonIds: ["predictYes", "predictNo"],
      },
      {
        heading: "2. Compare",
        text: `Keep carbon dioxide fixed. Set water to zero and increase light.${tested ? " Relative activity is zero: extra light cannot replace missing water." : ""} Save a comparison, then restore water slowly while keeping light and carbon dioxide fixed.`,
        buttonIds: ["test", "save"],
      },
      {
        heading: "3. Explain",
        text: "Chloroplasts use light energy to make sugars from water and carbon dioxide. One resource cannot substitute for another. Predict which resource will limit activity after water is restored above the carbon dioxide setting. Compare the limiting-resource readout and saved activity, then explain why adding more of a nonlimiting resource has no effect.",
      },
    ],
    footnote:
      "Illustrative resource model, not plant-growth prediction. Temperature, species and nutrients held constant. Plants respire day and night. Schematic cutaway: cell layers and organelles use different display scales. Water transport is blue, sugar transport gold, carbon dioxide pale gray, oxygen pink; labels and text also identify them.",
    scene3d: fixedCamera(
      serializeScene(visual.scene, visual.camera, {
        target: [0, 0.5, 0],
        labels: visual.labels,
        presentation: {
          showHeading: false,
          layout: {
            height: narrow ? 440 : 570,
            canvasInset: narrow ? [0, 0, 85, 0] : [0, 0, 50, 0],
          },
          gestureHint:
            "Use resource controls below. Keep two resources fixed for a fair comparison.",
          toneMapping: "none",
          exposure: 1,
          title: "Light, water and carbon dioxide make sugar",
          subtitle: "Magnified tissue: chloroplasts inside cells.",
          background: ["#234d3a", "#071b16", "#071b16"],
        },
      }),
    ),
  };
}
install(run);
