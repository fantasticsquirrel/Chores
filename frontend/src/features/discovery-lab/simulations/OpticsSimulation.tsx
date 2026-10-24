import { OpticsBench } from "./optics/OpticsBench";
import { useState } from "react";
import { refract } from "./physics";
import { LabLayout, Slider } from "./SimulationPrimitives";
export function OpticsSimulation() {
  const [angle, setAngle] = useState(40),
    [n1, setN1] = useState(1),
    [n2, setN2] = useState(1.5);
  const result = refract(angle, n1, n2);
  return (
    <LabLayout
      question="Send light from glass (1.5) into air (1.0). Increase the angle past 42°. What happens to the transmitted ray?"
      controls={
        <>
          <Slider
            label="Incident angle"
            value={angle}
            min={0}
            max={80}
            unit="°"
            onChange={setAngle}
          />
          <Slider
            label="Top refractive index"
            value={n1}
            min={1}
            max={2}
            step={0.01}
            onChange={setN1}
          />
          <Slider
            label="Bottom refractive index"
            value={n2}
            min={1}
            max={2}
            step={0.01}
            onChange={setN2}
          />
          <div className="dl-actions">
            <button
              type="button"
              onClick={() => {
                setN1(n2);
                setN2(n1);
              }}
            >
              Swap materials
            </button>
            <button
              type="button"
              onClick={() => {
                setAngle(40);
                setN1(1);
                setN2(1.5);
              }}
            >
              Reset
            </button>
          </div>
          <p className="dl-note">
            Air ≈ 1.00 · water ≈ 1.33 · glass ≈ 1.50. Angles are measured from
            the normal, not the surface. Ray brightness is illustrative, not an
            energy calculation.
          </p>
        </>
      }
      readout={
        <>
          <span>
            {Math.abs(n1 - n2) < 1e-9 ? (
              <strong>No reflection: equal refractive indices</strong>
            ) : (
              <>
                Reflection angle: <strong>{angle}°</strong>
              </>
            )}
          </span>
          <span>
            {result.tir ? (
              <strong>Total internal reflection</strong>
            ) : (
              <>
                Refraction angle: <strong>{result.angle?.toFixed(1)}°</strong>
              </>
            )}
          </span>
          <span>
            Snell's law: <strong>n₁ sin θ₁ = n₂ sin θ₂</strong>
          </span>
        </>
      }
    >
      <OpticsBench angle={angle} n1={n1} n2={n2} onAngle={setAngle} />
    </LabLayout>
  );
}
