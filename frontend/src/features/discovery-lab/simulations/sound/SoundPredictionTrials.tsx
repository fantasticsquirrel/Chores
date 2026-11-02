import {
  SOUND_AMPLITUDE_COMPARISON,
  SOUND_LENGTH_COMPARISON,
  compareSoundTrials,
  soundActivity,
  type SoundInputs,
} from "@family-manager/family-api/discovery-models/sound";
import type {
  AmplitudePrediction,
  LengthPrediction,
  SoundLesson,
} from "./useSoundLesson";

const formatFrequency = (value: number) => `${value.toFixed(1)} Hz`;
const [shortString, longString] = SOUND_LENGTH_COMPARISON.map(soundActivity);
const [smallPluck, largePluck] = SOUND_AMPLITUDE_COMPARISON.map(soundActivity);
const lengthControls = compareSoundTrials(...SOUND_LENGTH_COMPARISON);
const amplitudeControls = compareSoundTrials(...SOUND_AMPLITUDE_COMPARISON);

function PredictionButton({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

const lengthChoices: { value: LengthPrediction; label: string }[] = [
  { value: "half", label: "Half as many cycles per second" },
  { value: "same", label: "Same number of cycles per second" },
  { value: "double", label: "Twice as many cycles per second" },
];
const amplitudeChoices: { value: AmplitudePrediction; label: string }[] = [
  { value: "same", label: "Same frequency" },
  { value: "double", label: "Double frequency" },
  { value: "quadruple", label: "Four times the frequency" },
];

export function SoundPredictionTrials({
  lesson,
  onShowTrial,
  onPredictionChange,
}: {
  lesson: SoundLesson;
  onShowTrial: (trial: SoundInputs) => void;
  onPredictionChange: () => void;
}) {
  return (
    <>
      <fieldset className="dl-sound-trial">
        <legend>1 · Predict length</legend>
        <p>
          If length changes from 60 to 120 cm while tension and pluck stay
          fixed, what happens to cycles per second?
        </p>
        <div className="dl-sound-choices">
          {lengthChoices.map((choice) => (
            <PredictionButton
              key={choice.value}
              selected={lesson.lengthPrediction === choice.value}
              onClick={() => {
                onPredictionChange();
                lesson.chooseLength(choice.value);
              }}
            >
              {choice.label}
            </PredictionButton>
          ))}
        </div>
        <button
          type="button"
          className="dl-sound-compare"
          disabled={!lesson.lengthPrediction}
          onClick={() => {
            lesson.completeLength();
            onShowTrial(SOUND_LENGTH_COMPARISON[1]);
          }}
        >
          Compare string lengths
        </button>
        {lesson.lengthComplete && (
          <div
            className="dl-sound-feedback"
            data-result={
              lesson.lengthPrediction === "half" ? "match" : "revise"
            }
            data-testid="sound-length-feedback"
          >
            <strong>
              {lesson.lengthPrediction === "half"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>
              60 cm: {formatFrequency(shortString.fundamentalFrequencyHz)} · 120
              cm: {formatFrequency(longString.fundamentalFrequencyHz)}
            </span>
            <span>
              Changed: {lengthControls.changed.join(", ")}. Held:{" "}
              {lengthControls.held.join(", ")}.
            </span>
            <div className="dl-sound-evidence-actions">
              <button
                type="button"
                onClick={() => onShowTrial(SOUND_LENGTH_COMPARISON[0])}
              >
                Show 60 cm evidence
              </button>
              <button
                type="button"
                onClick={() => onShowTrial(SOUND_LENGTH_COMPARISON[1])}
              >
                Show 120 cm evidence
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="dl-sound-trial">
        <legend>2 · Predict amplitude</legend>
        <p>
          If the model pluck doubles from 3 to 6 mm while length and tension
          stay fixed, what happens to frequency?
        </p>
        <div className="dl-sound-choices">
          {amplitudeChoices.map((choice) => (
            <PredictionButton
              key={choice.value}
              selected={lesson.amplitudePrediction === choice.value}
              onClick={() => {
                onPredictionChange();
                lesson.chooseAmplitude(choice.value);
              }}
            >
              {choice.label}
            </PredictionButton>
          ))}
        </div>
        <button
          type="button"
          className="dl-sound-compare"
          disabled={!lesson.amplitudePrediction}
          onClick={() => {
            lesson.completeAmplitude();
            onShowTrial(SOUND_AMPLITUDE_COMPARISON[1]);
          }}
        >
          Compare pluck amplitudes
        </button>
        {lesson.amplitudeComplete && (
          <div
            className="dl-sound-feedback"
            data-result={
              lesson.amplitudePrediction === "same" ? "match" : "revise"
            }
            data-testid="sound-amplitude-feedback"
          >
            <strong>
              {lesson.amplitudePrediction === "same"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>
              3 mm: {formatFrequency(smallPluck.fundamentalFrequencyHz)} · 6 mm:{" "}
              {formatFrequency(largePluck.fundamentalFrequencyHz)}
            </span>
            <span>
              Relative A² Index {smallPluck.relativeVibrationIndex} →{" "}
              {largePluck.relativeVibrationIndex}. Changed:{" "}
              {amplitudeControls.changed.join(", ")}. Held:{" "}
              {amplitudeControls.held.join(", ")}.
            </span>
            <div className="dl-sound-evidence-actions">
              <button
                type="button"
                onClick={() => onShowTrial(SOUND_AMPLITUDE_COMPARISON[0])}
              >
                Show 3 mm evidence
              </button>
              <button
                type="button"
                onClick={() => onShowTrial(SOUND_AMPLITUDE_COMPARISON[1])}
              >
                Show 6 mm evidence
              </button>
            </div>
          </div>
        )}
      </fieldset>
    </>
  );
}
