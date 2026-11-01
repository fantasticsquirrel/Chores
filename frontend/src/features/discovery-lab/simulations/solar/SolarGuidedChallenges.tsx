import type { CSSProperties } from "react";

export type SolarOrbitPrediction = "" | "earth" | "neptune" | "same";
export type SolarDiameterPrediction = "" | "five" | "eleven" | "fifty";

type Props = {
  orbitPrediction: SolarOrbitPrediction;
  orbitComplete: boolean;
  diameterPrediction: SolarDiameterPrediction;
  diameterComplete: boolean;
  onOrbitPrediction: (value: SolarOrbitPrediction) => void;
  onOrbitCompare: () => void;
  onDiameterPrediction: (value: SolarDiameterPrediction) => void;
  onDiameterCompare: () => void;
};

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="solar-choice-group">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function SolarGuidedChallenges({
  orbitPrediction,
  orbitComplete,
  diameterPrediction,
  diameterComplete,
  onOrbitPrediction,
  onOrbitCompare,
  onDiameterPrediction,
  onDiameterCompare,
}: Props) {
  return (
    <div className="solar-guided" aria-label="Guided solar system comparisons">
      <section className="solar-challenge">
        <div className="solar-challenge-number" aria-hidden="true">
          01
        </div>
        <div>
          <p className="solar-step-label">Hold elapsed time at 1 Earth year</p>
          <h3>Which planet completes more of its orbit?</h3>
          <p>
            Predict first. Then compare Earth and Neptune from their starting
            markers after the same elapsed time.
          </p>
          <Choice
            label="Your orbit prediction"
            value={orbitPrediction}
            onChange={onOrbitPrediction}
            options={[
              { value: "earth", label: "Earth" },
              { value: "neptune", label: "Neptune" },
              { value: "same", label: "Same fraction" },
            ]}
          />
          <button
            className="solar-run-comparison"
            type="button"
            disabled={!orbitPrediction}
            onClick={onOrbitCompare}
          >
            Compare one Earth year
          </button>
          {orbitComplete && (
            <div
              className="solar-evidence solar-orbit-evidence"
              data-testid="solar-orbit-feedback"
              role="status"
            >
              <div className="solar-orbit-meter" aria-hidden="true">
                <span style={{ "--orbit-fill": "100%" } as CSSProperties}>
                  Earth
                </span>
                <span style={{ "--orbit-fill": "0.61%" } as CSSProperties}>
                  Neptune
                </span>
              </div>
              <p>
                The result{" "}
                {orbitPrediction === "earth" ? "matches" : "differs from"} your
                prediction. Earth completes 1.000 orbit; Neptune completes 0.006
                orbit (about 1/165). In this model, each planet uses its
                measured mean period: farther planets have longer paths and
                lower average orbital speeds. Explain why equal elapsed time
                does not produce equal orbital fractions.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="solar-challenge">
        <div className="solar-challenge-number" aria-hidden="true">
          02
        </div>
        <div>
          <p className="solar-step-label">Hold one linear diameter scale</p>
          <h3>How many Earth diameters fit across Jupiter?</h3>
          <p>
            Use equatorial diameter for both planets. The close camera is not a
            fair size comparison because it frames each planet separately.
          </p>
          {orbitComplete ? (
            <Choice
              label="Your diameter prediction"
              value={diameterPrediction}
              onChange={onDiameterPrediction}
              options={[
                { value: "five", label: "About 5×" },
                { value: "eleven", label: "About 11×" },
                { value: "fifty", label: "About 50×" },
              ]}
            />
          ) : (
            <p className="solar-locked-step">
              Complete the orbit comparison first.
            </p>
          )}
          <button
            className="solar-run-comparison"
            type="button"
            disabled={!orbitComplete || !diameterPrediction}
            onClick={onDiameterCompare}
          >
            Compare Earth and Jupiter
          </button>
          {diameterComplete && (
            <div
              className="solar-evidence solar-diameter-evidence"
              data-testid="solar-diameter-feedback"
              role="status"
            >
              <div aria-hidden="true">
                <span className="solar-earth-diameter" />
                <span className="solar-jupiter-diameter" />
              </div>
              <p>
                The result{" "}
                {diameterPrediction === "eleven" ? "matches" : "differs from"}{" "}
                your prediction. Earth is 12,756 km across; Jupiter is 142,984
                km, or 11.21 Earth diameters. Both globes now use the same
                linear diameter scale. Explain why this view cannot also fit the
                true Sun–planet gaps on the same screen.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
