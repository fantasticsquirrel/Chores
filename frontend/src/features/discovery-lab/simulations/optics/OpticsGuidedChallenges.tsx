import {
  OPTICS_CRITICAL_COMPARISON,
  OPTICS_DIRECTION_COMPARISON,
  opticsActivity,
  type OpticsInputs,
} from "@family-manager/family-api/discovery-models/optics";

type Props = {
  criticalPrediction: string | null;
  setCriticalPrediction: (prediction: string) => void;
  criticalTested: boolean;
  runCriticalTest: () => void;
  directionPrediction: string | null;
  setDirectionPrediction: (prediction: string) => void;
  directionTested: boolean;
  runDirectionTest: () => void;
  showTrial: (trial: OpticsInputs) => void;
};

function Choice({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect}>
      {children}
    </button>
  );
}

function Trial({
  trial,
  onShow,
}: {
  trial: OpticsInputs;
  onShow: (trial: OpticsInputs) => void;
}) {
  const result = opticsActivity(trial);
  const outcome = result.tir
    ? "no transmitted ray"
    : `refracted ${result.refractedAngle?.toFixed(1)}°`;
  return (
    <button
      type="button"
      className="optics-trial"
      onClick={() => onShow(trial)}
      aria-label={`Show ${trial.angle}° ${result.from.name} to ${result.to.name}: ${outcome}`}
    >
      <span>
        {result.from.name} → {result.to.name} · {trial.angle}°
      </span>
      <strong>{outcome}</strong>
    </button>
  );
}

export function OpticsGuidedChallenges(props: Props) {
  const criticalTrials = OPTICS_CRITICAL_COMPARISON.map(opticsActivity);
  const directionTrials = OPTICS_DIRECTION_COMPARISON.map(opticsActivity);
  return (
    <div className="optics-challenges">
      <section>
        <div className="optics-challenge-heading">
          <span aria-hidden="true">01</span>
          <div>
            <h3>Cross the critical angle</h3>
            <p>Keep glass → air fixed. Change only the angle: 40° to 43°.</p>
          </div>
        </div>
        <fieldset>
          <legend>At 43°, what happens to the transmitted ray?</legend>
          <div className="optics-choices">
            <Choice
              selected={props.criticalPrediction === "none"}
              onSelect={() => props.setCriticalPrediction("none")}
            >
              No transmitted ray
            </Choice>
            <Choice
              selected={props.criticalPrediction === "remains"}
              onSelect={() => props.setCriticalPrediction("remains")}
            >
              Transmitted ray remains
            </Choice>
          </div>
        </fieldset>
        <button
          type="button"
          className="optics-run"
          disabled={!props.criticalPrediction}
          onClick={props.runCriticalTest}
        >
          Compare 40° and 43°
        </button>
        {props.criticalTested && (
          <div
            className="optics-evidence"
            data-testid="optics-critical-evidence"
            role="status"
          >
            <div className="optics-trials">
              {OPTICS_CRITICAL_COMPARISON.map((trial) => (
                <Trial
                  key={trial.angle}
                  trial={trial}
                  onShow={props.showTrial}
                />
              ))}
            </div>
            <p>
              {props.criticalPrediction === "none"
                ? "The result matches your prediction. "
                : "The result differs from your prediction. "}
              At 40°, the refracted ray is{" "}
              {criticalTrials[0].refractedAngle?.toFixed(1)}°. The glass → air
              critical angle is {criticalTrials[0].criticalAngle?.toFixed(1)}°;
              43° is above it, so no transmitted ray remains.
              <strong>
                {" "}
                Explain: Why does the 43° ray stay in glass while the 40° ray
                crosses the boundary?
              </strong>
            </p>
          </div>
        )}
      </section>

      <section className={!props.criticalTested ? "is-locked" : undefined}>
        <div className="optics-challenge-heading">
          <span aria-hidden="true">02</span>
          <div>
            <h3>Reverse the boundary</h3>
            <p>Keep the angle at 30°. Compare air → glass with glass → air.</p>
          </div>
        </div>
        {props.criticalTested ? (
          <fieldset>
            <legend>How will the refracted ray change?</legend>
            <div className="optics-choices">
              <Choice
                selected={props.directionPrediction === "opposite"}
                onSelect={() => props.setDirectionPrediction("opposite")}
              >
                Toward in glass; away in air
              </Choice>
              <Choice
                selected={props.directionPrediction === "same"}
                onSelect={() => props.setDirectionPrediction("same")}
              >
                Same bend in both directions
              </Choice>
            </div>
          </fieldset>
        ) : (
          <p className="optics-lock-note">
            Complete the critical-angle comparison first.
          </p>
        )}
        <button
          type="button"
          className="optics-run"
          disabled={!props.criticalTested || !props.directionPrediction}
          onClick={props.runDirectionTest}
        >
          Compare both directions
        </button>
        {props.directionTested && (
          <div
            className="optics-evidence"
            data-testid="optics-direction-evidence"
            role="status"
          >
            <div className="optics-trials">
              {OPTICS_DIRECTION_COMPARISON.map((trial) => (
                <Trial
                  key={`${trial.from}-${trial.to}`}
                  trial={trial}
                  onShow={props.showTrial}
                />
              ))}
            </div>
            <p>
              {props.directionPrediction === "opposite"
                ? "The result matches your prediction. "
                : "The result differs from your prediction. "}
              Air → glass bends toward the normal to{" "}
              {directionTrials[0].refractedAngle?.toFixed(1)}°. Glass → air
              bends away to {directionTrials[1].refractedAngle?.toFixed(1)}°.
              The reflected angle stays 30° in both trials.
              <strong>
                {" "}
                Explain: Why does reversing the boundary change the bend even
                though the incident angle stays fixed?
              </strong>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
