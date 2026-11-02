import * as T from "three";
import { createFrameCompactor } from "../shared/compact-frame";
import { physicalScene, serializePhysical } from "../shared/physical-scene";
import {
  SOUND_AMPLITUDE_COMPARISON,
  SOUND_DEFAULT_INPUTS,
  SOUND_LENGTH_COMPARISON,
  compareSoundTrials,
  soundActivity,
  type SoundInputs,
} from "./model";
import { createSoundScene } from "./soundScene";

type LengthPrediction = "" | "half" | "same" | "double";
type AmplitudePrediction = "" | "same" | "double" | "quadruple";

let inputs: SoundInputs = { ...SOUND_DEFAULT_INPUTS };
let progress = 0;
let playing = false;
let dragLength = false;
let lengthPrediction: LengthPrediction = "";
let amplitudePrediction: AmplitudePrediction = "";
let lengthComplete = false;
let amplitudeComplete = false;

const lengthEvidence = SOUND_LENGTH_COMPARISON.map(soundActivity);
const amplitudeEvidence = SOUND_AMPLITUDE_COMPARISON.map(soundActivity);
const lengthVariables = compareSoundTrials(...SOUND_LENGTH_COMPARISON);
const amplitudeVariables = compareSoundTrials(...SOUND_AMPLITUDE_COMPARISON);

function reset() {
  inputs = { ...SOUND_DEFAULT_INPUTS };
  progress = 0;
  playing = false;
  dragLength = false;
  lengthPrediction = "";
  amplitudePrediction = "";
  lengthComplete = false;
  amplitudeComplete = false;
}

function showTrial(trial: SoundInputs) {
  inputs = { ...trial };
  progress = 0;
  playing = false;
}

function updateFromControl(key: string, value: number) {
  if (!(lengthComplete && amplitudeComplete) || !Number.isFinite(value)) return;
  if (key === "length") inputs.lengthCm = Math.max(20, Math.min(120, value));
  if (key === "tension") inputs.tensionN = Math.max(20, Math.min(200, value));
  if (key === "amplitude") inputs.amplitudeMm = Math.max(0, Math.min(8, value));
  if (key === "phase") progress = Math.max(0, Math.min(1, value / 360));
}

