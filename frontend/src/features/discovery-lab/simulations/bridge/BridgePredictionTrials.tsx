import {
  BRIDGE_LOAD_COMPARISON,
  BRIDGE_POSITION_COMPARISON,
  bridgeActivity,
  compareBridgeTrials,
  type BridgeInputs,
} from "@family-manager/family-api/discovery-models/bridge";
import type {
  BridgeLesson,
  LoadPrediction,
  PositionPrediction,
} from "./useBridgeLesson";

const positionEvidence = BRIDGE_POSITION_COMPARISON.map(bridgeActivity);
const loadEvidence = BRIDGE_LOAD_COMPARISON.map(bridgeActivity);
const positionVariables = compareBridgeTrials(...BRIDGE_POSITION_COMPARISON);
const loadVariables = compareBridgeTrials(...BRIDGE_LOAD_COMPARISON);

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

const positionChoices: {
  value: PositionPrediction;
  label: string;
}[] = [
  { value: "left", label: "Left support carries more" },
  { value: "right", label: "Right support carries more" },
  { value: "equal", label: "Both supports stay equal" },
];

const loadChoices: { value: LoadPrediction; label: string }[] = [
  {
    value: "both-double",
    label: "Moment and deflection both double",
  },
  {
    value: "moment-only",
    label: "Moment doubles; deflection stays the same",
  },
  { value: "quadruple", label: "Moment and deflection both quadruple" },
];

function formatPositionEvidence(
  label: string,
  evidence: (typeof positionEvidence)[number],
) {
  return `${label}: left ${evidence.leftReactionKilonewtons.toFixed(1)} kN · right ${evidence.rightReactionKilonewtons.toFixed(1)} kN · peak moment ${evidence.peakBendingMomentKilonewtonMeters.toFixed(1)} kN·m · deflection at load ${evidence.deflectionAtLoadMillimeters.toFixed(2)} mm`;
}

export function BridgePredictionTrials({
  lesson,
  onShowTrial,
  onPredictionChange,
}: {
  lesson: BridgeLesson;
  onShowTrial: (trial: BridgeInputs) => void;
  onPredictionChange: () => void;
}) {
  return (
    <>
      <fieldset className="dl-bridge-trial">
        <legend>1 · Move the same load</legend>
        <p>
          Move 12 kN from the center to 20% of the span. Which support carries
          more while span, flexural rigidity and brace index stay fixed?
        </p>
        <div className="dl-bridge-choices">
          {positionChoices.map((choice) => (
            <PredictionButton
              key={choice.value}
              selected={lesson.positionPrediction === choice.value}
              onClick={() => {
                onPredictionChange();
                lesson.choosePosition(choice.value);
              }}
            >
              {choice.label}
            </PredictionButton>
          ))}
        </div>
        <button
          type="button"
          className="dl-bridge-compare"
          disabled={!lesson.positionPrediction}
          onClick={() => {
            lesson.completePosition();
            onShowTrial(BRIDGE_POSITION_COMPARISON[1]);
          }}
        >
          Compare load positions
        </button>
        {lesson.positionComplete && (
          <div
            className="dl-bridge-feedback"
            role="status"
            aria-live="polite"
            data-result={
              lesson.positionPrediction === "left" ? "match" : "revise"
            }
            data-testid="bridge-position-feedback"
          >
            <strong>
              {lesson.positionPrediction === "left"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>{formatPositionEvidence("Center", positionEvidence[0])}</span>
            <span>{formatPositionEvidence("20%", positionEvidence[1])}</span>
            <span>
              Changed: {positionVariables.changed.join(", ")}. Held:{" "}
              {positionVariables.held.join(" · ")}.
            </span>
            <span>
              The nearer support carries more, while the peak moment and
              load-point deflection are smaller than at midspan.
            </span>
            <div className="dl-bridge-evidence-actions">
              <button
                type="button"
                onClick={() => onShowTrial(BRIDGE_POSITION_COMPARISON[0])}
              >
                Show center evidence
              </button>
              <button
                type="button"
                onClick={() => onShowTrial(BRIDGE_POSITION_COMPARISON[1])}
              >
                Show 20% evidence
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="dl-bridge-trial">
        <legend>2 · Double the point load</legend>
        <p>
          At midspan, change only the point load from 8 to 16 kN. What happens
          to peak moment and deflection at the load?
        </p>
        <div className="dl-bridge-choices">
          {loadChoices.map((choice) => (
            <PredictionButton
              key={choice.value}
              selected={lesson.loadPrediction === choice.value}
              onClick={() => {
                onPredictionChange();
                lesson.chooseLoad(choice.value);
              }}
            >
              {choice.label}
            </PredictionButton>
          ))}
        </div>
        <button
          type="button"
          className="dl-bridge-compare"
          disabled={!lesson.loadPrediction}
          onClick={() => {
            lesson.completeLoad();
            onShowTrial(BRIDGE_LOAD_COMPARISON[1]);
          }}
        >
          Compare point loads
        </button>
        {lesson.loadComplete && (
          <div
            className="dl-bridge-feedback"
            role="status"
            aria-live="polite"
            data-result={
              lesson.loadPrediction === "both-double" ? "match" : "revise"
            }
            data-testid="bridge-load-feedback"
          >
            <strong>
              {lesson.loadPrediction === "both-double"
                ? "The evidence matches your prediction."
                : "The evidence differs from your prediction."}
            </strong>
            <span>
              8 kN:{" "}
              {loadEvidence[0].peakBendingMomentKilonewtonMeters.toFixed(1)}
              {" kN·m and "}
              {loadEvidence[0].deflectionAtLoadMillimeters.toFixed(2)} mm · 16
              kN: {loadEvidence[1].peakBendingMomentKilonewtonMeters.toFixed(1)}
              {" kN·m and "}
              {loadEvidence[1].deflectionAtLoadMillimeters.toFixed(2)} mm
            </span>
            <span>
              Changed: {loadVariables.changed.join(", ")}. Held:{" "}
              {loadVariables.held.join(" · ")}.
            </span>
            <span>
              In this linear beam model, doubling one static point load doubles
              both quantities; it does not establish a safe load.
            </span>
            <div className="dl-bridge-evidence-actions">
              <button
                type="button"
                onClick={() => onShowTrial(BRIDGE_LOAD_COMPARISON[0])}
              >
                Show 8 kN evidence
              </button>
              <button
                type="button"
                onClick={() => onShowTrial(BRIDGE_LOAD_COMPARISON[1])}
              >
                Show 16 kN evidence
              </button>
            </div>
          </div>
        )}
      </fieldset>
    </>
  );
}
