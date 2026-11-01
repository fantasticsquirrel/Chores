import { lazy, Suspense, useMemo, useState } from "react";
import {
  GRAVITY_MASS_COMPARISON,
  GRAVITY_WORLD_COMPARISON,
  GRAVITY_WORLDS,
  gravityDropActivity,
  gravityDropAtTime,
  type GravityDropInputs,
  type GravityWorldId,
} from "@family-manager/family-api/discovery-models/gravity";
import { Slider } from "./SimulationPrimitives";
import { usePlayback } from "./usePlayback";
import {
  GravityGuidedChallenges,
  type MassPrediction,
  type WorldPrediction,
} from "./gravity/GravityGuidedChallenges";
import { GravityEvidencePlot } from "./gravity/GravityEvidencePlot";
import "./space/space.css";
import "./gravity/gravity.css";

const SpaceCanvas = lazy(() =>
  import("./space/SpaceCanvas").then((module) => ({
    default: module.SpaceCanvas,
  })),
);

type Comparison = "mass" | "world" | "open";
type Trial = { label: string; inputs: GravityDropInputs };

const MASS_TRIALS: readonly [Trial, Trial] = [
  { label: "Earth · 1 kg", inputs: GRAVITY_MASS_COMPARISON[0] },
  { label: "Earth · 10 kg", inputs: GRAVITY_MASS_COMPARISON[1] },
];
const WORLD_TRIALS: readonly [Trial, Trial] = [
  { label: "Earth · 5 kg", inputs: GRAVITY_WORLD_COMPARISON[0] },
  { label: "Moon · 5 kg", inputs: GRAVITY_WORLD_COMPARISON[1] },
];

function worldById(id: GravityWorldId) {
  return GRAVITY_WORLDS.find((world) => world.id === id) ?? GRAVITY_WORLDS[0];
}

function sceneTitle(comparison: Comparison) {
  if (comparison === "mass") return "Mass comparison";
  if (comparison === "world") return "Earth–Moon comparison";
  return "Open comparison";
}

