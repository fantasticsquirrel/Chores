import { lazy, Suspense, useState } from "react";
import { gravityDrop } from "./physics";
import { Playback, Slider } from "./SimulationPrimitives";
import { usePlayback } from "./usePlayback";
import { SpaceLearning } from "./space/SpaceLearning";
import { fallAtTime, WORLDS } from "./space/spaceModels";
import "./space/space.css";
const SpaceCanvas = lazy(() =>
  import("./space/SpaceCanvas").then((m) => ({ default: m.SpaceCanvas })),
);
export function GravitySimulation() {
  const [height, setHeight] = useState(20),
    [mass, setMass] = useState(5),
    [world, setWorld] = useState(0),
    [prediction, setPrediction] = useState<string | null>(null),
    [tested, setTested] = useState(false);
  const chosen = WORLDS[world],
    result = gravityDrop(height, chosen.g),
    earth = gravityDrop(height, 9.81);
  const duration = Math.max(result.time, earth.time) + 1,
    clock = usePlayback(duration, false),
    elapsed = clock.progress * duration;
  const reference = fallAtTime(height, 9.81, elapsed),
    comparison = fallAtTime(height, chosen.g, elapsed);
  return (
    <div className="space-exhibit gravity-exhibit">
      <div className="space-stage gravity-stage">
        <header className="space-heading">
          <h2>{height} m drop</h2>
          <p>Released together from rest. No air resistance.</p>
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
            state={{ height, gravity: chosen.g, elapsed, mass }}
            progress={clock.progress}
            onProgress={clock.setProgress}
            label={`Two-world gravity drop. Earth reference: 1 kilogram, ${earth.time.toFixed(2)} seconds fall time. ${chosen.name} comparison: ${mass} kilograms, ${result.time.toFixed(2)} seconds fall time. Mass changes weight, not acceleration in a vacuum.`}
          />
        </Suspense>
        <p className="space-drag">
          Drag horizontally to advance or rewind the drop
        </p>
      </div>
      <div className="gravity-labels">
        <div>
          <span>Earth reference · 1 kg</span>
          <strong>9.81 m/s²</strong>
          <small>
            {reference.landed
              ? "Landed"
              : `${(height - reference.distance).toFixed(1)} m above floor`}{" "}
            · {earth.time.toFixed(2)} s fall
          </small>
        </div>
        <div>
          <span>
            {chosen.name} · {mass} kg
          </span>
          <strong>{chosen.g} m/s²</strong>
          <small>
            {comparison.landed
              ? "Landed"
              : `${(height - comparison.distance).toFixed(1)} m above floor`}{" "}
            · {result.time.toFixed(2)} s fall
          </small>
        </div>
      </div>
      <div className="space-console">
        <label className="space-select">
          Comparison world
          <select
            aria-label="Comparison world"
            value={world}
            onChange={(e) => {
              setWorld(Number(e.target.value));
              clock.reset();
              setTested(false);
            }}
          >
            {WORLDS.map((w, i) => (
              <option key={w.name} value={i}>
                {w.name}
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
          onChange={(v) => {
            setHeight(v);
            clock.reset();
            setTested(false);
          }}
        />
        <Slider
          label="Comparison object mass"
          value={mass}
          min={1}
          max={20}
          unit=" kg"
          onChange={(v) => {
            setMass(v);
            setTested(false);
          }}
        />
        <div className="space-timeline">
          <Slider
            label="Timeline"
            value={Math.round(clock.progress * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => clock.setProgress(v / 100)}
          />
          <Playback {...clock} />
        </div>
      </div>
      <SpaceLearning
        question="On Earth, which object reaches the floor first?"
        choices={["1 kg object", "10 kg object", "Same time"]}
        prediction={prediction}
        onPredict={setPrediction}
        observe={
          <>
            <p>Use the same height and gravity. Change only the mass.</p>
            <button
              className="space-test"
              type="button"
              onClick={() => {
                setWorld(0);
                setMass(10);
                clock.reset();
                clock.setProgress(0.9999);
                setTested(true);
              }}
            >
              Compare 1 kg with 10 kg
            </button>
            {tested && (
              <p role="status">
                Both land after {earth.time.toFixed(2)} s. The 10 kg object has
                ten times the weight, but the same acceleration.
              </p>
            )}
          </>
        }
        explain={
          <>
            <p>
              Gravity pulls harder on more mass, but more mass also takes more
              force to accelerate. With no air resistance, these effects
              balance: both objects fall together.
            </p>
            <p>
              <strong>Try this</strong>: predict whether the same drop takes
              longer on the Moon. Select Moon, reset, and compare at the same
              elapsed time.
            </p>
          </>
        }
      />
      <div className="space-readout">
        <span>
          {chosen.name} fall time{" "}
          <strong aria-label="Comparison fall time">
            {result.time.toFixed(2)} s
          </strong>
        </span>
        <span>
          Impact speed <strong>{result.speed.toFixed(1)} m/s</strong>
        </span>
        <span>
          Comparison weight{" "}
          <strong aria-label="Comparison weight">
            {(mass * chosen.g).toFixed(1)} N
          </strong>
        </span>
      </div>
      <p className="space-note">
        Mass is the amount of matter; weight is the gravitational force on it.
        The Earth reference weighs 9.81 N. Both objects have the same
        illustrated size; mass does not determine size alone. Gravity is
        constant over these small heights. The towers rescale to the chosen
        height. Jupiter’s gravity refers to its cloud-top region, not a solid
        surface.
      </p>
    </div>
  );
}
