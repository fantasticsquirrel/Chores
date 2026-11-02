import {
  POLLINATOR_COMPATIBILITY_TRIAL,
  POLLINATOR_HABITAT_TRIAL,
  comparePollinatorRoutes,
} from "@family-manager/family-api/discovery-models/pollinators";
import type {
  CompatibilityPrediction,
  HabitatPrediction,
  PollinatorLesson,
} from "./usePollinatorLesson";

const compatibility = comparePollinatorRoutes(
  POLLINATOR_COMPATIBILITY_TRIAL.baseline,
  POLLINATOR_COMPATIBILITY_TRIAL.comparison,
)!;
const habitat = comparePollinatorRoutes(
  POLLINATOR_HABITAT_TRIAL.baseline,
  POLLINATOR_HABITAT_TRIAL.comparison,
)!;

function Choices<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly { value: T; label: string }[];
  selected: T | null;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="pollinator-predictions">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected === option.value}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PollinatorPredictionTrials({
  lesson,
}: {
  lesson: PollinatorLesson;
}) {
  return (
    <div className="pollinator-learning">
      <div className="pollinator-trials">
        <fieldset className="pollinator-trial">
          <legend>1 · Change the second flower</legend>
          <p>
            The bee visits Gold 1 first. Reach 170, the nest, habitat and every
            coordinate stay fixed. Which second flower receives compatible
            pollen in this model?
          </p>
          <Choices<CompatibilityPrediction>
            options={[
              { value: "gold", label: "Gold trial flower" },
              { value: "violet", label: "Violet trial flower" },
              { value: "neither", label: "Neither flower" },
            ]}
            selected={lesson.compatibilityPrediction}
            onSelect={lesson.setCompatibilityPrediction}
          />
          <button
            className="pollinator-compare"
            type="button"
            disabled={!lesson.compatibilityPrediction}
            onClick={lesson.compareCompatibility}
          >
            Compare the two second flowers
          </button>
          {lesson.compatibilityCompared && (
            <div
              className="pollinator-feedback"
              data-testid="pollinator-compatibility-feedback"
              aria-live="polite"
            >
              <strong>
                {lesson.compatibilityPrediction === "gold"
                  ? "The evidence matches your prediction."
                  : "The evidence differs from your prediction."}
              </strong>
              <p>
                Gold 1 → fixed Gold trial flower:{" "}
                {compatibility.baseline.visits} visits ·{" "}
                {compatibility.baseline.transfers} compatible transfer ·{" "}
                {compatibility.baseline.receivedCount} receiving flower.
              </p>
              <p>
                Gold 1 → fixed Violet trial flower:{" "}
                {compatibility.comparison.visits} visits ·{" "}
                {compatibility.comparison.transfers} compatible transfers ·{" "}
                {compatibility.comparison.receivedCount} receiving flowers.
              </p>
              <p>
                Changed: trial flower species. Held: its position, start, Gold 1
                first, reach 170, no extra habitat, coordinates and transfer
                rule. A visit alone did not tell us whether compatible pollen
                moved.
              </p>
              <div className="pollinator-evidence-actions">
                <button
                  type="button"
                  onClick={lesson.showCompatibilityBaseline}
                >
                  Show Gold trial evidence
                </button>
                <button
                  type="button"
                  onClick={lesson.showCompatibilityComparison}
                >
                  Show Violet trial evidence
                </button>
              </div>
            </div>
          )}
        </fieldset>
        <fieldset className="pollinator-trial">
          <legend>2 · Add a bridge habitat patch</legend>
          <p>
            The bee starts at the same nest and reach stays 170. The same
            planned route always attempts the Gold bridge stop. Which habitat
            condition reaches Gold 3 under the invented distance rule?
          </p>
          <Choices<HabitatPrediction>
            options={[
              { value: "without", label: "Without habitat" },
              { value: "with", label: "With habitat" },
              { value: "both", label: "Both routes" },
            ]}
            selected={lesson.habitatPrediction}
            onSelect={lesson.setHabitatPrediction}
          />
          <button
            className="pollinator-compare"
            type="button"
            disabled={!lesson.habitatPrediction}
            onClick={lesson.compareHabitat}
          >
            Compare routes with and without habitat
          </button>
          {lesson.habitatCompared && (
            <div
              className="pollinator-feedback"
              data-testid="pollinator-habitat-feedback"
              aria-live="polite"
            >
              <strong>
                {lesson.habitatPrediction === "with"
                  ? "The evidence matches your prediction."
                  : "The evidence differs from your prediction."}
              </strong>
              <p>
                Without habitat: Gold 3 blocked · {habitat.baseline.visits}{" "}
                visits · {habitat.baseline.transfers} compatible transfer.
              </p>
              <p>
                With habitat: Gold 3 reached · {habitat.comparison.visits}{" "}
                visits · {habitat.comparison.transfers} compatible transfers.
              </p>
              <p>
                Changed: one bridge habitat patch containing a Gold and a Violet
                flower is present. Held: nest, reach 170, target, planned route,
                coordinates and transfer rule. The fixed planned route uses the
                Gold bridge stop; the Violet flower is part of the visible patch
                but is not visited in this trial. The added modeled stop
                shortens each flight; this does not forecast a real population
                response.
              </p>
              <div className="pollinator-evidence-actions">
                <button type="button" onClick={lesson.showHabitatBaseline}>
                  Show blocked route
                </button>
                <button type="button" onClick={lesson.showHabitatComparison}>
                  Show connected route
                </button>
              </div>
            </div>
          )}
        </fieldset>
      </div>
      <div className="pollinator-process">
        <strong>What the model does—and does not—show</strong>
        <p>
          Pollination is pollen transfer to a flower’s receptive part.
          Fertilization can happen later, after a compatible pollen grain grows
          a tube and a sperm cell joins an egg cell. Seed dispersal moves formed
          seeds away from a parent plant. This lesson records only the first
          process; a received-pollen mark is not a fertilized ovule, fruit or
          seed.
        </p>
      </div>
    </div>
  );
}
