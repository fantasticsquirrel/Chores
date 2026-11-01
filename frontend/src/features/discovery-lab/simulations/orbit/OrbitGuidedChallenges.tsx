import type { Dispatch, SetStateAction } from "react";
import {
  ORBIT_MASS_COMPARISON,
  ORBIT_SPEED_COMPARISON,
} from "@family-manager/family-api/discovery-models/orbit";
import { OrbitComparisonPlot } from "./OrbitPathDiagram";

type Props = {
  speedPrediction: string | null;
  setSpeedPrediction: Dispatch<SetStateAction<string | null>>;
  speedTested: boolean;
  runSpeedTest: () => void;
  massPrediction: string | null;
  setMassPrediction: Dispatch<SetStateAction<string | null>>;
  massTested: boolean;
  runMassTest: () => void;
};

function PredictionButtons({
  choices,
  value,
  onChange,
  disabled = false,
}: {
  choices: readonly string[];
  value: string | null;
  onChange: (choice: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="orbit-predictions">
      {choices.map((choice) => (
        <button
          type="button"
          key={choice}
          aria-pressed={value === choice}
          onClick={() => onChange(choice)}
          disabled={disabled}
        >
          {choice}
        </button>
      ))}
    </div>
  );
}

export function OrbitGuidedChallenges({
  speedPrediction,
  setSpeedPrediction,
  speedTested,
  runSpeedTest,
  massPrediction,
  setMassPrediction,
  massTested,
  runMassTest,
}: Props) {
  return (
    <div className="orbit-challenges">
      <section className="orbit-challenge orbit-speed-challenge">
        <header>
          <span>1</span>
          <div>
            <h3>Change sideways speed</h3>
            <p>
              Central mass stays 1×. Every probe starts one radius from the
              center.
            </p>
          </div>
        </header>
        <div className="orbit-challenge-action">
          <h4>Predict the three paths</h4>
          <PredictionButtons
            choices={[
              "Hit → orbit → escape",
              "All three orbit",
              "Orbit → hit → escape",
            ]}
            value={speedPrediction}
            onChange={setSpeedPrediction}
          />
          <button
            className="orbit-run"
            type="button"
            disabled={!speedPrediction}
            onClick={runSpeedTest}
          >
            Compare 0.60×, 1.00× and 1.42×
          </button>
          {!speedPrediction && <p className="orbit-gate">Predict first.</p>}
        </div>
        {speedTested && (
          <div className="orbit-observation" data-testid="orbit-speed-evidence">
            <OrbitComparisonPlot trials={ORBIT_SPEED_COMPARISON} />
            <p className="orbit-feedback" role="status">
              {speedPrediction === "Hit → orbit → escape"
                ? "The evidence matches your prediction. "
                : "The evidence differs from your prediction. "}
              At the same starting radius and mass, 0.60× collides, 1.00× stays
              bound, and 1.42× escapes. The escape path still curves inward:
              gravity has not switched off.
            </p>
          </div>
        )}
      </section>

      <section
        className={`orbit-challenge orbit-mass-challenge ${!speedTested ? "is-locked" : ""}`}
      >
        <header>
          <span>2</span>
          <div>
            <h3>Change central mass</h3>
            <p>
              Launch speed stays 1.00×. Only central mass changes from 1× to 2×.
            </p>
          </div>
        </header>
        {!speedTested && (
          <p className="orbit-locked-copy">
            Complete the speed comparison first.
          </p>
        )}
        <div className="orbit-challenge-action">
          <h4>Predict the 2×-mass path</h4>
          <PredictionButtons
            choices={[
              "Stays the same circle",
              "Curves into a tighter ellipse",
              "Escapes",
            ]}
            value={massPrediction}
            onChange={setMassPrediction}
            disabled={!speedTested}
          />
          <button
            className="orbit-run"
            type="button"
            disabled={!speedTested || !massPrediction}
            onClick={runMassTest}
          >
            Compare 1× and 2× mass
          </button>
          {speedTested && !massPrediction && (
            <p className="orbit-gate">Predict first.</p>
          )}
        </div>
        {massTested && (
          <div className="orbit-observation" data-testid="orbit-mass-evidence">
            <OrbitComparisonPlot trials={ORBIT_MASS_COMPARISON} />
            <p
              className="orbit-feedback"
              data-testid="orbit-mass-feedback"
              role="status"
            >
              {massPrediction === "Curves into a tighter ellipse"
                ? "The evidence matches your prediction. "
                : "The evidence differs from your prediction. "}
              With the same 1.00× launch, doubling central mass raises the
              circular speed to 1.414×. The unchanged launch is now too slow for
              a circle, so the bound path curves inward to 0.33 starting radii
              before returning outward.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
