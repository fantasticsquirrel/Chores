import { createSoundScene } from "./soundScene";
import { stringWave } from "./model";
import { physicalScene, serializePhysical } from "../shared/physical-scene";
import * as T from "three";
import { createFrameCompactor } from "../shared/compact-frame";
let dragLength = false;
let length = 60,
  tension = 80,
  amplitude = 3,
  progress = 0,
  playing = false,
  trial = 0,
  prediction = "";
const reset = () => {
  dragLength = false;
  length = 60;
  tension = 80;
  amplitude = 3;
  progress = 0;
  playing = false;
  prediction = "";
  trial = 0;
};
function run(input: any) {
  if (input.type === "reset") reset();
  const key = input.control,
    value = input.values?.[key];
  if (input.type === "control" && Number.isFinite(value)) {
    if (key === "length") length = Math.max(20, Math.min(120, value));
    if (key === "tension") tension = Math.max(20, Math.min(200, value));
    if (key === "amplitude") amplitude = Math.max(0, Math.min(8, value));
    if (key === "phase") progress = Math.max(0, Math.min(1, value / 360));
  }
  if (key === "play") playing = !playing;
  if (key === "pluck") {
    progress = 0;
    playing = true;
  }
  if (key === "doubleLength" && length <= 60) length *= 2;
  if (key === "doubleAmplitude" && amplitude > 0 && amplitude <= 4)
    amplitude *= 2;
  if (key === "trialLength" || key === "trialAmplitude") {
    trial = key === "trialLength" ? 0 : 1;
    prediction = "";
  }
  if (key === "predictSame") prediction = "Same frequency";
  if (key === "predictDifferent") prediction = "Different frequency";
  if (key === "baseline" && prediction) {
    length = 60;
    tension = 80;
    amplitude = 3;
    progress = 0.25;
  }
  if (key === "compare" && prediction) {
    length = trial === 0 ? 120 : 60;
    tension = 80;
    amplitude = trial === 1 ? 6 : 3;
    progress = 0.25;
  }
  if (playing && input.dt > 0) progress = (progress + input.dt / 2) % 1;
  let model = physicalScene(
    createSoundScene({ kind: "sound", length, tension, amplitude, progress }),
    "sound",
  );
  if (input.type === "pointer" && input.pointer?.rayOrigin) {
    model.group.updateMatrixWorld(true);
    const ray = new T.Raycaster(
      new T.Vector3(...input.pointer.rayOrigin),
      new T.Vector3(...input.pointer.rayDirection).normalize(),
    );
    const phase = input.pointer.phase;
    const name =
      ray.intersectObject(model.group, true).find((hit) => hit.object.name)
        ?.object.name ?? "";
    if (phase === "down") {
      dragLength = name === "length-bridge" || name === "length-ruler";
      if (!dragLength) {
        progress = 0;
        playing = true;
      }
    }
    if (dragLength && phase !== "up") {
      const point = new T.Vector3();
      if (
        ray.ray.intersectPlane(
          new T.Plane(new T.Vector3(0, 1, 0), -1.02),
          point,
        )
      )
        length = Math.max(20, Math.min(120, Math.round((point.x + 4.8) * 12)));
    }
    if (phase === "up") dragLength = false;
    model.dispose();
    model = physicalScene(
      createSoundScene({ kind: "sound", length, tension, amplitude, progress }),
      "sound",
    );
  }
  const r = stringWave(length, tension, amplitude);
  const scene3d = serializePhysical(model, {
    title: "What changes pitch, and what changes wave height?",
    subtitle: "Compare string length with pluck amplitude.",
    background: ["#10212b", "#142b35", "#10212b"],
  });
  model.dispose();
  const pressure = Array.from(
    { length: 361 },
    (_, j) =>
      `${j * 2},${55 - Math.sin((j / 360) * r.frequency * 0.01 * Math.PI * 2 - progress * Math.PI * 2) * amplitude * 4.7}`,
  ).join(" ");
  return {
    vector: {
      viewBox: [0, 0, 720, 125],
      description: `Pressure trace over 10 milliseconds; ${(r.frequency * 0.01).toFixed(2)} cycles, amplitude ${amplitude} mm is enlarged schematic string displacement, not air pressure units.`,
      nodes: [
        {
          tag: "line",
          attrs: {
            x1: 0,
            y1: 55,
            x2: 720,
            y2: 55,
            stroke: "#8da5a3",
            strokeWidth: 1,
          },
          children: [],
        },
        {
          tag: "polyline",
          attrs: {
            points: pressure,
            fill: "none",
            stroke: "#339a92",
            strokeWidth: 2,
          },
          children: [],
        },
        {
          tag: "text",
          attrs: { x: 10, y: 110, fill: "#294c49", fontSize: 16 },
          children: [
            "Schematic pressure trace at one point in air · 10 milliseconds",
          ],
        },
      ],
    },
    animate: playing,
    pointer: true,
    pointerMode: "drag",
    scene3d,
    shapes: [],
    description: `Frequency ${r.frequency.toFixed(1)} Hz; ${(r.frequency * 0.01).toFixed(2)} cycles in 10 milliseconds. Air wavelength ${r.wavelength.toFixed(3)} m at 343 m/s. Pluck amplitude ${amplitude} mm; relative vibration energy ${r.relativeEnergy.toFixed(1)}. Cycle position ${(progress * 360).toFixed(0)}°. ${playing ? "Slowed vibration playing." : "Slowed vibration paused."} Frequency depends on length and tension, not amplitude in this ideal model.`,
    controls: [
      {
        id: "length",
        label: "String length (cm)",
        min: 20,
        max: 120,
        step: 1,
        value: length,
      },
      {
        id: "tension",
        label: "String tension (N)",
        min: 20,
        max: 200,
        step: 1,
        value: tension,
      },
      {
        id: "amplitude",
        label: "Pluck amplitude (mm)",
        min: 0,
        max: 8,
        step: 0.5,
        value: amplitude,
      },
      {
        id: "phase",
        label: "Cycle position (°)",
        min: 0,
        max: 360,
        step: 1,
        value: Math.round(progress * 360),
      },
    ],
    buttons: [
      { id: "play", label: playing ? "Pause" : "Play slowed vibration" },
      { id: "pluck", label: "Pluck" },
      { id: "listen", label: "Listen to ideal tone" },
      { id: "doubleLength", label: "Double length (up to 120 cm)" },
      { id: "doubleAmplitude", label: "Double amplitude (up to 8 mm)" },
      { id: "trialLength", label: "Compare length" },
      { id: "trialAmplitude", label: "Compare amplitude" },
      { id: "predictSame", label: "Predict same frequency" },
      { id: "predictDifferent", label: "Predict different frequency" },
      { id: "baseline", label: "Set baseline" },
      {
        id: "compare",
        label: trial === 0 ? "Double only length" : "Double only amplitude",
      },
    ],
    audio: [
      {
        buttonId: "listen",
        frequency: r.frequency,
        duration: 0.85,
        gain: amplitude / 100,
        waveform: "sine",
      },
    ],
    sections: [
      {
        heading: "1. Predict",
        text: `Will doubling only ${trial === 0 ? "length" : "amplitude"} change the fundamental frequency? ${prediction ? `Your prediction: ${prediction}.` : "Choose a prediction first."}`,
        buttonIds: ["predictSame", "predictDifferent"],
      },
      {
        heading: "2. Compare",
        text: "Set length 60 cm, tension 80 N and amplitude 3 mm. Record frequency, wave height and energy; change only the chosen variable.",
        buttonIds: ["baseline", "compare"],
      },
      {
        heading: "3. Explain",
        text:
          trial === 0
            ? "A longer string takes longer for a wave to travel along it. How does this connect doubled length to fewer cycles per second?"
            : "Amplitude changes wave height and energy, not the natural frequency. Why does a larger pluck not create more cycles in the same time?",
      },
    ],
    footnote:
      "Uniform ideal string, linear density 1 g/m; fundamental only, not real instrument overtones. Displacement enlarged and motion slowed: visible speed is not audio frequency. Energy index=A² compares fixed length/tension only. Air wavelength is not string wavelength. Air sound speed 343 m/s.",
  };
}
const compact = createFrameCompactor();
self.onmessage = ({ data }) =>
  self.postMessage(compact(run(data), data.type === "reset"));
