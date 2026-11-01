import { lazy, Suspense, useMemo, useState } from "react";
import {
  orbitActivity,
  orbitGravity,
  type OrbitOutcome,
} from "@family-manager/family-api/discovery-models/orbit";
import { Slider } from "./SimulationPrimitives";
import { usePlayback } from "./usePlayback";
import { OrbitGuidedChallenges } from "./orbit/OrbitGuidedChallenges";
import type { OrbitCameraMode } from "./space/orbitScene";
import "./orbit/orbit.css";
import "./space/space.css";

const SpaceCanvas = lazy(() =>
  import("./space/SpaceCanvas").then((module) => ({
    default: module.SpaceCanvas,
  })),
);

const DEFAULT_INPUTS = { speed: 1, mass: 1 };

const OUTCOME_COPY: Record<
  OrbitOutcome,
  { title: string; description: string }
> = {
  collision: {
    title: "Planet collision",
    description: "The slower launch falls inward before it can circle around.",
  },
  orbit: {
    title: "Bound orbit",
    description: "Gravity keeps curving the probe inward.",
  },
  escape: {
    title: "Escape path",
    description: "The probe moves outward while gravity still bends its path.",
  },
};

export function OrbitSimulation() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const flight = usePlayback(14, false);
  const [speedPrediction, setSpeedPrediction] = useState<string | null>(null);
  const [speedTested, setSpeedTested] = useState(false);
  const [massPrediction, setMassPrediction] = useState<string | null>(null);
  const [massTested, setMassTested] = useState(false);
  const [cameraMode, setCameraMode] = useState<OrbitCameraMode>("close");
  const result = useMemo(() => orbitActivity(inputs), [inputs]);
  const pointIndex = Math.min(
    result.points.length - 1,
    Math.floor(flight.progress * result.points.length),
  );
  const point = result.points[pointIndex];
  const radius = Math.hypot(point.x, point.y);
  const gravity = orbitGravity(inputs.mass, radius);
  const outcome = OUTCOME_COPY[result.outcome];

  const setCurrent = (speed: number, mass: number, trace = 0) => {
    flight.pause();
    setInputs({ speed, mass });
    flight.setProgress(trace);
  };

  const reset = () => {
    setInputs(DEFAULT_INPUTS);
    flight.reset();
    setSpeedPrediction(null);
    setSpeedTested(false);
    setMassPrediction(null);
    setMassTested(false);
    setCameraMode("close");
  };

  const cameraDescription =
    cameraMode === "follow"
      ? "The camera follows the calculated probe position without changing the trajectory or scale."
      : cameraMode === "overview"
        ? "The camera fits the whole calculated trajectory."
        : "The close camera turns with the flight to keep the planet and nearby probe legible without changing their scale.";
  const sceneLabel = `${outcome.title}. ${outcome.description} Launch speed ${inputs.speed.toFixed(2)} times baseline, central mass ${inputs.mass.toFixed(1)} times baseline, current center distance ${radius.toFixed(2)} starting radii, and gravity ${gravity.toFixed(2)} times its starting reference. ${cameraDescription} The textured planet and enlarged probe are shown in a dimensional view. The pale line is the shared model trajectory; amber points toward the planet and blue points along the motion.`;

  return (
    <div className="orbit-lab">
      <section className="orbit-scene-stage" aria-label="Current orbit scene">
        <header className="orbit-scene-heading">
          <span className={`orbit-outcome orbit-outcome--${result.outcome}`}>
            {outcome.title}
          </span>
          <p>{outcome.description}</p>
        </header>
        <div className="orbit-scene-toolbar">
          <div
            className="orbit-view-switch"
            role="group"
            aria-label="Camera view"
          >
            <button
              type="button"
              aria-pressed={cameraMode === "close"}
              onClick={() => setCameraMode("close")}
            >
              Close
            </button>
            <button
              type="button"
              aria-pressed={cameraMode === "overview"}
              onClick={() => setCameraMode("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              aria-pressed={cameraMode === "follow"}
              onClick={() => setCameraMode("follow")}
            >
              Follow
            </button>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="orbit-scene-loading">Loading 3D orbit…</div>
          }
        >
          <SpaceCanvas
            kind="orbit"
            state={{
              points: result.points,
              progress: flight.progress,
              cameraMode,
            }}
            progress={flight.progress}
            fallbackLabel={`${outcome.title}. ${outcome.description}`}
            onProgress={(value) => {
              flight.pause();
              flight.setProgress(value);
            }}
            label={sceneLabel}
          />
        </Suspense>
        <div className="orbit-scene-legend" aria-label="Scene key">
          <span>
            <i className="orbit-key-path" aria-hidden="true" /> path
          </span>
          <span>
            <i className="orbit-key-gravity" aria-hidden="true" /> gravity
          </span>
          <span>
            <i className="orbit-key-motion" aria-hidden="true" /> motion
          </span>
        </div>
        <p className="orbit-scene-help">
          Drag the scene or use its arrow keys to move along the path.
        </p>
      </section>

      <div className="orbit-flight-deck">
        <div className="orbit-playback" aria-label="Flight controls">
          <button type="button" onClick={flight.toggle}>
            {flight.playing ? "Pause motion" : "Play motion"}
          </button>
          <button type="button" onClick={flight.reset}>
            Restart flight
          </button>
          <button type="button" onClick={reset}>
            Reset lesson
          </button>
        </div>
        <Slider
          label="Flight position"
          value={Math.round(flight.progress * 100)}
          min={0}
          max={100}
          unit="%"
          onChange={(value) => {
            flight.pause();
            flight.setProgress(value / 100);
          }}
        />
        <p className="orbit-flight-readout" aria-live="polite">
          <span>
            Speed <strong>{inputs.speed.toFixed(2)}×</strong>
          </span>
          <span>
            Mass <strong>{inputs.mass.toFixed(1)}×</strong>
          </span>
          <span>
            Center distance <strong>{radius.toFixed(2)} radii</strong>
          </span>
          <span>
            Gravity <strong>{gravity.toFixed(2)}× start</strong>
          </span>
        </p>
      </div>

      <OrbitGuidedChallenges
        speedPrediction={speedPrediction}
        setSpeedPrediction={(prediction) => {
          setSpeedPrediction(prediction);
          setSpeedTested(false);
          setMassPrediction(null);
          setMassTested(false);
        }}
        speedTested={speedTested}
        runSpeedTest={() => {
          setSpeedTested(true);
          setMassPrediction(null);
          setMassTested(false);
          setCurrent(0.6, 1, 0.9999);
        }}
        massPrediction={massPrediction}
        setMassPrediction={(prediction) => {
          setMassPrediction(prediction);
          setMassTested(false);
        }}
        massTested={massTested}
        runMassTest={() => {
          setMassTested(true);
          setCurrent(1, 2, 0.9999);
        }}
      />

      <details className="orbit-open-controls">
        <summary>Try other launches</summary>
        <div className="orbit-control-grid">
          <Slider
            label="Launch speed"
            value={inputs.speed}
            min={0}
            max={1.8}
            step={0.02}
            unit="×"
            onChange={(speed) => setCurrent(speed, inputs.mass)}
          />
          <Slider
            label="Central mass"
            value={inputs.mass}
            min={0.5}
            max={2}
            step={0.1}
            unit="×"
            onChange={(mass) => setCurrent(inputs.speed, mass)}
          />
        </div>
        <div className="orbit-presets" aria-label="Path presets">
          {[
            [0.6, "Collision"],
            [1, "Circular orbit"],
            [1.42, "Escape"],
          ].map(([speed, label]) => (
            <button
              type="button"
              key={label}
              aria-pressed={inputs.speed === speed && inputs.mass === 1}
              onClick={() => setCurrent(Number(speed), 1)}
            >
              {label} · {Number(speed).toFixed(2)}×
            </button>
          ))}
        </div>
      </details>

      <aside className="orbit-model-note">
        <h3>Model limits</h3>
        <p>
          Distances use the starting center distance as one radius. The
          fixed-step two-body model omits atmosphere, other worlds and the
          probe’s pull on the planet. Planet radius is 0.22 of the starting
          radius; the probe and arrows are enlarged. Close turns the camera to
          frame the planet and nearby probe. Overview fits the whole trajectory;
          Follow keeps the calculated probe position in frame. Camera changes do
          not alter the path or scale. The comparison diagrams show whole
          trajectories at one scale.
        </p>
      </aside>
    </div>
  );
}
