import { useMemo, useState } from "react";
import {
  OPTICAL_MATERIALS,
  opticsActivity,
  type OpticalMaterialId,
  type OpticsInputs,
} from "@family-manager/family-api/discovery-models/optics";
import { Slider } from "./SimulationPrimitives";
import { OpticsGuidedChallenges } from "./optics/OpticsGuidedChallenges";
import { OpticsInstrument } from "./optics/OpticsInstrument";
import "./optics/optics.css";

const DEFAULT_INPUTS: OpticsInputs = {
  angle: 40,
  from: "glass",
  to: "air",
};

function outcomeText(result: ReturnType<typeof opticsActivity>) {
  if (result.tir) return "Total internal reflection";
  if (result.from.id === result.to.id)
    return "Straight through · no reflected branch";
  if (result.direction === "straight") return "Straight along the normal";
  return result.direction === "toward"
    ? "Bends toward the normal"
    : "Bends away from the normal";
}

export function OpticsSimulation() {
  const [inputs, setInputs] = useState<OpticsInputs>(DEFAULT_INPUTS);
  const [criticalPrediction, setCriticalPrediction] = useState<string | null>(
    null,
  );
  const [criticalTested, setCriticalTested] = useState(false);
  const [directionPrediction, setDirectionPrediction] = useState<string | null>(
    null,
  );
  const [directionTested, setDirectionTested] = useState(false);
  const result = useMemo(() => opticsActivity(inputs), [inputs]);

  const reset = () => {
    setInputs(DEFAULT_INPUTS);
    setCriticalPrediction(null);
    setCriticalTested(false);
    setDirectionPrediction(null);
    setDirectionTested(false);
  };

  return (
    <div className="optics-lab">
      <div className="optics-toolbar">
        <p>Predict first. Compare rays using angles from the normal.</p>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>

      <OpticsInstrument result={result} />

      <div
        className="optics-current"
        data-testid="optics-current-outcome"
        role="status"
        aria-live="polite"
      >
        <span>
          <small>Incident</small>
          <strong>{result.inputs.angle.toFixed(1)}°</strong>
        </span>
        <span>
          <small>Reflected</small>
          <strong>
            {result.reflectedAngle === null
              ? "none"
              : `${result.reflectedAngle.toFixed(1)}°`}
          </strong>
        </span>
        <span className={result.tir ? "is-tir" : undefined}>
          <small>{result.tir ? "Result" : "Refracted"}</small>
          <strong>
            {result.tir
              ? "Total internal reflection"
              : `${result.refractedAngle?.toFixed(1)}°`}
          </strong>
        </span>
        <span>
          <small>Direction</small>
          <strong>{outcomeText(result)}</strong>
        </span>
      </div>

      <OpticsGuidedChallenges
        criticalPrediction={criticalPrediction}
        setCriticalPrediction={(prediction) => {
          setCriticalPrediction(prediction);
          setCriticalTested(false);
          setDirectionPrediction(null);
          setDirectionTested(false);
        }}
        criticalTested={criticalTested}
        runCriticalTest={() => {
          setCriticalTested(true);
          setDirectionPrediction(null);
          setDirectionTested(false);
          setInputs({ angle: 43, from: "glass", to: "air" });
        }}
        directionPrediction={directionPrediction}
        setDirectionPrediction={(prediction) => {
          setDirectionPrediction(prediction);
          setDirectionTested(false);
        }}
        directionTested={directionTested}
        runDirectionTest={() => {
          setDirectionTested(true);
          setInputs({ angle: 30, from: "glass", to: "air" });
        }}
        showTrial={setInputs}
      />

      <details className="optics-open-controls">
        <summary>Open controls</summary>
        <p>Change the current ray. Guided evidence stays fixed.</p>
        <div className="optics-control-grid">
          <label>
            <span>From material</span>
            <select
              value={inputs.from}
              onChange={(event) =>
                setInputs((current) => ({
                  ...current,
                  from: event.target.value as OpticalMaterialId,
                }))
              }
            >
              {Object.values(OPTICAL_MATERIALS).map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} · n = {material.refractiveIndex.toFixed(3)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>To material</span>
            <select
              value={inputs.to}
              onChange={(event) =>
                setInputs((current) => ({
                  ...current,
                  to: event.target.value as OpticalMaterialId,
                }))
              }
            >
              {Object.values(OPTICAL_MATERIALS).map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} · n = {material.refractiveIndex.toFixed(3)}
                </option>
              ))}
            </select>
          </label>
          <Slider
            label="Incident angle"
            value={inputs.angle}
            min={0}
            max={80}
            step={1}
            unit="°"
            onChange={(angle) =>
              setInputs((current) => ({ ...current, angle }))
            }
          />
        </div>
        <button
          className="optics-swap"
          type="button"
          onClick={() =>
            setInputs((current) => ({
              ...current,
              from: current.to,
              to: current.from,
            }))
          }
        >
          Swap direction
        </button>
      </details>

      <aside className="optics-model-note">
        <h3>Why the ray changes</h3>
        <p>
          Refractive index compares light’s speed in vacuum with its speed in a
          material; a higher index means slower light. Snell’s law makes a ray
          bend toward the normal when it enters a higher index and away when it
          enters a lower one. A large angle alone is not enough for total
          internal reflection: the ray must travel from higher to lower index
          and exceed that pair’s critical angle.
        </p>
        <p>
          <strong>Model boundary:</strong> This single-color geometric-ray model
          omits absorption, scattering, polarization and color separation. Ray
          brightness is fixed for visibility, not a calculated energy split.
        </p>
      </aside>
    </div>
  );
}
