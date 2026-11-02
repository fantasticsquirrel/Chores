import { useState } from "react";
import { Text, View } from "react-native";
import {
  SOUND_AMPLITUDE_COMPARISON,
  SOUND_DEFAULT_INPUTS,
  SOUND_LENGTH_COMPARISON,
  compareSoundTrials,
  soundActivity,
  type SoundInputs,
} from "@family-manager/family-api/discovery-models/sound";
import { ActionButton } from "../../../components/ActionButton";
import { colors } from "../../../styles/colors";
import { Control, Dot, Line } from "./Primitives";
import {
  Choice,
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";

type LengthPrediction = "" | "half" | "same" | "double";
type AmplitudePrediction = "" | "same" | "double" | "quadruple";

const lengthEvidence = SOUND_LENGTH_COMPARISON.map(soundActivity);
const amplitudeEvidence = SOUND_AMPLITUDE_COMPARISON.map(soundActivity);
const lengthVariables = compareSoundTrials(...SOUND_LENGTH_COMPARISON);
const amplitudeVariables = compareSoundTrials(...SOUND_AMPLITUDE_COMPARISON);

export function SoundExploration() {
  const [inputs, setInputs] = useState<SoundInputs>(SOUND_DEFAULT_INPUTS);
  const [phase, setPhase] = useState(0);
  const [lengthPrediction, setLengthPrediction] =
    useState<LengthPrediction>("");
  const [lengthComplete, setLengthComplete] = useState(false);
  const [amplitudePrediction, setAmplitudePrediction] =
    useState<AmplitudePrediction>("");
  const [amplitudeComplete, setAmplitudeComplete] = useState(false);
  const activity = soundActivity(inputs);
  const summary = `Fundamental ${activity.fundamentalFrequencyHz.toFixed(1)} Hz; ${activity.cyclesPerTenMilliseconds.toFixed(2)} cycles per 10 ms; modeled midpoint displacement amplitude ${inputs.amplitudeMm} mm; relative A² index ${activity.relativeVibrationIndex}.`;
  const showTrial = (trial: SoundInputs) => {
    setInputs(trial);
    setPhase(0);
  };

  const reset = () => {
    setInputs(SOUND_DEFAULT_INPUTS);
    setPhase(0);
    setLengthPrediction("");
    setLengthComplete(false);
    setAmplitudePrediction("");
    setAmplitudeComplete(false);
  };

  return (
    <LearningFrame onReset={reset}>
      <Diagram
        visualState={{
          kind: "sound",
          length: inputs.lengthCm,
          tension: inputs.tensionN,
          amplitude: inputs.amplitudeMm,
          progress: phase / 4,
        }}
        label={`A mounted string fixed at both ends. ${summary} The visible displacement is enlarged and the phase control shows slowed motion.`}
      >
        {(width) => (
          <>
            <Line
              x={width / 2 - ((width - 40) * inputs.lengthCm) / 240}
              y={110}
              x2={width / 2 + ((width - 40) * inputs.lengthCm) / 240}
              y2={110}
              color="#67749a"
            />
            {Array.from({ length: 50 }, (_, i) => {
              const span = ((width - 40) * inputs.lengthCm) / 120;
              const x = width / 2 - span / 2 + (i / 49) * span;
              const y =
                110 -
                Math.sin((i / 49) * Math.PI) *
                  inputs.amplitudeMm *
                  6 *
                  Math.cos((phase * Math.PI) / 2);
              return <Dot key={i} x={x} y={y} size={4} color="#91ede4" />;
            })}
            <Dot
              x={width / 2 - ((width - 40) * inputs.lengthCm) / 240}
              y={110}
              size={12}
              color="#ffe49b"
            />
            <Dot
              x={width / 2 + ((width - 40) * inputs.lengthCm) / 240}
              y={110}
              size={12}
              color="#ffe49b"
            />
            <DiagramLabel x={20} y={15}>
              Fixed ends · ideal fundamental
            </DiagramLabel>
            <DiagramLabel x={20} y={182}>
              {inputs.lengthCm} cm · {inputs.tensionN} N · {inputs.amplitudeMm}{" "}
              mm
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {summary} Frequency is connected to perceived pitch, but they are not
        identical. This screen gives complete visual and numerical evidence; it
        does not play audio.
      </Explanation>

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        1. Compare string lengths
      </Text>
      <Explanation>
        Keep tension at 80 N and model amplitude at 3 mm. What happens when the
        vibrating length changes from 60 to 120 cm?
      </Explanation>
      <Choice
        label="Your length prediction"
        value={lengthPrediction}
        onChange={(value) => {
          setLengthPrediction(value);
          setLengthComplete(false);
        }}
        options={[
          { value: "half", label: "Half as many cycles per second" },
          { value: "same", label: "Same number of cycles per second" },
          { value: "double", label: "Twice as many cycles per second" },
        ]}
      />
      <ActionButton
        label="Compare string lengths"
        disabled={!lengthPrediction}
        onPress={() => {
          setLengthComplete(true);
          showTrial(SOUND_LENGTH_COMPARISON[1]);
        }}
      />
      {lengthComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {lengthPrediction === "half" ? "matches" : "differs from"} your
            prediction. 60 cm:{" "}
            {lengthEvidence[0].fundamentalFrequencyHz.toFixed(1)} Hz · 120 cm:{" "}
            {lengthEvidence[1].fundamentalFrequencyHz.toFixed(1)} Hz. Changed:{" "}
            {lengthVariables.changed.join(", ")}. Held:{" "}
            {lengthVariables.held.join(" · ")}.
          </Explanation>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionButton
              label="Show 60 cm evidence"
              variant="secondary"
              onPress={() => showTrial(SOUND_LENGTH_COMPARISON[0])}
            />
            <ActionButton
              label="Show 120 cm evidence"
              variant="secondary"
              onPress={() => showTrial(SOUND_LENGTH_COMPARISON[1])}
            />
          </View>
        </>
      )}

      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}
      >
        2. Compare model amplitudes
      </Text>
      <Explanation>
        Keep length at 60 cm and tension at 80 N. What happens to frequency when
        the modeled displacement doubles from 3 to 6 mm?
      </Explanation>
      <Choice
        label="Your amplitude prediction"
        value={amplitudePrediction}
        onChange={(value) => {
          setAmplitudePrediction(value);
          setAmplitudeComplete(false);
        }}
        options={[
          { value: "same", label: "Same frequency" },
          { value: "double", label: "Double frequency" },
          { value: "quadruple", label: "Four times the frequency" },
        ]}
      />
      <ActionButton
        label="Compare model amplitudes"
        disabled={!amplitudePrediction}
        onPress={() => {
          setAmplitudeComplete(true);
          showTrial(SOUND_AMPLITUDE_COMPARISON[1]);
        }}
      />
      {amplitudeComplete && (
        <>
          <Explanation>
            The evidence{" "}
            {amplitudePrediction === "same" ? "matches" : "differs from"} your
            prediction. 3 mm:{" "}
            {amplitudeEvidence[0].fundamentalFrequencyHz.toFixed(1)} Hz · 6 mm:{" "}
            {amplitudeEvidence[1].fundamentalFrequencyHz.toFixed(1)} Hz.
            Relative A² index {amplitudeEvidence[0].relativeVibrationIndex} →{" "}
            {amplitudeEvidence[1].relativeVibrationIndex}. Changed:{" "}
            {amplitudeVariables.changed.join(", ")}. Held:{" "}
            {amplitudeVariables.held.join(" · ")}.
          </Explanation>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ActionButton
              label="Show 3 mm evidence"
              variant="secondary"
              onPress={() => showTrial(SOUND_AMPLITUDE_COMPARISON[0])}
            />
            <ActionButton
              label="Show 6 mm evidence"
              variant="secondary"
              onPress={() => showTrial(SOUND_AMPLITUDE_COMPARISON[1])}
            />
          </View>
        </>
      )}

      {lengthComplete && amplitudeComplete && (
        <>
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}
          >
            3. Explore one variable
          </Text>
          <Control
            label="String length (cm)"
            value={inputs.lengthCm}
            min={20}
            max={120}
            step={10}
            onChange={(lengthCm) =>
              setInputs((current) => ({ ...current, lengthCm }))
            }
          />
          <Control
            label="String tension (N)"
            value={inputs.tensionN}
            min={20}
            max={200}
            step={20}
            onChange={(tensionN) =>
              setInputs((current) => ({ ...current, tensionN }))
            }
          />
          <Control
            label="Model amplitude (mm)"
            value={inputs.amplitudeMm}
            min={0}
            max={8}
            onChange={(amplitudeMm) =>
              setInputs((current) => ({ ...current, amplitudeMm }))
            }
          />
          <Control
            label="Slowed-motion phase"
            value={phase}
            min={0}
            max={4}
            onChange={setPhase}
          />
        </>
      )}

      <ModelNote>
        Model boundary: uniform 1 g/m ideal string, fixed ends, fundamental
        mode, and air speed 343 m/s. String wavelength is 2L; wavelength in air
        is 343 ÷ frequency. Displacement is enlarged; no acoustic radiation is
        calculated. The A² index is only a relative comparison at fixed length,
        tension and density; it is not a decibel or loudness reading. Real
        instruments add harmonics, an instrument body and a time envelope.
      </ModelNote>
    </LearningFrame>
  );
}
