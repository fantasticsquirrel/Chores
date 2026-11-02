import { Slider } from "../SimulationPrimitives";

export function SoundExploreControls({
  unlocked,
  length,
  tension,
  amplitude,
  progress,
  playing,
  audioPlaying,
  audioError,
  onLength,
  onTension,
  onAmplitude,
  onProgress,
  onToggleMotion,
  onPluck,
  onToggleAudio,
  onReset,
}: {
  unlocked: boolean;
  length: number;
  tension: number;
  amplitude: number;
  progress: number;
  playing: boolean;
  audioPlaying: boolean;
  audioError: string;
  onLength: (value: number) => void;
  onTension: (value: number) => void;
  onAmplitude: (value: number) => void;
  onProgress: (value: number) => void;
  onToggleMotion: () => void;
  onPluck: () => void;
  onToggleAudio: () => void;
  onReset: () => void;
}) {
  return (
    <div className="dl-physical-control-group dl-sound-explore">
      <strong>3 · Explore one variable</strong>
      <p>
        {unlocked
          ? "Controls unlocked. Change one slider, then use the trace and numbers as evidence."
          : "Complete both comparisons to unlock the sliders."}
      </p>
      {unlocked ? (
        <>
          <Slider
            label="String length"
            value={length}
            min={20}
            max={120}
            unit=" cm"
            onChange={onLength}
          />
          <Slider
            label="String tension"
            value={tension}
            min={20}
            max={200}
            unit=" N"
            onChange={onTension}
          />
          <Slider
            label="Model amplitude"
            value={amplitude}
            min={0}
            max={8}
            step={0.5}
            unit=" mm"
            onChange={onAmplitude}
          />
          <Slider
            label="Slowed-motion position"
            value={Math.round(progress * 360)}
            min={0}
            max={360}
            unit="°"
            onChange={(value) => onProgress(value / 360)}
          />
          <div className="dl-physical-shortcuts">
            <button type="button" onClick={onToggleMotion}>
              {playing ? "Pause slowed motion" : "Play slowed motion"}
            </button>
            <button type="button" disabled={amplitude === 0} onClick={onPluck}>
              Pluck string
            </button>
            <button
              type="button"
              disabled={amplitude === 0}
              onClick={onToggleAudio}
            >
              {audioPlaying ? "Stop pure tone" : "Hear pure tone"}
            </button>
            <button type="button" onClick={onReset}>
              Reset lesson
            </button>
          </div>
          <p
            className="dl-physical-audio-error"
            role={audioError ? "alert" : undefined}
          >
            {audioError ||
              "Audio is optional and starts only when requested. The trace and measurements provide the same comparison without sound."}
          </p>
        </>
      ) : (
        <div className="dl-physical-shortcuts">
          <button type="button" onClick={onReset}>
            Reset lesson
          </button>
        </div>
      )}
    </div>
  );
}
