import { lazy, Suspense, useMemo, useState } from "react";
import {
  MOON_SIDEREAL_DAYS,
  MOON_SYNODIC_DAYS,
  moonPhaseActivity,
} from "@family-manager/family-api/discovery-models/moon";
import type { MoonSceneView } from "@family-manager/discovery-scenes/moon";
import { Slider } from "./SimulationPrimitives";
import { usePlayback } from "./usePlayback";
import {
  MoonGuidedChallenges,
  type MoonOppositePrediction,
  type MoonQuarterPrediction,
} from "./moon/MoonGuidedChallenges";
import "./moon/moon.css";

const MoonCanvas = lazy(() =>
  import("./moon/MoonCanvas").then((module) => ({
    default: module.MoonCanvas,
  })),
);

const INITIAL_ANGLE = 45;

export function MoonSimulation() {
  const clock = usePlayback(18, true, INITIAL_ANGLE / 360);
  const [view, setView] = useState<MoonSceneView>("earth");
  const [quarterPrediction, setQuarterPrediction] =
    useState<MoonQuarterPrediction>("");
  const [quarterComplete, setQuarterComplete] = useState(false);
  const [oppositePrediction, setOppositePrediction] =
    useState<MoonOppositePrediction>("");
  const [oppositeComplete, setOppositeComplete] = useState(false);
  const controlsLocked = !oppositeComplete;
  const angle = clock.progress * 360;
  const activity = useMemo(() => moonPhaseActivity({ angle }), [angle]);

  const setAngle = (value: number) => {
    clock.pause();
    clock.setProgress(value / 360);
  };
  const reset = () => {
    clock.pause();
    clock.setProgress(INITIAL_ANGLE / 360);
    setView("earth");
    setQuarterPrediction("");
    setQuarterComplete(false);
    setOppositePrediction("");
    setOppositeComplete(false);
  };
  const sceneLabel = `${activity.phase}. ${activity.visiblePercent}% of the disk visible from Earth is illuminated. ${view === "earth" ? "Earth view keeps the lunar near side facing the viewer while the direction of sunlight changes with orbital position." : `Orbit geometry view places the Moon at ${activity.inputs.angle.toFixed(0)} degrees around Earth while sunlight arrives from scene-right.`} Half of the whole Moon is sunlit in both views. Bodies, gaps and orbit are enlarged and not to scale.`;

  return (
    <div className="moon-observatory">
      <div className="moon-toolbar">
        <button type="button" onClick={reset}>
          Reset lesson
        </button>
      </div>

      <section className="moon-mission" aria-label="Moon phase model">
        <div className="moon-view-row">
          <span id="moon-view-label">Viewpoint</span>
          <div
            className="moon-view-switch"
            role="group"
            aria-labelledby="moon-view-label"
          >
            {(
              [
                ["earth", "Earth view"],
                ["orbit", "Orbit geometry"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={view === value}
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={`moon-stage moon-stage--${view}`} data-view={view}>
          <Suspense
            fallback={
              <div className="moon-render-fallback">Loading lunar surface…</div>
            }
          >
            <MoonCanvas
              angle={activity.inputs.angle}
              view={view}
              onChange={setAngle}
              label={sceneLabel}
            />
          </Suspense>
        </div>
        <div className="moon-stage-caption">
          <p>
            {view === "earth"
              ? "Seen from Earth: the near side stays fixed; the sunlit portion in view changes."
              : "Seen above the orbit: sunlight stays fixed from the right; the Moon moves around Earth."}
          </p>
          <p>Moon, Earth and orbit are enlarged; distances are not to scale.</p>
        </div>

        <div className="moon-flight-deck">
          <dl className="moon-readout" aria-live="polite">
            <div>
              <dt>Phase</dt>
              <dd>{activity.phase}</dd>
            </div>
            <div>
              <dt>Visible disk lit</dt>
              <dd>{activity.visiblePercent}%</dd>
            </div>
            <div>
              <dt>Orbital position</dt>
              <dd>{activity.inputs.angle.toFixed(0)}°</dd>
            </div>
            <div>
              <dt>Mean phase-cycle day</dt>
              <dd>{activity.cycleDay.toFixed(1)}</dd>
            </div>
          </dl>

          <div className="moon-timeline">
            <Slider
              label="Orbit position"
              value={Math.round(activity.inputs.angle)}
              min={0}
              max={360}
              unit="°"
              disabled={controlsLocked}
              onChange={setAngle}
            />
            <div className="moon-phase-presets" aria-label="Phase shortcuts">
              {(
                [
                  ["New", 0],
                  ["Quarter", 90],
                  ["Full", 180],
                  ["Last quarter", 270],
                ] as const
              ).map(([label, value]) => (
                <button
                  type="button"
                  key={label}
                  disabled={controlsLocked}
                  aria-pressed={
                    Math.abs(activity.inputs.angle - value) < 0.5 ||
                    (value === 0 && activity.inputs.angle > 359.5)
                  }
                  onClick={() => setAngle(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="moon-playback">
            <div className="dl-actions">
              <button
                type="button"
                disabled={controlsLocked}
                onClick={clock.toggle}
              >
                {clock.playing ? "Pause motion" : "Play motion"}
              </button>
              <button
                type="button"
                disabled={controlsLocked}
                onClick={() => setAngle(0)}
              >
                Restart cycle
              </button>
            </div>
            <p>
              {controlsLocked
                ? "Complete both predictions to unlock open exploration."
                : `Motion advances one schematic ${MOON_SYNODIC_DAYS.toFixed(2)}-day phase cycle and starts only when you press Play.`}
            </p>
          </div>
        </div>
      </section>

      <MoonGuidedChallenges
        quarterPrediction={quarterPrediction}
        quarterComplete={quarterComplete}
        oppositePrediction={oppositePrediction}
        oppositeComplete={oppositeComplete}
        onQuarterPrediction={(prediction) => {
          setQuarterPrediction(prediction);
          setQuarterComplete(false);
          setOppositePrediction("");
          setOppositeComplete(false);
        }}
        onQuarterObserve={() => {
          setQuarterComplete(true);
          setOppositePrediction("");
          setOppositeComplete(false);
          setView("earth");
          setAngle(90);
        }}
        onOppositePrediction={(prediction) => {
          setOppositePrediction(prediction);
          setOppositeComplete(false);
        }}
        onOppositeCompare={() => {
          setOppositeComplete(true);
          setView("earth");
          setAngle(270);
        }}
      />

      <aside className="moon-model-note">
        <h3>What this model changes—and what it leaves out</h3>
        <p>
          The Sun illuminates half the Moon. This circular, coplanar model
          changes only the Moon’s orbital position and shows the corresponding
          Earth-view fraction. It does not cast Earth’s shadow: ordinary phases
          are not lunar eclipses. The real orbit is tilted about 5°, so most new
          and full Moons pass above or below eclipse alignment.
        </p>
        <p>
          The mean new-Moon-to-new-Moon cycle is {MOON_SYNODIC_DAYS.toFixed(2)}{" "}
          days; the sidereal orbit relative to the stars is{" "}
          {MOON_SIDEREAL_DAYS.toFixed(2)} days. Earth’s motion around the Sun
          makes those periods different. Sizes, orbit radius and Sun distance
          are redrawn for legibility. Local sky orientation, libration, terrain
          shadows and exact timing are not predicted here.
        </p>
      </aside>

      <footer className="moon-sources">
        <h3>Sources</h3>
        <ul>
          <li>
            <a
              href="https://science.nasa.gov/moon/moon-phases/"
              target="_blank"
              rel="noreferrer"
            >
              NASA Moon Phases
            </a>{" "}
            — illumination, phase order and Earth-view geometry.
          </li>
          <li>
            <a
              href="https://eclipse.gsfc.nasa.gov/SEhelp/moonorbit.html"
              target="_blank"
              rel="noreferrer"
            >
              NASA GSFC: Eclipses and the Moon’s Orbit
            </a>{" "}
            — synodic and sidereal periods and orbital inclination.
          </li>
          <li>
            <a
              href="https://svs.gsfc.nasa.gov/4720/"
              target="_blank"
              rel="noreferrer"
            >
              NASA SVS CGI Moon Kit
            </a>{" "}
            — LRO LROC color and LOLA elevation maps.
          </li>
        </ul>
      </footer>
    </div>
  );
}
