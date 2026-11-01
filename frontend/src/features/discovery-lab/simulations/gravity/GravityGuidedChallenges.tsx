import {
  GRAVITY_MASS_COMPARISON,
  GRAVITY_WORLD_COMPARISON,
  gravityDropActivity,
} from "@family-manager/family-api/discovery-models/gravity";

export type MassPrediction = "" | "light" | "heavy" | "same";
export type WorldPrediction = "" | "earth" | "moon" | "same";

type Props = {
  massPrediction: MassPrediction;
  massComplete: boolean;
  worldPrediction: WorldPrediction;
  worldComplete: boolean;
  onMassPrediction: (prediction: MassPrediction) => void;
  onMassCompare: () => void;
  onWorldPrediction: (prediction: WorldPrediction) => void;
  onWorldCompare: () => void;
  onShowEvidence: (comparison: "mass" | "world") => void;
};

function PredictionButton<T extends string>({
  value,
  selected,
  children,
  onSelect,
}: {
  value: T;
  selected: boolean;
  children: string;
  onSelect: (value: T) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(value)}
    >
      {children}
    </button>
  );
}

export function GravityGuidedChallenges({
  massPrediction,
  massComplete,
  worldPrediction,
  worldComplete,
  onMassPrediction,
  onMassCompare,
  onWorldPrediction,
  onWorldCompare,
  onShowEvidence,
}: Props) {
  const [light, heavy] = GRAVITY_MASS_COMPARISON.map(gravityDropActivity);
  const [earth, moon] = GRAVITY_WORLD_COMPARISON.map(gravityDropActivity);

  return (
    <div className="gravity-challenges">
      <section className="gravity-challenge">
        <header>
          <span>Investigation 1</span>
          <h3>Change only mass</h3>
          <p>Keep Earth gravity and the 20 m release height fixed.</p>
        </header>
        <fieldset>
          <legend>Which object lands first?</legend>
          <div className="gravity-predictions">
            <PredictionButton
              value="light"
              selected={massPrediction === "light"}
              onSelect={onMassPrediction}
            >
              1 kg lands first
            </PredictionButton>
            <PredictionButton
              value="heavy"
              selected={massPrediction === "heavy"}
              onSelect={onMassPrediction}
            >
              10 kg lands first
            </PredictionButton>
            <PredictionButton
              value="same"
              selected={massPrediction === "same"}
              onSelect={onMassPrediction}
            >
              Same landing time
            </PredictionButton>
          </div>
        </fieldset>
        <button
          className="gravity-run"
          type="button"
          disabled={!massPrediction}
          onClick={onMassCompare}
        >
          Compare 1 kg and 10 kg
        </button>
        {massComplete && (
          <div
            className="gravity-feedback"
            data-testid="gravity-mass-feedback"
            role="status"
          >
            <strong>
              The result{" "}
              {massPrediction === "same" ? "matches" : "differs from"} your
              prediction.
            </strong>
            <p>
              Both accelerate at 9.81 m/s² and land in{" "}
              {light.fallTime.toFixed(2)} s. The 1 kg object weighs{" "}
              {light.weight.toFixed(2)} N; the 10 kg object weighs{" "}
              {heavy.weight.toFixed(1)} N. Gravity pulls harder on more mass,
              but that mass also has proportionally more inertia—resistance to a
              change in motion—so the acceleration stays the same.
            </p>
            <p>
              Explain: Why can weight change while the vacuum landing time does
              not?
            </p>
            <button type="button" onClick={() => onShowEvidence("mass")}>
              Show mass evidence
            </button>
          </div>
        )}
      </section>

      <section className="gravity-challenge">
        <header>
          <span>Investigation 2</span>
          <h3>Change only local gravity</h3>
          <p>Keep mass at 5 kg and the 20 m release height fixed.</p>
        </header>
        {massComplete ? (
          <fieldset>
            <legend>How does the Moon drop compare with Earth?</legend>
            <div className="gravity-predictions">
              <PredictionButton
                value="earth"
                selected={worldPrediction === "earth"}
                onSelect={onWorldPrediction}
              >
                Earth takes longer
              </PredictionButton>
              <PredictionButton
                value="moon"
                selected={worldPrediction === "moon"}
                onSelect={onWorldPrediction}
              >
                Moon takes longer
              </PredictionButton>
              <PredictionButton
                value="same"
                selected={worldPrediction === "same"}
                onSelect={onWorldPrediction}
              >
                Same landing time
              </PredictionButton>
            </div>
          </fieldset>
        ) : (
          <p className="gravity-locked">Complete the mass comparison first.</p>
        )}
        <button
          className="gravity-run"
          type="button"
          disabled={!massComplete || !worldPrediction}
          onClick={onWorldCompare}
        >
          Compare Earth and Moon
        </button>
        {worldComplete && (
          <div
            className="gravity-feedback"
            data-testid="gravity-world-feedback"
            role="status"
          >
            <strong>
              The result{" "}
              {worldPrediction === "moon" ? "matches" : "differs from"} your
              prediction.
            </strong>
            <p>
              Earth: {earth.fallTime.toFixed(2)} s and {earth.weight.toFixed(1)}{" "}
              N. Moon: {moon.fallTime.toFixed(2)} s and {moon.weight.toFixed(1)}{" "}
              N. The same mass accelerates more slowly where local gravity is
              weaker, so the Moon drop takes longer.
            </p>
            <p>
              Explain: Which held value proves that mass did not cause the
              different fall times?
            </p>
            <button type="button" onClick={() => onShowEvidence("world")}>
              Show world evidence
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
