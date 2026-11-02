import { useEffect, useMemo, useState } from "react";
import {
  SOUND_DEFAULT_INPUTS,
  soundActivity,
  type SoundInputs,
} from "@family-manager/family-api/discovery-models/sound";
import { usePlayback } from "./usePlayback";
import { useStringAudio } from "./useStringAudio";
import { SoundDrawing } from "./SoundDrawing";
import {
  PhysicalLayout,
  PhysicalStage,
} from "./physical-exhibits/PhysicalStage";
import { SoundExploreControls } from "./sound/SoundExploreControls";
import { SoundPredictionTrials } from "./sound/SoundPredictionTrials";
import { useSoundLesson } from "./sound/useSoundLesson";
import "./physical-exhibits/physical-exhibits.css";

const formatFrequency = (value: number) => `${value.toFixed(1)} Hz`;

export function SoundPlaygroundSimulation() {
  const [length, setLength] = useState(SOUND_DEFAULT_INPUTS.lengthCm);
  const [tension, setTension] = useState(SOUND_DEFAULT_INPUTS.tensionN);
  const [amplitude, setAmplitude] = useState(SOUND_DEFAULT_INPUTS.amplitudeMm);
  const lesson = useSoundLesson();
  const playback = usePlayback(2);
  const audio = useStringAudio();
  const result = useMemo(
    () =>
      soundActivity({
        lengthCm: length,
        tensionN: tension,
        amplitudeMm: amplitude,
      }),
    [length, tension, amplitude],
  );
  const freeExploration = lesson.freeExploration;

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) playback.pause();
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", pauseWhenHidden);
  }, [playback]);

  const showTrial = (trial: SoundInputs) => {
    audio.stop();
    playback.pause();
    playback.setProgress(0);
    setLength(trial.lengthCm);
    setTension(trial.tensionN);
    setAmplitude(trial.amplitudeMm);
  };
  const reset = () => {
    setLength(SOUND_DEFAULT_INPUTS.lengthCm);
    setTension(SOUND_DEFAULT_INPUTS.tensionN);
    setAmplitude(SOUND_DEFAULT_INPUTS.amplitudeMm);
    lesson.resetLesson();
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
      `${i ? "L" : "M"}${i * 2},${45 - Math.sin((i / 360) * result.cyclesPerTenMilliseconds * Math.PI * 2 - playback.progress * Math.PI * 2) * amplitude * 4.7}`,
  ).join(" ");
  return (
    <PhysicalLayout
      question="After the two fixed trials, change one control at a time. Can you make the trace show more cycles without changing the model amplitude?"
      explanation="For an ideal fixed string, fundamental frequency increases with tension and decreases with vibrating length. A larger pluck changes the string’s displacement, not that natural frequency. Pitch and loudness are perceptions: frequency strongly influences pitch, while loudness also depends on sound level, frequency, hearing, the instrument body and the room."
      caveat="Model boundary: a uniform 1 g/m string vibrating in its fundamental mode, with air sound speed fixed at 343 m/s. String displacement is enlarged and motion is slowed. The pressure trace is a visual comparison, not a microphone or decibel reading; the A² index is relative only when length, tension and density stay fixed. The optional sound is a low-gain pure tone, not the wooden instrument, and actual volume depends on your device settings."
      controls={
        <>
          <SoundPredictionTrials
            lesson={lesson}
            onShowTrial={showTrial}
            onPredictionChange={() => {
              playback.pause();
              audio.stop();
            }}
          />
          <SoundExploreControls
            unlocked={freeExploration}
            length={length}
            tension={tension}
            amplitude={amplitude}
            progress={playback.progress}
            playing={playback.playing}
            audioPlaying={audio.playing}
            audioError={audio.error}
            onLength={(value) => {
              audio.stop();
              setLength(value);
            }}
            onTension={(value) => {
              audio.stop();
              setTension(value);
            }}
            onAmplitude={(value) => {
              audio.stop();
              setAmplitude(value);
            }}
            onProgress={(value) => playback.setProgress(value)}
            onToggleMotion={playback.toggle}
            onPluck={pluck}
            onToggleAudio={() =>
              audio.playing
                ? audio.stop()
                : void audio.play(result.fundamentalFrequencyHz, amplitude)
            }
            onReset={reset}
          />
        </>
      }
      readout={
        <>
          <span aria-label="Fundamental frequency">
            Fundamental frequency:{" "}
            <strong>{formatFrequency(result.fundamentalFrequencyHz)}</strong>
          </span>
          <span>
            Period: <strong>{result.periodMilliseconds.toFixed(2)} ms</strong>
          </span>
          <span>
            String fundamental wavelength:{" "}
            <strong>
              {result.stringFundamentalWavelengthMeters.toFixed(2)} m
            </strong>
          </span>
          <span>
            Sound wavelength in air:{" "}
            <strong>{result.airWavelengthMeters.toFixed(2)} m</strong>
          </span>
          <span aria-label="Relative vibration index">
            Relative vibration index:{" "}
            <strong>{result.relativeVibrationIndex}</strong>
          </span>
          <span>f = (1 ÷ 2L) × √(T ÷ μ)</span>
          {!result.hasVibration && (
            <span className="dl-sound-silent">
              The string still has a modeled natural frequency, but at 0 mm no
              vibration is being shown or played.
            </span>
          )}
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
          if (!freeExploration) return;
          if (action.type === "length") {
            audio.stop();
            setLength(action.value);
          }
          if (action.type === "pluck" && amplitude > 0) pluck();
        }}
        description={`Mounted string instrument. The movable bridge sets a ${length} centimeter vibrating length at ${tension} newtons. The ideal fundamental is ${result.fundamentalFrequencyHz.toFixed(1)} hertz and the model displacement is ${amplitude} millimeters. ${result.hasVibration ? "The visible motion is enlarged and slowed." : "At zero displacement, the string is stationary."}`}
        fallback={
          <SoundDrawing
            length={length}
            amplitude={amplitude}
            progress={playback.progress}
            frequency={result.fundamentalFrequencyHz}
          />
        }
        header={
          <div className="dl-physical-header">
            <div>
              <h3>
                <output aria-label="Frequency">
                  {formatFrequency(result.fundamentalFrequencyHz)}
                </output>
              </h3>
              <p>
                Use the fixed trials first. Afterward, drag the bridge or use
                the keyboard-accessible sliders and buttons.
              </p>
            </div>
            <div className="dl-physical-number">
              <strong>{length} cm</strong>
              <small>vibrating length</small>
            </div>
          </div>
        }
      >
        <div className="dl-physical-trace">
          <div className="dl-physical-trace-heading">
            <strong>Modeled pressure pattern at one point</strong>
            <span>
              {result.cyclesPerTenMilliseconds.toFixed(2)} cycles / 10 ms
            </span>
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
            Count cycles for frequency; compare height for the model amplitude.
            Shape and height do not by themselves measure perceived pitch or
            loudness.
          </p>
        </div>
      </PhysicalStage>
    </PhysicalLayout>
  );
}
