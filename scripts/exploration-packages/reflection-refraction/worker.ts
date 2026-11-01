import { refract } from "./physics";
import { OpticsBench } from "./OpticsBench";
import {
  range,
  button,
  install,
  clamp,
  type Input,
} from "../space-life-support/worker";

let angle = 40;
let n1 = 1.5;
let n2 = 1;
let criticalPrediction = "";
let criticalTested = false;
let directionPrediction = "";
let directionTested = false;
let drag = false;

function run(i: Input) {
  if (i.type === "reset") {
    angle = 40;
    n1 = 1.5;
    n2 = 1;
    criticalPrediction = "";
    criticalTested = false;
    directionPrediction = "";
    directionTested = false;
    drag = false;
  }
  if (i.control === "angle") angle = i.values.angle;
  if (i.control === "n1") n1 = i.values.n1;
  if (i.control === "n2") n2 = i.values.n2;
  if (i.control === "swap") [n1, n2] = [n2, n1];
  if (i.control === "showCritical40") {
    angle = 40;
    n1 = 1.5;
    n2 = 1;
  }
  if (i.control === "showCritical43") {
    angle = 43;
    n1 = 1.5;
    n2 = 1;
  }
  if (i.control === "showDirectionAirGlass") {
    angle = 30;
    n1 = 1;
    n2 = 1.5;
  }
  if (i.control === "showDirectionGlassAir") {
    angle = 30;
    n1 = 1.5;
    n2 = 1;
  }

  if (i.control === "criticalNone" || i.control === "criticalRemains") {
    criticalPrediction =
      i.control === "criticalNone"
        ? "No transmitted ray"
        : "Transmitted ray remains";
    criticalTested = false;
    directionPrediction = "";
    directionTested = false;
  }
  if (i.control === "runCritical" && criticalPrediction) {
    n1 = 1.5;
    n2 = 1;
    angle = 43;
    criticalTested = true;
    directionPrediction = "";
    directionTested = false;
  }
  if (
    criticalTested &&
    (i.control === "directionOpposite" || i.control === "directionSame")
  ) {
    directionPrediction =
      i.control === "directionOpposite"
        ? "Toward in glass; away in air"
        : "Same bend in both directions";
    directionTested = false;
  }
  if (i.control === "runDirection" && criticalTested && directionPrediction) {
    n1 = 1.5;
    n2 = 1;
    angle = 30;
    directionTested = true;
  }

  if (i.type === "pointer" && i.pointer) {
    const p = i.pointer as unknown as {
      phase: string;
      x: number;
      y: number;
    };
    if (p.phase === "down") {
      const theta = (angle * Math.PI) / 180;
      const sx = 420 - Math.sin(theta) * 208;
      const sy = 310 - Math.cos(theta) * 208;
      const dx = p.x * 840 - sx;
      const dy = p.y * 620 - sy;
      const lx = dx * Math.cos(theta) - dy * Math.sin(theta);
      const ly = dx * Math.sin(theta) + dy * Math.cos(theta);
      drag = Math.abs(lx) <= 24 && ly >= -61 && ly <= 9;
    }
    if (drag)
      angle = Math.round(
        clamp(
          (Math.atan2(420 - p.x * 840, 310 - p.y * 620) * 180) / Math.PI,
          0,
          80,
        ),
      );
    if (p.phase === "up") drag = false;
  }

  const result = refract(angle, n1, n2);
  const reflection =
    Math.abs(n1 - n2) < 1e-9
      ? "No reflection: equal refractive indices"
      : `Reflection angle ${angle.toFixed(1)}°`;
  const refraction = result.tir
    ? "Total internal reflection; no transmitted ray."
    : `Refraction angle ${result.angle?.toFixed(1)}°`;
  const drawing = OpticsBench({
    angle,
    n1,
    n2,
    onAngle: () => {},
  }) as unknown as {
    children: unknown[];
  };

  return {
    animate: false,
    shapes: [],
    vector: {
      viewBox: [0, 0, 840, 620],
      nodes: drawing.children,
      description: `Optical bench. Incident angle ${angle.toFixed(1)} degrees from the normal. ${reflection}. ${refraction}`,
      pointer: true,
    },
    description: `${reflection}. ${refraction} Snell’s law: n₁ sin θ₁ = n₂ sin θ₂. From index ${n1.toFixed(2)} to ${n2.toFixed(2)}.`,
    readouts: [
      { label: "Reflection", value: reflection },
      { label: "Transmission", value: refraction },
      { label: "Snell’s law", value: "n₁ sin θ₁ = n₂ sin θ₂" },
    ],
    controls: [
      range("angle", "Incident angle from normal (°)", 0, 80, 1, angle),
      range("n1", "From refractive index", 1, 2, 0.01, n1),
      range("n2", "To refractive index", 1, 2, 0.01, n2),
    ],
    buttons: [
      button("swap", "Swap direction"),
      button(
        "criticalNone",
        "No transmitted ray",
        criticalPrediction === "No transmitted ray",
      ),
      button(
        "criticalRemains",
        "Transmitted ray remains",
        criticalPrediction === "Transmitted ray remains",
      ),
      ...(criticalPrediction
        ? [button("runCritical", "Compare 40° and 43°")]
        : []),
      ...(criticalTested
        ? [
            button(
              "showCritical40",
              "Show glass → air at 40°: refracted 74.6°",
            ),
            button(
              "showCritical43",
              "Show glass → air at 43°: no transmitted ray",
            ),
          ]
        : []),
      ...(criticalTested
        ? [
            button(
              "directionOpposite",
              "Toward in glass; away in air",
              directionPrediction === "Toward in glass; away in air",
            ),
            button(
              "directionSame",
              "Same bend in both directions",
              directionPrediction === "Same bend in both directions",
            ),
            ...(directionPrediction
              ? [button("runDirection", "Compare both directions")]
              : []),
            ...(directionTested
              ? [
                  button(
                    "showDirectionAirGlass",
                    "Show air → glass at 30°: refracted 19.5°",
                  ),
                  button(
                    "showDirectionGlassAir",
                    "Show glass → air at 30°: refracted 48.6°",
                  ),
                ]
              : []),
          ]
        : []),
    ],
    sections: [
      {
        heading: "1. Cross the critical angle",
        text: `Keep glass → air fixed. Predict what happens to the transmitted ray when only the angle changes from 40° to 43°.${
          criticalPrediction ? ` Your prediction: ${criticalPrediction}.` : ""
        }${
          criticalTested
            ? ` At 40°, the ray refracts to 74.6°. The critical angle is 41.8°; at 43° no transmitted ray remains. The result ${
                criticalPrediction === "No transmitted ray"
                  ? "matches"
                  : "differs from"
              } your prediction. Explain: Why does the 43° ray stay in glass while the 40° ray crosses the boundary?`
            : ""
        }`,
        buttonIds: [
          "criticalNone",
          "criticalRemains",
          ...(criticalPrediction ? ["runCritical"] : []),
          ...(criticalTested ? ["showCritical40", "showCritical43"] : []),
        ],
      },
      {
        heading: "2. Reverse the boundary",
        text: `${
          criticalTested
            ? "Keep the angle at 30°. Compare air → glass with glass → air."
            : "Complete the critical-angle comparison first."
        }${
          directionPrediction ? ` Your prediction: ${directionPrediction}.` : ""
        }${
          directionTested
            ? ` Air → glass: 19.5°; glass → air: 48.6°. The reflected angle remains 30°. The result ${
                directionPrediction === "Toward in glass; away in air"
                  ? "matches"
                  : "differs from"
              } your prediction. Explain: Why does reversing the boundary change the bend even though the incident angle stays fixed?`
            : ""
        }`,
        buttonIds: criticalTested
          ? [
              "directionOpposite",
              "directionSame",
              ...(directionPrediction ? ["runDirection"] : []),
              ...(directionTested
                ? ["showDirectionAirGlass", "showDirectionGlassAir"]
                : []),
            ]
          : [],
      },
      {
        heading: "Explain the evidence",
        text: "Refractive index compares light’s speed in vacuum with its speed in a material; a higher index means slower light. Reflection keeps the incident angle. Snell’s law bends a ray toward the normal on entering a higher index and away on entering a lower one. A large angle alone cannot cause total internal reflection: the ray must travel from higher to lower index and exceed that pair’s critical angle.",
      },
    ],
    footnote:
      "Single-color geometric-ray model. Angles are measured from the normal. It omits absorption, scattering, polarization and color separation. Ray brightness is fixed for visibility, not a calculated energy split.",
  };
}

install(run);
