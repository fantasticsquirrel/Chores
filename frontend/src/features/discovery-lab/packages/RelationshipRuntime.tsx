import { useState } from "react";
import type { DiscoveryPackagePayload } from "@family-manager/family-api/models";
import { DiagramViewport } from "./PackageDrawing";
export function RelationshipRuntime({
  payload,
}: {
  payload: DiscoveryPackagePayload;
}) {
  const model = payload.manifest.scene;
  const control = model?.controls[0];
  const [value, setValue] = useState(control?.initial ?? 1);
  if (!model || !control)
    return <p role="alert">This relationship model is incomplete.</p>;
  const calculate = (x: number) =>
    (model.coefficient ?? 1) * (model.kind === "inverse" ? 1 / x : x) +
    (model.kind === "linear" ? (model.intercept ?? 0) : 0);
  const points = Array.from({ length: 81 }, (_, i) => {
    const x = control.min + ((control.max - control.min) * i) / 80;
    return { x, y: calculate(x) };
  });
  const low = Math.min(0, ...points.map((p) => p.y));
  const high = Math.max(1, ...points.map((p) => p.y));
  const px = (x: number) =>
    80 + (640 * (x - control.min)) / (control.max - control.min);
  const py = (y: number) => 390 - (320 * (y - low)) / (high - low);
  const result = calculate(value);
  const description = `${control.label}: ${value} ${control.unit}. ${model.output.label}: ${result.toFixed(3)} ${model.output.unit}. The line shows the relationship across the allowed input range.`;
  return (
    <div className="discovery-package-runtime">
      <DiagramViewport>
        <svg
          viewBox="0 0 800 480"
          role="img"
          aria-label={description}
          className="discovery-package-canvas"
        >
          <line x1="80" y1="390" x2="740" y2="390" stroke="currentColor" />
          <line x1="80" y1="60" x2="80" y2="390" stroke="currentColor" />
          <polyline
            fill="none"
            stroke="#7860ca"
            strokeWidth="4"
            points={points.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}
          />
          <line
            x1={px(value)}
            y1="390"
            x2={px(value)}
            y2={py(result)}
            stroke="#be5674"
            strokeDasharray="5 5"
          />
          <circle cx={px(value)} cy={py(result)} r="9" fill="#be5674" />
          <text x="90" y="35">
            {model.output.label} ({model.output.unit})
          </text>
          <text x="300" y="450">
            {control.label} ({control.unit})
          </text>
          <text x="20" y="75">
            {high.toFixed(1)}
          </text>
          <text x="20" y="390">
            {low.toFixed(1)}
          </text>
          <text x="80" y="420">
            {control.min}
          </text>
          <text x="710" y="420">
            {control.max}
          </text>
        </svg>
      </DiagramViewport>
      <p>{description}</p>
      <label>
        {control.label}: {value} {control.unit}
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
      </label>
      <button onClick={() => setValue(control.initial)}>
        Reset experiment
      </button>
    </div>
  );
}
