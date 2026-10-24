import { lazy, Suspense, useMemo, useState } from "react";
import { traceOrbit } from "./physics";
import { Playback, Slider } from "./SimulationPrimitives";
import { usePlayback } from "./usePlayback";
import { SpaceLearning } from "./space/SpaceLearning";
import "./space/space.css";
const SpaceCanvas = lazy(() =>
  import("./space/SpaceCanvas").then((m) => ({ default: m.SpaceCanvas })),
);
export function OrbitSimulation() {
  const [speed, setSpeed] = useState(1),
    [mass, setMass] = useState(1),
    [prediction, setPrediction] = useState<string | null>(null),
    [tested, setTested] = useState(false);
  const orbit = useMemo(() => traceOrbit(speed, mass), [speed, mass]);
  const clock = usePlayback(16, false);
  const point =
    orbit.points[
      Math.min(
        orbit.points.length - 1,
        Math.floor(clock.progress * orbit.points.length),
      )
    ];
  const radius = Math.hypot(point.x, point.y);
  const outcome =
    orbit.outcome === "orbit"
      ? "bound orbit"
      : orbit.outcome === "escape"
        ? "escape path"
        : "planet collision";
  const setLaunch = (value: number) => {
    setSpeed(value);
    clock.reset();
    setTested(false);
  };
  return (
    <div className="space-exhibit orbit-exhibit">
      <div className="space-stage">
        <header className="space-heading">
          <h2>{outcome}</h2>
          <p>Gravity pulls toward the planet throughout the flight.</p>
        </header>
        <div className="space-stage-stat">
          <strong>{radius.toFixed(2)}</strong>
          <span>distance in starting radii</span>
        </div>
        <Suspense
          fallback={<div className="space-loading">Loading flight path…</div>}
        >
          <SpaceCanvas
            kind="orbit"
            state={{ points: orbit.points, progress: clock.progress }}
            progress={clock.progress}
            onProgress={clock.setProgress}
            label={`Orbital flight laboratory. At ${speed} times baseline circular speed and ${mass} times central mass: ${outcome}. Gravity points toward the planet; motion follows the path. Distance ${radius.toFixed(2)} starting radii.`}
          />
        </Suspense>
        <div className="space-legend">
          <span>
            <i className="space-key-force" />
            Gravity toward planet
          </span>
          <span>
            <i className="space-key-motion" />
            Direction of motion
          </span>
        </div>
        <p className="space-drag">
          Drag horizontally to follow the flight path
        </p>
      </div>
      <div className="space-console">
        <Slider
          label="Launch speed"
          value={speed}
          min={0}
          max={1.8}
          step={0.02}
          unit="×"
          onChange={setLaunch}
        />
        <Slider
          label="Central mass"
          value={mass}
          min={0.5}
          max={2}
          step={0.1}
          unit="×"
          onChange={(v) => {
            setMass(v);
            clock.reset();
            setTested(false);
          }}
        />
        <div className="space-timeline">
          <Slider
            label="Trace position"
            value={Math.round(clock.progress * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => clock.setProgress(v / 100)}
          />
          <Playback
            {...clock}
            reset={() => {
              setSpeed(1);
              setMass(1);
              clock.reset();
              setTested(false);
            }}
          />
        </div>
        <div className="space-presets">
          <button
            type="button"
            aria-pressed={speed === 0.6 && mass === 1}
            onClick={() => {
              setMass(1);
              setLaunch(0.6);
            }}
          >
            0.60× speed
          </button>
          <button
            type="button"
            aria-pressed={speed === 1 && mass === 1}
            onClick={() => {
              setMass(1);
              setLaunch(1);
            }}
          >
            1.00× speed
          </button>
          <button
            type="button"
            aria-pressed={speed === 1.42 && mass === 1}
            onClick={() => {
              setMass(1);
              setLaunch(1.42);
            }}
          >
            1.42× speed
          </button>
        </div>
      </div>
      <SpaceLearning
        question="At 0.60× baseline speed, what happens?"
        choices={["Returns safely", "Hits planet", "Escapes"]}
        prediction={prediction}
        onPredict={setPrediction}
        observe={
          <>
            <p>Keep central mass at 1× and reduce only the launch speed.</p>
            <button
              className="space-test"
              type="button"
              onClick={() => {
                setMass(1);
                setSpeed(0.6);
                clock.reset();
                clock.setProgress(0.9999);
                setTested(true);
              }}
            >
              Test 0.60× speed
            </button>
            {tested && (
              <p role="status">
                {prediction === "Hits planet"
                  ? "Your prediction matches: "
                  : "Observed: "}
                the path reaches the planet.
              </p>
            )}
          </>
        }
        explain={
          <>
            <p>
              Sideways motion carries the probe forward while gravity curves its
              path inward. At this lower speed, it reaches the surface before it
              can go around.
            </p>
            <p>
              <strong>Try this</strong>: predict what 1.42× will do, then test
              it. Why does a faster launch escape even though gravity still
              acts?
            </p>
          </>
        }
      />
      <div className="space-readout">
        <span>
          Escape threshold{" "}
          <strong>{Math.sqrt(2 * mass).toFixed(3)}× baseline speed</strong>
        </span>
        <span>
          Gravity here{" "}
          <strong>{(mass / radius ** 2).toFixed(2)}× starting reference</strong>
        </span>
      </div>
      <p className="space-note">
        Fixed-step two-body model, no air resistance. The planet radius is 0.22
        starting radii; the probe is enlarged. The camera fits the whole
        trajectory. Speed stays relative to the original planet’s circular speed
        when mass changes. Arrows show direction, not force or speed to scale.
      </p>
      <p className="space-source">
        Earth surface:{" "}
        <a
          href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/"
          target="_blank"
          rel="noreferrer"
        >
          NASA Earth Observatory
        </a>
        , August 2004.
      </p>
    </div>
  );
}
