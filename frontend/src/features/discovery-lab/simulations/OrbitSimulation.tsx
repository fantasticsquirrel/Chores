import { useMemo, useState } from "react";
import { orbitActivity } from "@family-manager/family-api/discovery-models/orbit";
import { Slider } from "./SimulationPrimitives";
import { OrbitGuidedChallenges } from "./orbit/OrbitGuidedChallenges";
import { OrbitPathDiagram } from "./orbit/OrbitPathDiagram";
import "./orbit/orbit.css";

const DEFAULT_INPUTS = { speed: 1, mass: 1 };

export function OrbitSimulation() {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [progress, setProgress] = useState(0);
  const [speedPrediction, setSpeedPrediction] = useState<string | null>(null);
  const [speedTested, setSpeedTested] = useState(false);
  const [massPrediction, setMassPrediction] = useState<string | null>(null);
  const [massTested, setMassTested] = useState(false);
  const result = useMemo(() => orbitActivity(inputs), [inputs]);

  const setCurrent = (speed: number, mass: number, trace = 0) => {
    setInputs({ speed, mass });
    setProgress(trace);
  };

  const reset = () => {
    setInputs(DEFAULT_INPUTS);
    setProgress(0);
    setSpeedPrediction(null);
    setSpeedTested(false);
    setMassPrediction(null);
    setMassTested(false);
  };

  return (
    <div className="orbit-lab">
      <div className="orbit-lab-toolbar">
        <p>
          Change one launch variable at a time, then compare the modeled paths.
        </p>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>

      <OrbitPathDiagram result={result} progress={progress} />

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
        <summary>Open controls</summary>
        <p>
          Changing a setting updates the current path; guided evidence stays
          fixed.
        </p>
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
          <Slider
            label="Trace position"
            value={Math.round(progress * 100)}
            min={0}
            max={100}
            unit="%"
            onChange={(value) => setProgress(value / 100)}
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
        <h3>What this model leaves out</h3>
        <p>
          Distances are center-to-center in starting radii; speed is relative to
          the 1× circular launch at mass 1×. Planet radius is 0.22 of the
          starting radius. This fixed-step, two-body model omits atmosphere,
          other worlds and the probe’s pull on the planet. The probe and arrows
          are enlarged; traces are model outputs, not flight predictions.
        </p>
      </aside>
    </div>
  );
}
