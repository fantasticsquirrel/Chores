import { useState } from "react";
import { stringWave } from "@family-manager/family-api/discovery-models/physical-world";
import { Control, Dot, Line } from "./Primitives";
import {
  Diagram,
  DiagramLabel,
  Explanation,
  LearningFrame,
  ModelNote,
} from "./LearningPrimitives";

export function SoundExploration() {
  const [length, setLength] = useState(50);
  const [tension, setTension] = useState(40);
  const [amplitude, setAmplitude] = useState(3);
  const [phase, setPhase] = useState(1);
  const wave = stringWave(length, tension, amplitude);
  const summary = `Frequency ${wave.frequency.toFixed(1)} Hz; sound wavelength in air ${wave.wavelength.toFixed(2)} m; amplitude ${amplitude} mm.`;
  return (
    <LearningFrame
      onReset={() => {
        setLength(50);
        setTension(40);
        setAmplitude(3);
        setPhase(1);
      }}
    >
      <Diagram
        visualState={{
          kind: "sound",
          length,
          tension,
          amplitude,
          progress: (phase / 4 - 0.25 + 1) % 1,
        }}
        label={`A string fixed at both ends. ${summary}`}
      >
        {(width) => (
          <>
            <Line
              x={width / 2 - ((width - 40) * length) / 200}
              y={110}
              x2={width / 2 + ((width - 40) * length) / 200}
              y2={110}
              color="#67749a"
            />
            {Array.from({ length: 50 }, (_, i) => {
              const span = ((width - 40) * length) / 100;
              const x = width / 2 - span / 2 + (i / 49) * span;
              const y =
                110 -
                Math.sin((i / 49) * Math.PI) *
                  amplitude *
                  6 *
                  Math.sin((phase * Math.PI) / 2);
              return <Dot key={i} x={x} y={y} size={4} color="#91ede4" />;
            })}
            <Dot
              x={width / 2 - ((width - 40) * length) / 200}
              y={110}
              size={12}
              color="#ffe49b"
            />
            <Dot
              x={width / 2 + ((width - 40) * length) / 200}
              y={110}
              size={12}
              color="#ffe49b"
            />
            <DiagramLabel x={20} y={15}>
              Fixed ends · fundamental vibration
            </DiagramLabel>
            <DiagramLabel x={20} y={182}>
              {length} cm long · {amplitude} mm amplitude
            </DiagramLabel>
          </>
        )}
      </Diagram>
      <Explanation>
        {summary} A higher frequency means a higher pitch. Increasing amplitude
        leaves the pitch unchanged but increases the vibration's energy.{" "}
        {amplitude === 0
          ? "At zero amplitude there is no vibration or sound; the string's natural frequency is unchanged."
          : ""}
      </Explanation>
      <Control
        label="String length (cm)"
        value={length}
        min={20}
        max={100}
        step={10}
        onChange={setLength}
      />
      <Control
        label="Tension (N)"
        value={tension}
        min={10}
        max={100}
        step={10}
        onChange={setTension}
      />
      <Control
        label="Amplitude (mm)"
        value={amplitude}
        min={0}
        max={10}
        onChange={setAmplitude}
      />
      <Control
        label="Vibration phase (quarter cycles)"
        value={phase}
        min={0}
        max={4}
        onChange={setPhase}
      />
      <ModelNote>
        Ideal string: frequency = √(tension ÷ mass per metre) ÷ (2 × length).
        Mass per metre is fixed at 0.001 kg/m. Sound speed in air is fixed at
        343 m/s. The diagram exaggerates displacement. It does not play sound or
        predict perceived loudness.
      </ModelNote>
    </LearningFrame>
  );
}
