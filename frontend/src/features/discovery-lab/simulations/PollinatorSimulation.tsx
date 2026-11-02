import { useId } from "react";
import {
  POLLINATOR_COMPATIBILITY_TARGETS,
  POLLINATOR_FLOWERS,
} from "@family-manager/family-api/discovery-models/pollinators";
import { Slider } from "./SimulationPrimitives";
import {
  LandscapeExhibit,
  LandscapeMetric,
} from "./landscape/LandscapeExhibit";
import { PollinatorPredictionTrials } from "./pollinator/PollinatorPredictionTrials";
import { usePollinatorLesson } from "./pollinator/usePollinatorLesson";
import "./pollinator/pollinator-express.css";

export function PollinatorSimulation() {
  const id = useId();
  const lesson = usePollinatorLesson();
  const state = lesson.journey;
  const source = state.pollen?.sourceId.startsWith("trial-")
    ? POLLINATOR_COMPATIBILITY_TARGETS[state.pollen.species].name
    : POLLINATOR_FLOWERS.find((flower) => flower.id === state.pollen?.sourceId)
        ?.name;
  const pollen = state.pollen
    ? `${state.pollen.species === "gold" ? "Gold" : "Violet"} pollen from ${source}`
    : "None yet";
  return (
    <LandscapeExhibit
      title="Trace pollen, then test what changes"
      introduction="Predict first. Compare one changed condition, read the route and transfer evidence, then explain what a flower visit did—or did not—accomplish."
      state={{
        kind: "garden",
        x: state.x,
        y: state.y,
        reach: lesson.reach,
        habitat: lesson.habitat,
        pollen: state.pollen?.species ?? "none",
        trialSpecies: lesson.trialSpecies,
        received: state.pollinated.map((flowerId) =>
          flowerId.startsWith("trial-")
            ? 1
            : POLLINATOR_FLOWERS.findIndex((flower) => flower.id === flowerId),
        ),
        path: state.path,
      }}
      onSelect={
        lesson.explorationUnlocked
          ? (index) => {
              const flower = POLLINATOR_FLOWERS[index];
              if (flower) lesson.visit(flower.id);
            }
          : undefined
      }
      description={`Dimensional teaching garden with raised soil, enlarged flower structures and a bee. ${lesson.trialSpecies === "none" ? "The fixed trial flower is inactive." : `The fixed trial flower is set to ${lesson.trialSpecies} type.`} ${lesson.habitat ? "A bridge habitat patch containing a Gold and a Violet flower spans the central gap." : "The central gap has no bridge habitat patch."} Bee at ${state.x}, ${state.y}; reach ${lesson.reach} invented garden units. Route records ${state.visits} visits, ${state.transfers} compatible transfers and ${state.pollinated.length} receiving flowers. Carried pollen: ${pollen}. ${state.message}`}
      controls={
        lesson.explorationUnlocked ? (
          <section
            className="pollinator-explore"
            aria-labelledby={`${id}-explore`}
          >
            <div className="pollinator-explore-heading">
              <div>
                <h3 id={`${id}-explore`}>Explore one change at a time</h3>
                <p>
                  Return to the nest before comparing a new route. A ✓ means
                  compatible pollen received in this model—not a seed produced.
                </p>
              </div>
              <button type="button" onClick={lesson.reset}>
                Reset lesson
              </button>
            </div>
            <div className="pollinator-free-controls">
              <Slider
                label="Flight reach"
                value={lesson.reach}
                min={80}
                max={240}
                step={10}
                unit=" garden units"
                onChange={lesson.setReach}
              />
              <label className="pollinator-switch">
                <input
                  type="checkbox"
                  checked={lesson.habitat}
                  onChange={(event) => lesson.setHabitat(event.target.checked)}
                />{" "}
                Add bridge habitat patch (Gold and Violet)
              </label>
              <button type="button" onClick={lesson.returnToNest}>
                Return to nest
              </button>
            </div>
            <div
              className="landscape-flower-controls pollinator-flower-controls"
              role="group"
              aria-label="Visit a flower"
            >
              {lesson.availableFlowers.map((flower) => {
                const distance = Math.hypot(
                  flower.x - state.x,
                  flower.y - state.y,
                );
                return (
                  <button
                    key={flower.id}
                    type="button"
                    aria-label={`Visit ${flower.name}`}
                    data-species={flower.species}
                    onClick={() => lesson.visit(flower.id)}
                  >
                    {flower.name}
                    {state.pollinated.includes(flower.id) ? " ✓" : ""}
                    <small>
                      {distance <= lesson.reach
                        ? "Within reach"
                        : "Beyond reach"}{" "}
                      · {Math.round(distance)} units
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="pollinator-locked">
            <span>
              Complete both prediction-first comparisons to unlock reach,
              habitat and flower controls.
            </span>
            <button type="button" onClick={lesson.reset}>
              Reset lesson
            </button>
          </div>
        )
      }
      evidence={
        <div className="pollinator-current" role="status" aria-live="polite">
          <div className="landscape-metrics pollinator-metrics">
            <LandscapeMetric label="Flower visits" value={`${state.visits}`} />
            <LandscapeMetric
              label="Compatible transfers"
              value={`${state.transfers}`}
            />
            <LandscapeMetric
              label="Receiving flowers"
              value={`${state.pollinated.length}`}
            />
            <LandscapeMetric label="Pollen carried" value={pollen} />
          </div>
          <p>
            <strong>{state.message}</strong> Flower visits: {state.visits} ·
            Compatible transfers: {state.transfers} · Receiving flowers:{" "}
            {state.pollinated.length}. Dashed circle: maximum modeled reach.
            Raised pale ring and ✓: compatible pollen received. No mark
            represents fertilization, fruit or seed.
          </p>
        </div>
      }
      investigations={<PollinatorPredictionTrials lesson={lesson} />}
      note="Model boundary: every coordinate, flower placement, reach value and route is invented for a deterministic comparison, not an ecological measurement, probability or forecast. The bee remembers only the last flower’s pollen; real pollinators can carry mixed loads. The model records transfer only between different flowers of the same displayed type, while real plants vary in self-pollination and compatibility. Flowers, pollen structures and the bee are enlarged for inspection. Pollinators seek resources such as nectar and pollen; a plant may receive pollen during a visit, but visits do not guarantee pollination, fertilization, fruit or seeds."
    />
  );
}
