const fixedCamera = <T extends { camera: object }>(s: T) => ({
  ...s,
  camera: { ...s.camera, interactive: false },
});
import { timelineDrag } from "../space-life-support/worker";
import { PLANETS } from "./spaceModels";
import { buildSolarScene } from "./solarScene";
import { serializeScene } from "../shared/serialize-scene";
import {
  context,
  range,
  select,
  button,
  install,
  background,
  type Input,
} from "../space-life-support/worker";
const ctx = context(),
  visual = buildSolarScene(ctx, "assets/earth.jpg");
let selected = 2,
  speed = 1,
  mode = 0,
  progress = 0,
  playing = false,
  prediction = "",
  tested = false;
const scrub = timelineDrag();
function run(i: Input) {
  const narrow = (i.viewportWidth ?? i.width ?? 800) <= 760;
  if (
    ["selected", "mode", "progress", "play"].includes(i.control ?? "") ||
    i.control?.startsWith("planet") ||
    i.type === "pointer" ||
    (i.type === "step" && playing)
  )
    tested = false;
  progress = scrub(i, progress);
  if (i.type === "reset") {
    selected = 2;
    speed = 1;
    mode = 0;
    progress = 0;
    playing = false;
    prediction = "";
    tested = false;
  }
  if (i.control === "selected") selected = i.values.selected;
  if (i.control === "speed") speed = i.values.speed;
  if (i.control === "mode") mode = i.values.mode;
  if (i.control === "progress") progress = i.values.progress / 100;
  if (i.control === "play") playing = !playing;
  if (i.control?.startsWith("planet")) selected = Number(i.control.slice(6));
  if (i.control?.startsWith("predict")) {
    prediction = ["Earth", "Neptune", "Same fraction"][
      Number(i.control.slice(7))
    ];
    tested = false;
  }
  if (i.control === "test") {
    mode = 0;
    selected = 7;
    progress = 0.1;
    playing = false;
    tested = true;
  }
  if (i.type === "step" && playing)
    progress = (progress + (i.dt ?? 0.05) / (60 / speed)) % 1;
  const p = PLANETS[selected],
    years = progress * 10;
  visual.resize((i.width ?? 800) / (i.height ?? 480));
  visual.update({
    selected,
    earthYears: years,
    mode: mode ? "sizes" : "orbits",
  });
  return {
    animate: playing,
    pointer: true,
    pointerMode: "drag",
    shapes: [],
    description: `${mode ? "True diameter comparison" : "Schematic orbit map"}. ${p.name}, ${p.kind}, planet ${selected + 1} from Sun. Distance ${p.distance} AU; year ${p.year} Earth years; diameter ${p.diameter.toLocaleString("en-US")} km, ${(p.diameter / 12756).toFixed(2)} Earth diameters. Elapsed ${years.toFixed(2)} Earth years. ${mode ? "Both globes use the same diameter scale. Earth diameter 12,756 km." : "Eight planets with schematic distances and enlarged sizes; selected planet close-up has a separate size scale."}`,
    readouts: [
      { label: "Distance from Sun", value: `${p.distance} AU` },
      { label: "Orbital period", value: `${p.year} Earth years` },
      { label: "Elapsed model time", value: `${years.toFixed(2)} Earth years` },
      ...(mode
        ? [
            { label: "Earth diameter", value: "12,756 km" },
            {
              label: `${p.name} diameter`,
              value: `${p.diameter.toLocaleString("en-US")} km`,
            },
          ]
        : []),
    ],
    controls: [
      select(
        "selected",
        "Choose a planet",
        selected,
        PLANETS.map((p) => p.name),
      ),
      select("mode", "View", mode, [
        "Schematic orbit map",
        "True diameter comparison",
      ]),
      range("speed", "Time speed (×)", 1, 10, 1, speed),
      range(
        "progress",
        "Model time (%)",
        0,
        99,
        1,
        Math.min(99, progress * 100),
      ),
    ],
    buttons: [
      ...PLANETS.map((p, n) =>
        button(`planet${n}`, `${p.name} ${n + 1}`, selected === n),
      ),
      button("play", playing ? "Pause motion" : "Play motion"),
      ...["Earth", "Neptune", "Same fraction"].map((v, n) =>
        button(`predict${n}`, v, prediction === v),
      ),
      button("test", "Advance one Earth year"),
    ],
    sections: [
      {
        heading: "1. Predict",
        text: `In one Earth year, which completes more of its orbit?${prediction ? " Your prediction: " + prediction + "." : ""}`,
        buttonIds: ["predict0", "predict1", "predict2"],
      },
      {
        heading: "2. Compare",
        text: `Compare Earth and Neptune at the same elapsed time.${tested ? " Earth completes 1 orbit. Neptune completes about 1/165 of an orbit." : ""}`,
        buttonIds: ["test"],
      },
      {
        heading: "3. Explain",
        text: "Farther planets take longer to orbit the Sun. The moving map uses their relative periods, even though orbit gaps are compressed. Predict how many Earth diameters fit across Jupiter. Choose Jupiter and switch to diameter comparison to test. Explain why close-up size alone cannot compare planetary diameters.",
      },
    ],
    footnote:
      "1 AU is Earth’s average distance from the Sun. Orbit map enlarges planets and compresses gaps; separate close-up is not a size comparison. Diameter view uses one scale; rings excluded from diameter. Circular coplanar paths, illustrative starting positions, not today’s sky. One cycle is 10 Earth years. Surface details except Earth are illustrations. NASA Earth Observatory Blue Marble and NASA Basics of Space Flight planetary data.",
    scene3d: fixedCamera(
      serializeScene(ctx.scene, ctx.camera, {
        target: [0, 0, 0],
        presentation: {
          layout: {
            height: narrow ? (mode ? 500 : 700) : 590,
            canvasInset: narrow
              ? mode
                ? [115, 8, 60, 8]
                : [125, 5, 45, 5]
              : [85, 12, 40, 12],
          },
          stat: {
            value: mode ? (p.diameter / 12756).toFixed(2) + "×" : p.year + "×",
            label: mode ? "Earth’s diameter" : "Earth’s year",
          },
          gestureHint:
            "Drag horizontally to change orbital time. Keyboard: use Model time below.",
          toneMapping: "aces",
          exposure: 1.15,
          title: p.name,
          subtitle: mode
            ? "Both globes use the same diameter scale."
            : "Eight orbits with schematic distances; close-up uses a separate size scale.",
          background,
        },
      }),
    ),
  };
}
install(run);