export function GravitySimulation() {
  const [comparison, setComparison] = useState<Comparison>("mass");
  const [height, setHeight] = useState(20);
  const [mass, setMass] = useState(5);
  const [world, setWorld] = useState<GravityWorldId>("earth");
  const [massPrediction, setMassPrediction] = useState<MassPrediction>("");
  const [massComplete, setMassComplete] = useState(false);
  const [worldPrediction, setWorldPrediction] = useState<WorldPrediction>("");
  const [worldComplete, setWorldComplete] = useState(false);
  const selectedWorld = worldById(world);
  const trials = useMemo<readonly [Trial, Trial]>(() => {
    if (comparison === "mass") return MASS_TRIALS;
    if (comparison === "world") return WORLD_TRIALS;
    return [
      {
        label: "Earth · 1 kg",
        inputs: { height, mass: 1, gravity: 9.81 },
      },
      {
        label: `${selectedWorld.name} · ${mass} kg`,
        inputs: { height, mass, gravity: selectedWorld.gravity },
      },
    ];
  }, [comparison, height, mass, selectedWorld]);
  const results = trials.map((trial) => gravityDropActivity(trial.inputs));
  const duration = Math.max(...results.map((result) => result.fallTime)) + 0.55;
  const clock = usePlayback(duration, false);
  const elapsed = clock.progress * duration;
  const positions = trials.map((trial) =>
    gravityDropAtTime(trial.inputs, elapsed),
  );

  const selectComparison = (next: Comparison, atElapsed = 0) => {
    clock.pause();
    setComparison(next);
    const nextTrials = next === "mass" ? MASS_TRIALS : WORLD_TRIALS;
    const nextDuration =
      Math.max(
        ...nextTrials.map(
          (trial) => gravityDropActivity(trial.inputs).fallTime,
        ),
      ) + 0.55;
    clock.setProgress(Math.min(0.9999, atElapsed / nextDuration));
  };

  const reset = () => {
    setComparison("mass");
    setHeight(20);
    setMass(5);
    setWorld("earth");
    setMassPrediction("");
    setMassComplete(false);
    setWorldPrediction("");
    setWorldComplete(false);
    clock.reset();
  };

  const sceneLabel = `${sceneTitle(comparison)} in two vacuum-drop towers. ${trials
    .map((trial, index) => {
      const result = results[index];
      const position = positions[index];
      return `${trial.label}: local gravity ${result.acceleration.toFixed(2)} metres per second squared, weight ${result.weight.toFixed(1)} newtons, ${position.remaining.toFixed(1)} metres above the floor, calculated fall time ${result.fallTime.toFixed(2)} seconds`;
    })
    .join(". ")}. Equal ball size does not mean equal mass.`;

  return (
    <div className="gravity-lab">
      <div className="gravity-toolbar">
        <p>What changes a vacuum drop: object mass or local gravity?</p>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>

      <section className="gravity-apparatus" aria-label="Vacuum drop apparatus">
        <div className="space-stage gravity-stage">
          <header className="space-heading">
            <span className="gravity-state">{sceneTitle(comparison)}</span>
            <h2>{trials[0].inputs.height} m drop</h2>
            <p>Released together from rest in the model.</p>
          </header>
          <div className="space-stage-stat">
            <strong>
              {elapsed.toFixed(2)}
              <small>s</small>
            </strong>
            <span>elapsed time</span>
          </div>
          <Suspense
            fallback={
              <div className="space-loading">Loading drop apparatus…</div>
            }
          >
            <SpaceCanvas
              kind="gravity"
              state={{
                height: trials[1].inputs.height,
                gravity: trials[1].inputs.gravity,
                elapsed,
                mass: trials[1].inputs.mass,
                referenceGravity: trials[0].inputs.gravity,
                referenceMass: trials[0].inputs.mass,
                referenceDistance: positions[0].distance,
                comparisonDistance: positions[1].distance,
              }}
              progress={clock.progress}
              onProgress={clock.setProgress}
              label={sceneLabel}
              fallbackLabel={`${sceneTitle(comparison)}. ${trials[0].label} falls in ${results[0].fallTime.toFixed(2)} seconds; ${trials[1].label} falls in ${results[1].fallTime.toFixed(2)} seconds.`}
            />
          </Suspense>
          <p className="space-drag">
            Drag or use arrow keys to compare the same elapsed time.
          </p>
        </div>

        <div className="gravity-lane-readouts">
          {trials.map((trial, index) => (
            <div key={trial.label}>
              <span>{trial.label}</span>
              <strong>{results[index].acceleration.toFixed(2)} m/s²</strong>
              <small>
                {positions[index].landed
                  ? "At the ideal floor"
                  : `${positions[index].remaining.toFixed(1)} m above floor`}{" "}
                · {results[index].fallTime.toFixed(2)} s fall
              </small>
            </div>
          ))}
        </div>

        <div className="gravity-flight-deck">
          <GravityEvidencePlot trials={trials} elapsed={elapsed} />
          <div className="gravity-live-evidence">
            {trials.map((trial, index) => (
              <dl key={trial.label}>
                <div>
                  <dt>Trial</dt>
                  <dd>{trial.label}</dd>
                </div>
                <div>
                  <dt>Mass</dt>
                  <dd>{results[index].inputs.mass} kg</dd>
                </div>
                <div>
                  <dt>Weight</dt>
                  <dd
                    aria-label={index === 1 ? "Comparison weight" : undefined}
                  >
                    {results[index].weight.toFixed(1)} N
                  </dd>
                </div>
                <div>
                  <dt>Fall time</dt>
                  <dd
                    aria-label={
                      index === 1 ? "Comparison fall time" : undefined
                    }
                  >
                    {results[index].fallTime.toFixed(2)} s
                  </dd>
                </div>
              </dl>
            ))}
          </div>
          <div className="gravity-timeline">
            <Slider
              label="Drop timeline"
              value={Math.round(clock.progress * 100)}
              min={0}
              max={100}
              unit="%"
              onChange={(value) => clock.setProgress(value / 100)}
            />
            <div className="gravity-playback">
              <button type="button" onClick={clock.toggle}>
                {clock.playing ? "Pause motion" : "Play motion"}
              </button>
              <button type="button" onClick={clock.reset}>
                Restart drop
              </button>
            </div>
          </div>
        </div>
      </section>

      <GravityGuidedChallenges
        massPrediction={massPrediction}
        massComplete={massComplete}
        worldPrediction={worldPrediction}
        worldComplete={worldComplete}
        onMassPrediction={(prediction) => {
          setMassPrediction(prediction);
          setMassComplete(false);
          setWorldPrediction("");
          setWorldComplete(false);
          selectComparison("mass");
        }}
        onMassCompare={() => {
          setMassComplete(true);
          selectComparison(
            "mass",
            gravityDropActivity(MASS_TRIALS[0].inputs).fallTime,
          );
        }}
        onWorldPrediction={(prediction) => {
          setWorldPrediction(prediction);
          setWorldComplete(false);
          selectComparison("world");
        }}
        onWorldCompare={() => {
          setWorldComplete(true);
          selectComparison(
            "world",
            gravityDropActivity(WORLD_TRIALS[0].inputs).fallTime,
          );
        }}
        onShowEvidence={(next) =>
          selectComparison(
            next,
            gravityDropActivity(
              next === "mass" ? MASS_TRIALS[0].inputs : WORLD_TRIALS[0].inputs,
            ).fallTime,
          )
        }
      />

      <details className="gravity-open-controls">
        <summary>Open controls</summary>
        <p>
          Change one setting at a time. Guided evidence remains available above.
        </p>
        <div className="gravity-control-grid">
          <label>
            <span>Comparison world</span>
            <select
              aria-label="Comparison world"
              value={world}
              onChange={(event) => {
                setWorld(event.target.value as GravityWorldId);
                setComparison("open");
                clock.reset();
              }}
            >
              {GRAVITY_WORLDS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.gravity} m/s²
                </option>
              ))}
            </select>
          </label>
          <Slider
            label="Drop height"
            value={height}
            min={5}
            max={50}
            unit=" m"
            onChange={(value) => {
              setHeight(value);
              setComparison("open");
              clock.reset();
            }}
          />
          <Slider
            label="Comparison object mass"
            value={mass}
            min={1}
            max={20}
            unit=" kg"
            onChange={(value) => {
              setMass(value);
              setComparison("open");
              clock.reset();
            }}
          />
        </div>
      </details>

      <aside className="gravity-model-note">
        <h3>Why the drops differ—or do not</h3>
        <p>
          Mass measures matter; weight is the gravitational force on that mass.
          In a vacuum, changing mass changes weight but not free-fall
          acceleration. Changing local gravity changes both weight and
          acceleration.
        </p>
        <p>
          <strong>Model boundary:</strong> One-dimensional release from rest;
          constant local gravity over a short height; no air, wind, buoyancy,
          rotation or terrain; an ideal floor. The towers rescale distance, and
          equal ball size does not encode mass. Jupiter is excluded because it
          has no true solid surface for this floor-drop model.
        </p>
      </aside>
    </div>
  );
}
