import { lazy, Suspense, useState } from "react";
import { Playback, Slider } from "./SimulationPrimitives";
import { usePlayback } from "./usePlayback";
import { SpaceLearning } from "./space/SpaceLearning";
import { PLANETS } from "./space/spaceModels";
import "./space/space.css";
const SpaceCanvas = lazy(() =>
  import("./space/SpaceCanvas").then((m) => ({ default: m.SpaceCanvas })),
);
export function SolarSystemSimulation() {
  const [selected, setSelected] = useState(2),
    [speed, setSpeed] = useState(1),
    [mode, setMode] = useState("orbits"),
    [prediction, setPrediction] = useState<string | null>(null),
    [tested, setTested] = useState(false);
  const clock = usePlayback(60 / speed),
    planet = PLANETS[selected],
    years = clock.progress * 10;
  return (
    <div className="space-exhibit solar-exhibit">
      <div
        className={`space-stage solar-stage ${mode === "sizes" ? "solar-size-stage" : ""}`}
      >
        <header className="space-heading">
          <h2>{planet.name}</h2>
          <p>
            {planet.kind} · planet {selected + 1} from the Sun
          </p>
        </header>
        <div className="space-stage-stat">
          <strong>
            {mode === "sizes"
              ? (planet.diameter / 12756).toFixed(2)
              : planet.year}
            <small>×</small>
          </strong>
          <span>{mode === "sizes" ? "Earth’s diameter" : "Earth’s year"}</span>
        </div>
        <Suspense
          fallback={<div className="space-loading">Loading planets…</div>}
        >
          <SpaceCanvas
            kind="solar"
            state={{ selected, earthYears: years, mode }}
            progress={clock.progress}
            onProgress={clock.setProgress}
            label={`${mode === "sizes" ? "Planet diameter comparison" : "Solar system orbit map"}. ${planet.name}, ${planet.distance} AU from the Sun, year ${planet.year} Earth years, diameter ${planet.diameter.toLocaleString()} kilometers. ${mode === "sizes" ? "Both globes use the same diameter scale." : "Eight planets with schematic distances and enlarged sizes; selected planet shown separately in close-up."}`}
          />
        </Suspense>
        {mode === "orbits" ? (
          <>
            <div className="solar-map-label">
              Eight orbits · schematic distances
            </div>
            <div className="solar-globe-label">
              {planet.name} close-up · separate size scale
            </div>
            <p className="space-drag">
              Drag horizontally to change orbital time
            </p>
          </>
        ) : (
          <div className="solar-size-labels">
            <span>
              Earth
              <br />
              <strong>12,756 km</strong>
            </span>
            <span>
              {planet.name}
              <br />
              <strong>{planet.diameter.toLocaleString()} km</strong>
            </span>
          </div>
        )}
      </div>
      <div className="space-planet-picker" aria-label="Planet shortcuts">
        {PLANETS.map((p, i) => (
          <button
            type="button"
            key={p.name}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            <i style={{ background: p.color }} />
            <span>{p.name}</span>
            <small>{i + 1}</small>
          </button>
        ))}
      </div>
      <div className="space-console">
        <label className="space-select">
          Choose a planet
          <select
            aria-label="Choose a planet"
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {PLANETS.map((p, i) => (
              <option key={p.name} value={i}>
                {i + 1}. {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-select">
          View
          <select
            aria-label="View"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="orbits">Schematic orbit map</option>
            <option value="sizes">True diameter comparison</option>
          </select>
        </label>
        <Slider
          label="Time speed"
          value={speed}
          min={1}
          max={10}
          unit="×"
          onChange={setSpeed}
        />
        <div className="space-timeline">
          <Slider
            label="Model time"
            value={Math.round(clock.progress * 100)}
            min={0}
            max={99}
            unit="%"
            onChange={(v) => clock.setProgress(v / 100)}
          />
          <Playback {...clock} />
        </div>
      </div>
      <div className="space-readout">
        <span>
          Distance <strong>{planet.distance} AU</strong>
        </span>
        <span>
          Year <strong>{planet.year} Earth years</strong>
        </span>
        <span>
          Elapsed <strong>{years.toFixed(2)} Earth years</strong>
        </span>
      </div>
      <SpaceLearning
        question="In one Earth year, which completes more of its orbit?"
        choices={["Earth", "Neptune", "Same fraction"]}
        prediction={prediction}
        onPredict={setPrediction}
        observe={
          <>
            <p>Compare Earth and Neptune at the same elapsed time.</p>
            <button
              className="space-test"
              type="button"
              onClick={() => {
                setMode("orbits");
                setSelected(7);
                clock.reset();
                clock.setProgress(0.1);
                setTested(true);
              }}
            >
              Advance one Earth year
            </button>
            {tested && (
              <p role="status">
                Earth completes 1 orbit. Neptune completes about 1/165 of an
                orbit.
              </p>
            )}
          </>
        }
        explain={
          <>
            <p>
              Farther planets take longer to orbit the Sun. The moving map uses
              their relative orbital periods, even though the orbit gaps are
              compressed.
            </p>
            <p>
              <strong>Try this</strong>: predict how many Earth diameters fit
              across Jupiter. Choose Jupiter and switch to diameter comparison
              to test.
            </p>
          </>
        }
      />
      <p className="space-note">
        1 AU is Earth’s average distance from the Sun. The orbit map enlarges
        planets and compresses gaps; the separate close-up is not a size
        comparison. Diameter view uses one scale for both globes; rings are not
        included in diameter. Circular, coplanar paths and illustrative starting
        positions, not today’s sky. One timeline cycle is 10 Earth years.
        Surface details other than Earth are illustrations.
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
        . Planet data:{" "}
        <a
          href="https://science.nasa.gov/learn/basics-of-space-flight/chapter1-2/"
          target="_blank"
          rel="noreferrer"
        >
          NASA
        </a>
        .
      </p>
    </div>
  );
}
