import { refract } from "./physics";
import { OpticsBench } from "./OpticsBench";
import {
  range,
  button,
  install,
  clamp,
  type Input,
} from "../space-life-support/worker";
let angle = 40,
  n1 = 1,
  n2 = 1.5,
  prediction = "",
  tested = false,
  drag = false;
function run(i: Input) {
  if (i.type === "reset") {
    angle = 40;
    n1 = 1;
    n2 = 1.5;
    prediction = "";
    tested = false;
    drag = false;
  }
  if (i.control === "angle") angle = i.values.angle;
  if (i.control === "n1") n1 = i.values.n1;
  if (i.control === "n2") n2 = i.values.n2;
  if (i.control === "swap") [n1, n2] = [n2, n1];
  if (i.control === "predictYes" || i.control === "predictNo") {
    prediction = i.control === "predictYes" ? "Yes" : "No";
    tested = false;
  }
  if (i.control === "test") {
    n1 = 1.5;
    n2 = 1;
    angle = 43;
    tested = true;
  }
  if (i.type === "pointer" && i.pointer) {
    const p = i.pointer as unknown as { phase: string; x: number; y: number };
    if (p.phase === "down") {
      const theta = (angle * Math.PI) / 180,
        sx = 420 - Math.sin(theta) * 208,
        sy = 310 - Math.cos(theta) * 208,
        dx = p.x * 840 - sx,
        dy = p.y * 620 - sy,
        lx = dx * Math.cos(theta) - dy * Math.sin(theta),
        ly = dx * Math.sin(theta) + dy * Math.cos(theta);
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
  const result = refract(angle, n1, n2),
    reflection =
      Math.abs(n1 - n2) < 1e-9
        ? "No reflection: equal refractive indices"
        : `Reflection angle ${angle}°`,
    refraction = result.tir
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
      description: `Optical bench. Incident angle ${angle} degrees from normal. ${reflection}. ${refraction}`,
      pointer: true,
    },
    description: `${reflection}. ${refraction} Snell’s law: n₁ sin θ₁ = n₂ sin θ₂. Top refractive index ${n1.toFixed(2)}, bottom ${n2.toFixed(2)}.`,
    readouts: [
      { label: "Reflection", value: reflection },
      { label: "Transmission", value: refraction },
      { label: "Snell’s law", value: "n₁ sin θ₁ = n₂ sin θ₂" },
    ],
    controls: [
      range("angle", "Incident angle (°)", 0, 80, 1, angle),
      range("n1", "Top refractive index", 1, 2, 0.01, n1),
      range("n2", "Bottom refractive index", 1, 2, 0.01, n2),
    ],
    buttons: [
      button("swap", "Swap materials"),
      button("predictYes", "Predict yes", prediction === "Yes"),
      button("predictNo", "Predict no", prediction === "No"),
      button("test", "Test glass to air at 43°"),
    ],
    sections: [
      {
        heading: "1. Predict",
        text: `When light travels from glass to air above about 42°, will a transmitted ray remain?${prediction ? " Your prediction: " + prediction + "." : ""}`,
        buttonIds: ["predictYes", "predictNo"],
      },
      {
        heading: "2. Compare",
        text: `Send light from glass 1.5 to air 1.0. Keep both materials fixed and compare 40° with 43°.${tested ? " At 43°, total internal reflection leaves no transmitted ray." : ""}`,
        buttonIds: ["test"],
      },
      {
        heading: "3. Explain",
        text: "Angles are measured from the normal. Light changes direction when its speed changes across different refractive indices. Total internal reflection requires higher to lower index, above the critical angle. Predict whether it can happen from air to glass; swap materials and test with the same angle. Then make both indices equal and explain the straight transmitted ray and absence of reflection.",
      },
    ],
    footnote:
      "Air ≈ 1.00; water ≈ 1.33; glass ≈ 1.50. Angles measured from normal, not surface. Ray brightness is illustrative, not an energy calculation.",
  };
}
install(run);