function run(input: any) {
  if (input.type === "reset") reset();
  const key = input.control as string | undefined;
  const value = key ? input.values?.[key] : undefined;
  if (input.type === "control" && Number.isFinite(value))
    updateFromControl(key ?? "", value);

  if (key === "lengthHalf") {
    lengthPrediction = "half";
    lengthComplete = false;
    playing = false;
  }
  if (key === "lengthSame") {
    lengthPrediction = "same";
    lengthComplete = false;
    playing = false;
  }
  if (key === "lengthDouble") {
    lengthPrediction = "double";
    lengthComplete = false;
    playing = false;
  }
  if (key === "compareLength" && lengthPrediction) {
    lengthComplete = true;
    showTrial(SOUND_LENGTH_COMPARISON[1]);
  }
  if (key === "showLengthShort") showTrial(SOUND_LENGTH_COMPARISON[0]);
  if (key === "showLengthLong") showTrial(SOUND_LENGTH_COMPARISON[1]);

  if (key === "amplitudeSame") {
    amplitudePrediction = "same";
    amplitudeComplete = false;
    playing = false;
  }
  if (key === "amplitudeDouble") {
    amplitudePrediction = "double";
    amplitudeComplete = false;
    playing = false;
  }
  if (key === "amplitudeQuadruple") {
    amplitudePrediction = "quadruple";
    amplitudeComplete = false;
    playing = false;
  }
  if (key === "compareAmplitude" && amplitudePrediction) {
    amplitudeComplete = true;
    showTrial(SOUND_AMPLITUDE_COMPARISON[1]);
  }
  if (key === "showAmplitudeSmall") showTrial(SOUND_AMPLITUDE_COMPARISON[0]);
  if (key === "showAmplitudeLarge") showTrial(SOUND_AMPLITUDE_COMPARISON[1]);

  const freeExploration = lengthComplete && amplitudeComplete;
  if (freeExploration && key === "play") playing = !playing;
  if (freeExploration && key === "pluck" && inputs.amplitudeMm > 0) {
    progress = 0;
    playing = true;
  }
  if (playing && input.dt > 0) progress = (progress + input.dt / 2) % 1;

  let model = physicalScene(
    createSoundScene({
      kind: "sound",
      length: inputs.lengthCm,
      tension: inputs.tensionN,
      amplitude: inputs.amplitudeMm,
      progress,
    }),
    "sound",
  );
  if (freeExploration && input.type === "pointer" && input.pointer?.rayOrigin) {
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
      if (!dragLength && inputs.amplitudeMm > 0) {
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
        inputs.lengthCm = Math.max(
          20,
          Math.min(120, Math.round((point.x + 4.8) * 12)),
        );
    }
    if (phase === "up") dragLength = false;
    model.dispose();
    model = physicalScene(
      createSoundScene({
        kind: "sound",
        length: inputs.lengthCm,
        tension: inputs.tensionN,
        amplitude: inputs.amplitudeMm,
        progress,
      }),
      "sound",
    );
  }

  const result = soundActivity(inputs);
  const scene3d = serializePhysical(model, {
    title: `${result.fundamentalFrequencyHz.toFixed(1)} Hz · ${inputs.lengthCm} cm vibrating length`,
    subtitle: "Use the fixed trials before changing the instrument.",
    background: ["#10212b", "#142b35", "#10212b"],
  });
  model.dispose();
  const midpointTrace = Array.from(
    { length: 361 },
    (_, j) =>
      `${j * 2},${55 - Math.sin((j / 360) * result.cyclesPerTenMilliseconds * Math.PI * 2 - progress * Math.PI * 2) * inputs.amplitudeMm * 4.7}`,
  ).join(" ");

  const buttons = [
    {
      id: "lengthHalf",
      label: "Half as many cycles per second",
      pressed: lengthPrediction === "half",
    },
    {
      id: "lengthSame",
      label: "Same number of cycles per second",
      pressed: lengthPrediction === "same",
    },
    {
      id: "lengthDouble",
      label: "Twice as many cycles per second",
      pressed: lengthPrediction === "double",
    },
    {
      id: "compareLength",
      label: "Compare string lengths",
      disabled: !lengthPrediction,
    },
    ...(lengthComplete
      ? [
          { id: "showLengthShort", label: "Show 60 cm evidence" },
          { id: "showLengthLong", label: "Show 120 cm evidence" },
        ]
      : []),
    {
      id: "amplitudeSame",
      label: "Same frequency",
      pressed: amplitudePrediction === "same",
    },
    {
      id: "amplitudeDouble",
      label: "Double frequency",
      pressed: amplitudePrediction === "double",
    },
    {
      id: "amplitudeQuadruple",
      label: "Four times the frequency",
      pressed: amplitudePrediction === "quadruple",
    },
    {
      id: "compareAmplitude",
      label: "Compare model amplitudes",
      disabled: !amplitudePrediction,
    },
    ...(amplitudeComplete
      ? [
          { id: "showAmplitudeSmall", label: "Show 3 mm evidence" },
          { id: "showAmplitudeLarge", label: "Show 6 mm evidence" },
        ]
      : []),
    ...(freeExploration
      ? [
          {
            id: "play",
            label: playing ? "Pause slowed motion" : "Play slowed motion",
          },
          {
            id: "pluck",
            label: "Pluck string",
            disabled: !result.hasVibration,
          },
          {
            id: "listen",
            label: "Hear low-gain pure tone",
            disabled: !result.hasVibration,
          },
        ]
      : []),
  ];

  const lengthText = lengthComplete
    ? `The evidence ${lengthPrediction === "half" ? "matches" : "differs from"} your prediction. 60 cm: ${lengthEvidence[0].fundamentalFrequencyHz.toFixed(1)} Hz · 120 cm: ${lengthEvidence[1].fundamentalFrequencyHz.toFixed(1)} Hz. Changed: ${lengthVariables.changed.join(", ")}. Held: ${lengthVariables.held.join(" · ")}.`
    : "Keep tension at 80 N and model amplitude at 3 mm. Predict what happens when length changes from 60 to 120 cm, then compare.";
  const amplitudeText = amplitudeComplete
    ? `The evidence ${amplitudePrediction === "same" ? "matches" : "differs from"} your prediction. 3 mm: ${amplitudeEvidence[0].fundamentalFrequencyHz.toFixed(1)} Hz · 6 mm: ${amplitudeEvidence[1].fundamentalFrequencyHz.toFixed(1)} Hz. Relative A² index ${amplitudeEvidence[0].relativeVibrationIndex} → ${amplitudeEvidence[1].relativeVibrationIndex}. Changed: ${amplitudeVariables.changed.join(", ")}. Held: ${amplitudeVariables.held.join(" · ")}.`
    : "Keep length at 60 cm and tension at 80 N. Predict what happens to frequency when model displacement changes from 3 to 6 mm, then compare.";

  return {
    vector: {
      viewBox: [0, 0, 720, 125],
      description: `Modeled string midpoint displacement over 10 milliseconds: amplitude ${inputs.amplitudeMm} millimeters and ${result.cyclesPerTenMilliseconds.toFixed(2)} cycles. No acoustic radiation is calculated.`,
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
            points: midpointTrace,
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
            `String midpoint displacement · ±${inputs.amplitudeMm} mm · ${result.cyclesPerTenMilliseconds.toFixed(2)} cycles in 10 ms`,
          ],
        },
      ],
    },
    animate: playing,
    pointer: freeExploration,
    pointerMode: "drag",
    scene3d,
    shapes: [],
    description: `Fundamental ${result.fundamentalFrequencyHz.toFixed(1)} Hz; ${result.cyclesPerTenMilliseconds.toFixed(2)} cycles in 10 ms. Length ${inputs.lengthCm} cm; tension ${inputs.tensionN} N; modeled midpoint displacement amplitude ${inputs.amplitudeMm} mm; relative A² index ${result.relativeVibrationIndex}. ${result.hasVibration ? "Visible displacement is enlarged." : "The natural frequency remains defined, but the string is stationary at zero displacement."} ${playing ? "Slowed motion is playing." : "Slowed motion is paused."}`,
    readoutColumns: 4,
    readouts: [
      {
        label: "Fundamental",
        value: `${result.fundamentalFrequencyHz.toFixed(1)} Hz`,
      },
      {
        label: "Cycles / 10 ms",
        value: result.cyclesPerTenMilliseconds.toFixed(2),
      },
      {
        label: "String wavelength",
        value: `${result.stringFundamentalWavelengthMeters.toFixed(2)} m`,
        detail: "Fixed-end fundamental: 2L",
      },
      {
        label: "Air wavelength",
        value: `${result.airWavelengthMeters.toFixed(2)} m`,
        detail: "Using 343 m/s",
      },
      {
        label: "Relative A² index",
        value: String(result.relativeVibrationIndex),
        detail: "Not decibels or loudness",
      },
    ],
    controls: freeExploration
      ? [
          {
            id: "length",
            label: "String length (cm)",
            min: 20,
            max: 120,
            step: 1,
            value: inputs.lengthCm,
          },
          {
            id: "tension",
            label: "String tension (N)",
            min: 20,
            max: 200,
            step: 1,
            value: inputs.tensionN,
          },
          {
            id: "amplitude",
            label: "Model amplitude (mm)",
            min: 0,
            max: 8,
            step: 0.5,
            value: inputs.amplitudeMm,
          },
          {
            id: "phase",
            label: "Slowed-motion position (°)",
            min: 0,
            max: 360,
            step: 1,
            value: Math.round(progress * 360),
          },
        ]
      : [],
    buttons,
    audio:
      freeExploration && result.hasVibration
        ? [
            {
              buttonId: "listen",
              frequency: result.fundamentalFrequencyHz,
              duration: 0.85,
              gain: Math.min(0.018, 0.006 + (inputs.amplitudeMm / 8) * 0.012),
              waveform: "sine",
            },
          ]
        : [],
    sections: [
      {
        heading: "1. Predict and compare length",
        text: lengthText,
        buttonIds: buttons
          .filter(
            (button) =>
              button.id.startsWith("length") ||
              button.id === "compareLength" ||
              button.id.startsWith("showLength"),
          )
          .map((button) => button.id),
      },
      {
        heading: "2. Predict and compare amplitude",
        text: amplitudeText,
        buttonIds: buttons
          .filter(
            (button) =>
              button.id.startsWith("amplitude") ||
              button.id === "compareAmplitude" ||
              button.id.startsWith("showAmplitude"),
          )
          .map((button) => button.id),
      },
      {
        heading: "3. Explore one variable",
        text: freeExploration
          ? "Controls are unlocked. Change one slider, then use the cycle count and measurements as evidence. Optional audio starts only when requested; the midpoint-displacement trace supplies the comparison without sound."
          : "Complete both fixed comparisons to unlock the controls, slowed motion and optional pure tone.",
        buttonIds: buttons
          .filter((button) => ["play", "pluck", "listen"].includes(button.id))
          .map((button) => button.id),
      },
      {
        heading: "Explain the evidence",
        text: "For this ideal string, frequency rises with tension and falls with vibrating length. Model amplitude changes displacement and the relative A² index, not the natural frequency. Frequency strongly influences perceived pitch; loudness also depends on level, frequency, hearing, the instrument body and the room.",
      },
    ],
    footnote:
      "Model boundary: uniform 1 g/m ideal string, fixed ends and fundamental mode; air speed 343 m/s. String displacement is enlarged and motion slowed. The trace is modeled string midpoint displacement in mm over 10 ms; no acoustic radiation is calculated. A² is relative only at fixed length, tension and density. Optional audio is a low-gain pure tone, not this instrument; actual volume depends on device settings. Real sounds add harmonics, body response and a time envelope.",
  };
}

const compact = createFrameCompactor();
self.onmessage = ({ data }) =>
  self.postMessage(compact(run(data), data.type === "reset"));
