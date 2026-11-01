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
  saved: {
    light: number;
    water: number;
    carbon: number;
    activity: number;
  } | null = null,
  zeroPrediction = "",
  zeroComplete = false,
  lightPrediction = "",
  lightComplete = false;
function run(i: Input) {
  const narrow = (i.viewportWidth ?? i.width ?? 800) <= 650;
  if (i.type === "reset") {
    light = 70;
    water = 60;
    carbon = 80;
    saved = null;
    zeroPrediction = "";
    zeroComplete = false;
    lightPrediction = "";
    lightComplete = false;
  }
  if (i.control === "light") light = i.values.light;
  if (i.control === "water") water = i.values.water;
  if (i.control === "carbon") carbon = i.values.carbon;
  if (i.control === "zeroStays" || i.control === "zeroRises") {
    zeroPrediction = i.control === "zeroStays" ? "stays at zero" : "rises";
    zeroComplete = false;
    lightPrediction = "";
    lightComplete = false;
  }
  if (i.control === "runZero" && zeroPrediction) {
    water = 0;
    light = 100;
    carbon = 80;
    zeroComplete = true;
  }
  if (
    zeroComplete &&
    (i.control === "lightLevels" || i.control === "lightKeepsRising")
  ) {
    lightPrediction =
      i.control === "lightLevels" ? "levels off" : "keeps rising";
    lightComplete = false;
  }
  if (i.control === "runLight" && zeroComplete && lightPrediction) {
    light = 100;
    water = 35;
    carbon = 80;
    lightComplete = true;
  }
  const result = photosynthesis(light, water, carbon);
  const activity = Math.round(result.rate);
  if (i.control === "save") {
    saved = { light, water, carbon, activity };
  }
  const changed = saved
    ? [
        saved.light === light ? null : "light",
        saved.water === water ? null : "water",
        saved.carbon === carbon ? null : "carbon dioxide",
      ].filter(Boolean)
    : [];
  const held = saved
    ? [
        saved.light === light ? "light" : null,
        saved.water === water ? "water" : null,
        saved.carbon === carbon ? "carbon dioxide" : null,
      ].filter(Boolean)
    : [];
  const limits = result.limitingResources.join(" and ");
  visual.resize((i.width ?? 800) / (i.height ?? 480));
  visual.setState({ light, water, carbon, rate: result.rate });
  return {
    animate: false,
    shapes: [],
    fallbackVector: {
      viewBox: [0, 0, 720, 420],
      description: `Leaf diagram. Toy activity index ${activity} out of 100. Current model limits: ${limits}. The resource controls remain available without 3D.`,
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
          children: [`Toy activity index: ${activity} / 100`],
        },
      ],
    },
    description: `Magnified leaf section with chloroplast-containing cells. Settings: light ${light}, water ${water}, carbon dioxide ${carbon}. Toy activity index ${activity} / 100. Current model limits: ${limits}.${saved === null ? "" : ` Trial A: light ${saved.light}, water ${saved.water}, carbon dioxide ${saved.carbon}, index ${saved.activity}. Changed: ${changed.join(" and ") || "none"}. Held constant: ${held.join(", ") || "none"}.`} Light supplies energy; water and carbon dioxide supply matter for sugars. Released oxygen comes from water.`,
    readouts: [
      { label: "Toy activity index", value: `${activity} / 100` },
      { label: "Current model limits", value: limits },
      ...(saved === null
        ? []
        : [
            {
              label: "Trial A",
              value: `${saved.activity} / 100`,
              detail: `Light ${saved.light}; water ${saved.water}; carbon dioxide ${saved.carbon}`,
            },
          ]),
    ],
    controls: [
      range("light", "Light setting", 0, 100, 1, light),
      range("water", "Water setting", 0, 100, 1, water),
      range("carbon", "Carbon dioxide setting", 0, 100, 1, carbon),
    ],
    buttons: [
      button(
        "zeroStays",
        "Activity stays at zero",
        zeroPrediction === "stays at zero",
      ),
      button("zeroRises", "Activity rises", zeroPrediction === "rises"),
      button("runZero", "Run water test"),
      ...(zeroComplete
        ? [
            button(
              "lightLevels",
              "Levels off",
              lightPrediction === "levels off",
            ),
            button(
              "lightKeepsRising",
              "Keeps rising",
              lightPrediction === "keeps rising",
            ),
            button("runLight", "Run light test"),
          ]
        : []),
      button("save", "Set current trial as A"),
    ],
    sections: [
      {
        heading: "1. Test a missing input",
        text: zeroComplete
          ? `Water 0 and carbon dioxide 80. Light 30 → index 0; light 100 → index 0. ${zeroPrediction === "stays at zero" ? "The evidence matches your prediction." : "The evidence does not match your prediction."} Light cannot replace water as a matter input.`
          : `Water will be 0 and carbon dioxide 80. Predict what happens when light changes from 30 to 100.${zeroPrediction ? ` Prediction: activity ${zeroPrediction}.` : " Predict before running the test."}`,
        buttonIds: ["zeroStays", "zeroRises", "runZero"],
      },
      {
        heading: "2. Find where light stops limiting",
        text: lightComplete
          ? `Water 35 and carbon dioxide 80. Light 15 → index 37; light 35 → index 67; light 100 → index 67. ${lightPrediction === "levels off" ? "The evidence matches your prediction." : "The evidence does not match your prediction."} At 35, light and water tie as limits. Above 35, water limits this toy model.`
          : zeroComplete
            ? `Water stays 35 and carbon dioxide stays 80. Predict whether the index keeps rising as light changes 15 → 35 → 100.${lightPrediction ? ` Prediction: it ${lightPrediction}.` : ""}`
            : "Complete the zero-water comparison first.",
        buttonIds: zeroComplete
          ? ["lightLevels", "lightKeepsRising", "runLight"]
          : [],
      },
      {
        heading: "Open comparison",
        text: saved
          ? `${changed.length === 1 ? "Controlled comparison." : changed.length > 1 ? "Change one setting at a time for a controlled comparison." : "Change one setting, then compare."} Held constant: ${held.join(", ") || "none"}.`
          : "Set the current trial as A, change one setting, and use the readouts to compare.",
        buttonIds: ["save"],
      },
    ],
    footnote:
      "The 0–100 activity index is an invented pattern, not a measured photosynthesis or growth rate. It omits stored water, temperature, species, nutrients and time. Plants respire day and night. The cutaway is schematic and not to scale.",
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
            "Predict, run the fixed trials, then compare one setting at a time.",
          toneMapping: "none",
          exposure: 1,
          title: "Inputs can limit photosynthetic activity",
          subtitle: "A toy index for controlled comparisons",
          background: ["#234d3a", "#071b16", "#071b16"],
        },
      }),
    ),
  };
}
install(run);
