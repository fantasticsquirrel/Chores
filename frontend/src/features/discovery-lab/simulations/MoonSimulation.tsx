import { lazy, Suspense, useState } from "react";
import { EarthGlobe } from "./CelestialArt";
import { illuminatedFraction } from "./physics";
import { Playback, Slider } from "./SimulationPrimitives";
import { usePlayback } from "./usePlayback";
const MoonCanvas = lazy(() =>
  import("./moon/MoonCanvas").then((module) => ({
    default: module.MoonCanvas,
  })),
);
import "./moon/moon.css";
function phaseName(angle: number) {
  if (angle < 10 || angle > 350) return "New Moon";
  if (angle < 80) return "Waxing crescent";
  if (angle < 100) return "First quarter";
  if (angle < 170) return "Waxing gibbous";
  if (angle < 190) return "Full Moon";
  if (angle < 260) return "Waning gibbous";
  if (angle < 280) return "Last quarter";
  return "Waning crescent";
}
export function MoonSimulation() {
  const clock = usePlayback(29.5, true, 0.25);
  const angle = clock.progress * 360,
    fraction = illuminatedFraction(angle),
    radians = (angle * Math.PI) / 180;
  const [prediction, setPrediction] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const setAngle = (value: number) => clock.setProgress(value / 360);
  return (
    <div className="moon-observatory">
      <div className="moon-immersive">
        <div className="moon-stars" aria-hidden="true">
          {Array.from({ length: 65 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 73 + 11) % 100}%`,
                top: `${(i * 41 + 7) % 100}%`,
                opacity: 0.18 + (i % 5) * 0.13,
                width: i % 7 ? 1 : 2,
                height: i % 7 ? 1 : 2,
              }}
            />
          ))}
        </div>
        <div className="moon-exhibit-label">
          <h2>{phaseName(angle)}</h2>
        </div>
        <Suspense
          fallback={
            <div className="moon-render-fallback">Loading lunar surface…</div>
          }
        >
          <MoonCanvas
            angle={angle}
            onChange={setAngle}
            label={`${phaseName(angle)}: ${Math.round(fraction * 100)} percent of the visible lunar disk illuminated. Drag horizontally or use Orbit position below.`}
          />
        </Suspense>
        <div className="moon-phase-stat" aria-live="off">
          <strong>
            {Math.round(fraction * 100)}
            <small>%</small>
          </strong>
          <span>of the visible disk is sunlit</span>
        </div>
        <div className="moon-drag-hint" aria-hidden="true">
          ← Drag the Moon to move through its orbit →
        </div>
        <div className="moon-orbit-inset">
          <svg viewBox="0 0 250 200" aria-hidden="true">
            <circle
              cx="105"
              cy="96"
              r="65"
              fill="none"
              stroke="#667c93"
              strokeDasharray="2 5"
            />
            <EarthGlobe x={105} y={96} r={18} sunlightFromRight />
            <path
              d={`M105 96L${105 + 65 * Math.cos(radians)} ${96 - 65 * Math.sin(radians)}`}
              stroke="#a6cbd1"
              opacity=".45"
            />
            <circle
              cx={105 + 65 * Math.cos(radians)}
              cy={96 - 65 * Math.sin(radians)}
              r="7"
              fill="#d2d1c8"
            />
            {[65, 96, 127].map((y) => (
              <path
                key={y}
                d={`M231 ${y}h-35m6-4-6 4 6 4`}
                fill="none"
                stroke="#eecb8f"
                strokeWidth="1.5"
              />
            ))}
            <text x="198" y="153" fill="#eecb8f" fontSize="10">
              Sunlight
            </text>
            <text
              x="105"
              y="184"
              textAnchor="middle"
              fill="#9eb6c5"
              fontSize="10"
            >
              Orbit view · not to scale
            </text>
          </svg>
        </div>
      </div>
      <div className="moon-console">
        <div className="moon-timeline">
          <Slider
            label="Orbit position"
            value={Math.round(angle)}
            min={0}
            max={359}
            unit="°"
            onChange={setAngle}
          />
          <div className="dl-actions dl-phase-presets">
            {[
              ["New", 0],
              ["Quarter", 90],
              ["Full", 180],
              ["Last quarter", 270],
            ].map(([label, value]) => (
              <button
                type="button"
                key={label}
                aria-pressed={Math.abs(angle - Number(value)) < 0.5}
                onClick={() => setAngle(Number(value))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="moon-playback">
          <Playback {...clock} />
          <span>Cycle day {(clock.progress * 29.5).toFixed(1)} of 29.5</span>
        </div>
      </div>
      <div className="moon-investigation">
        <div>
          <span className="moon-step-label">01 / PREDICT</span>
          <h3>At a quarter orbit, how much of the disk looks lit?</h3>
          <div className="moon-predictions">
            {[25, 50, 75].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={prediction === value}
                onClick={() => {
                  setPrediction(value);
                  setRevealed(false);
                }}
              >
                {value}%
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="moon-step-label">02 / OBSERVE</span>
          <h3>Move to 90° and check the boundary between light and dark.</h3>
          <button
            type="button"
            className="moon-investigate-button"
            onClick={() => {
              setAngle(90);
              setRevealed(true);
            }}
          >
            Test at first quarter ↗
          </button>
        </div>
        <div>
          <span className="moon-step-label">03 / EXPLAIN</span>
          <p>
            {revealed
              ? `${prediction === 50 ? "Your prediction matches: " : "At 90°, "}50% of the disk is lit. The Sun still illuminates half the whole Moon; from Earth, we see half of that sunlit side.`
              : "The Sun always lights half the Moon. The fraction we can see depends on the Moon’s position around Earth."}
          </p>
          <p className="moon-essential">
            Phases are not caused by Earth’s shadow. That happens during a lunar
            eclipse.
          </p>
        </div>
      </div>
      <div className="dl-readout moon-accessible-readout">
        <span>
          Phase: <strong>{phaseName(angle)}</strong>
        </span>
        <span>
          Visible disk lit: <strong>{Math.round(fraction * 100)}%</strong>
        </span>
        <span>
          Try this: compare 90° and 270°. Both show half a lit disk, on opposite
          sides.
        </span>
      </div>
      <p className="moon-model-note">
        Fixed Earth-view orientation; the Moon’s apparent rotation depends on
        your location. Faint reflected light reveals the dark outline. Eclipses
        and orbital inclination are not modeled.
      </p>
    </div>
  );
}
