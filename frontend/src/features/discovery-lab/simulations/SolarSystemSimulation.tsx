import { lazy, Suspense, useMemo, useState } from "react";
import {
  SOLAR_PLANETS,
  solarSystemActivity,
} from "@family-manager/family-api/discovery-models/solar";
import { Slider } from "./SimulationPrimitives";
import { usePlayback } from "./usePlayback";
import {
  SolarGuidedChallenges,
  type SolarDiameterPrediction,
  type SolarOrbitPrediction,
} from "./solar/SolarGuidedChallenges";
import type { SolarCameraMode, SolarSceneMode } from "./space/solarScene";
import "./space/space.css";
import "./solar/solar.css";

const SpaceCanvas = lazy(() =>
  import("./space/SpaceCanvas").then((module) => ({
    default: module.SpaceCanvas,
  })),
);

const TIMELINE_YEARS = 10;

export function SolarSystemSimulation() {
  const [selected, setSelected] = useState(2);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState<SolarSceneMode>("orbits");
  const [cameraMode, setCameraMode] = useState<SolarCameraMode>("close");
  const [orbitPrediction, setOrbitPrediction] =
    useState<SolarOrbitPrediction>("");
  const [orbitComplete, setOrbitComplete] = useState(false);
  const [diameterPrediction, setDiameterPrediction] =
    useState<SolarDiameterPrediction>("");
  const [diameterComplete, setDiameterComplete] = useState(false);
  const clock = usePlayback(60 / speed);
  const earthYears = clock.progress * TIMELINE_YEARS;
  const activity = useMemo(
    () => solarSystemActivity({ selected, earthYears }),
    [earthYears, selected],
  );
  const planet = activity.planet;

  const reset = () => {
    setSelected(2);
    setSpeed(1);
    setMode("orbits");
    setCameraMode("close");
    setOrbitPrediction("");
    setOrbitComplete(false);
    setDiameterPrediction("");
    setDiameterComplete(false);
    clock.reset();
  };

  const cameraDescription =
    cameraMode === "overview"
      ? "Overview fits all eight schematic orbit paths."
      : cameraMode === "follow"
        ? `Follow tracks ${planet.name} along its calculated circular teaching path.`
        : `Close pairs an enlarged ${planet.name} globe with a Sun-centered orbit inset.`;
  const sceneLabel = `${planet.name}, ${planet.kind}, planet ${selected + 1} from the Sun. Mean distance ${planet.meanDistanceAu} astronomical units; orbital period ${planet.orbitalPeriodYears} Earth years; equatorial diameter ${planet.diameterKm.toLocaleString()} kilometres. ${earthYears.toFixed(2)} Earth years have elapsed, equal to ${activity.orbitFraction.toFixed(3)} ${planet.name} orbits. ${mode === "sizes" ? `Earth and ${planet.name} use one linear diameter scale and share one baseline; orbit distances are not shown.` : `${cameraDescription} Orbit radii are compressed from mean distance, planet globes are enlarged, and positions are illustrative.`}`;

  return (
    <div className="solar-lab">
      <div className="solar-toolbar">
        <p>
          What changes when planets are compared for the same elapsed time or on
          the same diameter scale?
        </p>
        <button type="button" onClick={reset}>
          Reset lesson
        </button>
      </div>

      <section
        className="solar-mission"
        aria-label="Solar system comparison view"
      >
        {mode === "orbits" && (
          <div className="solar-camera-row">
            <span id="solar-camera-label">Camera view</span>
            <div
              className="solar-camera-switch"
              role="group"
              aria-labelledby="solar-camera-label"
            >
              {(["close", "overview", "follow"] as const).map((view) => (
                <button
                  type="button"
                  key={view}
                  aria-pressed={cameraMode === view}
                  onClick={() => setCameraMode(view)}
                >
                  {view[0].toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div
          className={`solar-stage solar-stage--${mode}`}
          data-camera={cameraMode}
        >
          <header className="solar-scene-heading">
            <h2>{planet.name}</h2>
            <p>
              {mode === "sizes" ? "Same-scale diameter" : planet.kind} · planet{" "}
              {selected + 1} of 8
            </p>
          </header>
          <div className="solar-scene-stat">
            <strong>
              {mode === "sizes"
                ? activity.diameterEarths.toFixed(2)
                : planet.meanDistanceAu.toFixed(
                    planet.meanDistanceAu < 1 ? 3 : 2,
                  )}
              <small>{mode === "sizes" ? "×" : " AU"}</small>
            </strong>
            <span>
              {mode === "sizes" ? "Earth diameters" : "mean distance"}
            </span>
          </div>
          <Suspense
            fallback={
              <div className="space-loading">Loading 3D solar system…</div>
            }
          >
            <SpaceCanvas
              kind="solar"
              state={{ selected, earthYears, mode, cameraMode }}
              progress={clock.progress}
              onProgress={(value) => {
                clock.pause();
                clock.setProgress(value);
              }}
              label={sceneLabel}
              fallbackLabel={`${planet.name}: ${planet.meanDistanceAu} AU mean distance, ${planet.orbitalPeriodYears} Earth-year orbit, ${planet.diameterKm.toLocaleString()} km equatorial diameter.`}
            />
          </Suspense>
        </div>

        <div className="solar-stage-caption">
          <p>
            {mode === "sizes"
              ? `Earth and ${planet.name} share one diameter scale and baseline; rings are excluded.`
              : "Planet enlarged; orbit distances compressed."}
          </p>
          {mode === "orbits" && cameraMode === "overview" && (
            <div className="solar-scene-key" aria-label="Scene key">
              <span>
                <i className="solar-key-selected" aria-hidden="true" />
                selected planet’s orbit
              </span>
              <span>
                <i className="solar-key-trail" aria-hidden="true" />
                elapsed portion
              </span>
            </div>
          )}
        </div>

        <div className="solar-flight-deck">
          <div className="solar-planet-picker" aria-label="Planet shortcuts">
            {SOLAR_PLANETS.map((option, index) => (
              <button
                type="button"
                key={option.name}
                aria-label={`${option.name} ${index + 1}`}
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                <i
                  style={{ backgroundColor: option.color }}
                  aria-hidden="true"
                />
                <span>{option.name}</span>
                <small>{index + 1}</small>
              </button>
            ))}
          </div>
          <dl className="solar-readout" aria-live="polite">
            <div>
              <dt>Mean distance</dt>
              <dd>{planet.meanDistanceAu} AU</dd>
            </div>
            <div>
              <dt>Orbital period</dt>
              <dd>{planet.orbitalPeriodYears} Earth years</dd>
            </div>
            <div>
              <dt>Equatorial diameter</dt>
              <dd>{planet.diameterKm.toLocaleString()} km</dd>
            </div>
            <div>
              <dt>Elapsed orbit fraction</dt>
              <dd>{activity.orbitFraction.toFixed(3)}</dd>
            </div>
          </dl>
          <div className="solar-playback">
            <Slider
              label="Model time"
              value={Math.round(clock.progress * 100)}
              min={0}
              max={100}
              unit="%"
              onChange={(value) => {
                clock.pause();
                clock.setProgress(value / 100);
              }}
            />
            <div className="solar-playback-actions">
              <button type="button" onClick={clock.toggle}>
                {clock.playing ? "Pause motion" : "Play motion"}
              </button>
              <button type="button" onClick={clock.reset}>
                Restart timeline
              </button>
            </div>
            <label className="solar-speed">
              <span>Playback speed</span>
              <select
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={5}>5×</option>
              </select>
            </label>
            <p>Timeline: {earthYears.toFixed(2)} of 10 Earth years.</p>
          </div>
        </div>
      </section>

      <SolarGuidedChallenges
        orbitPrediction={orbitPrediction}
        orbitComplete={orbitComplete}
        diameterPrediction={diameterPrediction}
        diameterComplete={diameterComplete}
        onOrbitPrediction={(prediction) => {
          setOrbitPrediction(prediction);
          setOrbitComplete(false);
          setDiameterPrediction("");
          setDiameterComplete(false);
          setMode("orbits");
          setCameraMode("overview");
          clock.reset();
        }}
        onOrbitCompare={() => {
          setOrbitComplete(true);
          setDiameterPrediction("");
          setDiameterComplete(false);
          setSelected(7);
          setMode("orbits");
          setCameraMode("overview");
          clock.pause();
          clock.setProgress(0.1);
        }}
        onDiameterPrediction={(prediction) => {
          setDiameterPrediction(prediction);
          setDiameterComplete(false);
        }}
        onDiameterCompare={() => {
          setDiameterComplete(true);
          setSelected(4);
          setMode("sizes");
          setCameraMode("close");
          clock.pause();
        }}
      />

      <details className="solar-open-controls">
        <summary>Compare other planets</summary>
        <p>
          Change one view or planet at a time; the guided evidence remains
          above.
        </p>
        <div>
          <label>
            <span>Choose a planet</span>
            <select
              aria-label="Choose a planet"
              value={selected}
              onChange={(event) => setSelected(Number(event.target.value))}
            >
              {SOLAR_PLANETS.map((option, index) => (
                <option value={index} key={option.name}>
                  {index + 1}. {option.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Comparison view</span>
            <select
              aria-label="Comparison view"
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as SolarSceneMode)
              }
            >
              <option value="orbits">Sun-centered orbits</option>
              <option value="sizes">Same-scale diameters</option>
            </select>
          </label>
        </div>
      </details>

      <aside className="solar-model-note">
        <h3>What the model measures—and what it redraws</h3>
        <p>
          One astronomical unit (AU) is about Earth’s mean Sun distance, roughly
          150 million km. The readouts use rounded mean distance, equatorial
          diameter and orbital period data for the eight planets. The orbit view
          compresses those unequal distances, enlarges planets, and uses
          circular coplanar paths with illustrative starting positions—not
          today’s sky. It advances each planet from its stored period; it does
          not calculate a live ephemeris.
        </p>
        <p>
          The diameter view uses one linear scale for Earth and the selected
          planet; Saturn’s rings are excluded from diameter. It omits the Sun
          and gaps because planet size and solar-system distance cannot both
          remain legible here at one scale. Close, Overview and Follow change
          only the camera. Non-Earth globe textures are illustrations, including
          the atmospheric banding shown for the gas and ice giants.
        </p>
      </aside>

      <footer className="solar-sources">
        <h3>Sources</h3>
        <ul>
          <li>
            <a
              href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/"
              target="_blank"
              rel="noreferrer"
            >
              NASA Planetary Fact Sheet
            </a>{" "}
            — diameters, mean distances and orbital periods.
          </li>
          <li>
            <a
              href="https://science.nasa.gov/universe/cosmic-distances/"
              target="_blank"
              rel="noreferrer"
            >
              NASA Cosmic Distances
            </a>{" "}
            — AU definition and distance comparisons.
          </li>
          <li>
            <a
              href="https://www.jpl.nasa.gov/edu/resources/project/make-a-scale-solar-system/"
              target="_blank"
              rel="noreferrer"
            >
              NASA/JPL Make a Scale Solar System
            </a>{" "}
            — why useful models separate size and distance scales.
          </li>
          <li>
            <a
              href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/"
              target="_blank"
              rel="noreferrer"
            >
              NASA Earth Observatory Blue Marble
            </a>{" "}
            — Earth surface texture.
          </li>
        </ul>
      </footer>
    </div>
  );
}
