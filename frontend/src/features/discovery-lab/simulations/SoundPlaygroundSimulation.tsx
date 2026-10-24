import { useState } from "react";
import { stringWave } from "@family-manager/family-api/discovery-models/physical-world";
import { Playback, Slider } from "./SimulationPrimitives";
import { usePlayback } from "./usePlayback";
import { useStringAudio } from "./useStringAudio";
import { SoundDrawing } from "./SoundDrawing";
import {
  PhysicalLayout,
  PhysicalStage,
} from "./physical-exhibits/PhysicalStage";
import "./physical-exhibits/physical-exhibits.css";
export function SoundPlaygroundSimulation() {
  const [length, setLength] = useState(60),
    [tension, setTension] = useState(80),
    [amplitude, setAmplitude] = useState(3);
  const playback = usePlayback(2),
    audio = useStringAudio(),
    result = stringWave(length, tension, amplitude);
  const reset = () => {
    setLength(60);
    setTension(80);
    setAmplitude(3);
    playback.reset();
    audio.stop();
  };
  const pluck = () => {
    playback.setProgress(0);
    if (!playback.playing) playback.toggle();
  };
  const pressure = Array.from(
    { length: 361 },
    (_, i) =>
      `${i ? "L" : "M"}${i * 2},${45 - Math.sin((i / 360) * result.frequency * 0.01 * Math.PI * 2 - playback.progress * Math.PI * 2) * amplitude * 4.7}`,
  ).join(" ");
  return (
    <PhysicalLayout
      question="Predict the pitch after doubling length while tension stays fixed. Reset, then double only the amplitude. Compare frequency, wave height and vibration energy. Which change produces more cycles in 10 milliseconds?"
      explanation="A longer string has a lower fundamental frequency; greater tension raises it. A larger pluck makes a taller vibration and increases energy without changing this ideal string’s natural frequency. The pressure trace shows the resulting cycles at one point in the air."
      caveat="Uniform ideal string, linear density 1 g/m, fundamental mode only. String displacement is enlarged and motion slowed; visible speed is not audio frequency. Energy index is amplitude² and is comparable only at fixed length and tension. The pressure trace is schematic, not a microphone measurement. Air sound speed is held at 343 m/s."
      controls={
        <>
          <div className="dl-physical-control-group">
            <Slider
              label="String length"
              value={length}
              min={20}
              max={120}
              unit=" cm"
              onChange={setLength}
            />
            <Slider
              label="String tension"
              value={tension}
              min={20}
              max={200}
              unit=" N"
              onChange={setTension}
            />
          </div>
          <div className="dl-physical-control-group">
            <Slider
              label="Pluck amplitude"
              value={amplitude}
              min={0}
              max={8}
              step={0.5}
              unit=" mm"
              onChange={setAmplitude}
            />
            <Slider
              label="Cycle position"
              value={Math.round(playback.progress * 360)}
              min={0}
              max={360}
              unit="°"
              onChange={(value) => playback.setProgress(value / 360)}
            />
          </div>
          <div className="dl-physical-control-group">
            <Playback
              playing={playback.playing}
              toggle={playback.toggle}
              reset={reset}
            />
            <div className="dl-physical-shortcuts">
              <button
                type="button"
                onClick={() => setLength(length * 2)}
                disabled={length > 60}
              >
                Double length
              </button>
              <button
                type="button"
                onClick={() => setAmplitude(amplitude * 2)}
                disabled={amplitude > 4 || amplitude === 0}
              >
                Double amplitude
              </button>
              <button type="button" onClick={pluck}>
                Pluck string
              </button>
              <button
                type="button"
                onClick={() => void audio.play(result.frequency, amplitude)}
                disabled={amplitude === 0 || audio.playing}
              >
                Hear this note
              </button>
            </div>
            <p className="dl-physical-audio-error">
              {audio.error ||
                "Audio plays only when requested: a quiet pure tone, not a recorded instrument."}
            </p>
          </div>
        </>
      }
      readout={
        <>
          <span>
            Period: <strong>{(1000 / result.frequency).toFixed(2)} ms</strong>
          </span>
          <span>
            Sound wavelength in air:{" "}
            <strong>{result.wavelength.toFixed(2)} m</strong>
          </span>
          <span>
            Relative vibration energy:{" "}
            <strong>
              <output aria-label="Relative vibration energy">
                {result.relativeEnergy}
              </output>
            </strong>
          </span>
          <span>f = (1 ÷ 2L) × √(T ÷ μ)</span>
        </>
      }
    >
      <PhysicalStage
        state={{
          kind: "sound",
          length,
          tension,
          amplitude,
          progress: playback.progress,
        }}
        onAction={(action) => {
          if (action.type === "length") setLength(action.value);
          if (action.type === "pluck") pluck();
        }}
        description={`Mounted string instrument. The movable bridge sets a ${length} centimeter vibrating length at ${tension} newtons of tension. Natural frequency ${result.frequency.toFixed(1)} hertz; pluck amplitude ${amplitude} millimeters. Motion is slowed and displacement enlarged.`}
        fallback={
          <SoundDrawing
            length={length}
            amplitude={amplitude}
            progress={playback.progress}
            frequency={result.frequency}
          />
        }
        header={
          <div className="dl-physical-header">
            <div>
              <h3>
                <output aria-label="Frequency">
                  {result.frequency.toFixed(1)} Hz
                </output>
              </h3>
              <p>
                Drag the movable bridge to change vibrating length. Tap the
                string to pluck it.
              </p>
            </div>
            <div className="dl-physical-number">
              <strong>{length} cm</strong>
              <small>between the fixed ends</small>
            </div>
          </div>
        }
      >
        <div className="dl-physical-trace">
          <div className="dl-physical-trace-heading">
            <strong>Air pressure at one point</strong>
            <span>{(result.frequency * 0.01).toFixed(2)} cycles / 10 ms</span>
          </div>
          <svg
            viewBox="0 0 720 90"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="physical-pressure-grid"
                width="72"
                height="22.5"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M72 0H0V22.5"
                  stroke="#29434b"
                  fill="none"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="720" height="90" fill="url(#physical-pressure-grid)" />
            <path d="M0 45H720" stroke="#627f85" strokeDasharray="3 4" />
            <path
              d={pressure}
              fill="none"
              stroke="#a8e1ca"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="dl-physical-trace-axis">
            <span>0 ms</span>
            <span>10 ms</span>
          </div>
          <p>
            More cycles in this time window means higher pitch. A taller wave
            means greater amplitude.
          </p>
        </div>
      </PhysicalStage>
    </PhysicalLayout>
  );
}
