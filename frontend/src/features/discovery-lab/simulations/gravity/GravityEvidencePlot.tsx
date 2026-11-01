import { useId } from "react";
import {
  gravityDropActivity,
  gravityDropAtTime,
  type GravityDropInputs,
} from "@family-manager/family-api/discovery-models/gravity";

type Trial = {
  label: string;
  inputs: GravityDropInputs;
};

function pathFor(trial: Trial, duration: number, heightScale: number) {
  return Array.from({ length: 33 }, (_, index) => {
    const elapsed = (duration * index) / 32;
    const result = gravityDropAtTime(trial.inputs, elapsed);
    const x = 44 + (elapsed / duration) * 296;
    const y = 18 + (result.distance / heightScale) * 116;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export function GravityEvidencePlot({
  trials,
  elapsed,
}: {
  trials: readonly [Trial, Trial];
  elapsed: number;
}) {
  const titleId = useId();
  const first = gravityDropActivity(trials[0].inputs);
  const second = gravityDropActivity(trials[1].inputs);
  const duration = Math.max(first.fallTime, second.fallTime);
  const heightScale = Math.max(first.inputs.height, second.inputs.height);
  const markerX = 44 + (Math.min(elapsed, duration) / duration) * 296;

  return (
    <div className="gravity-plot-panel">
      <svg
        className="gravity-plot"
        viewBox="0 0 360 158"
        role="img"
        aria-labelledby={titleId}
      >
        <title
          id={titleId}
        >{`Distance fallen over time. ${trials[0].label} lands in ${first.fallTime.toFixed(2)} seconds; ${trials[1].label} lands in ${second.fallTime.toFixed(2)} seconds.`}</title>
        <g className="gravity-plot-grid">
          <line x1="44" y1="18" x2="44" y2="134" />
          <line x1="44" y1="134" x2="340" y2="134" />
          <line x1="44" y1="76" x2="340" y2="76" />
        </g>
        <text x="8" y="24">
          0 m
        </text>
        <text x="2" y="139">
          {heightScale.toFixed(heightScale % 1 === 0 ? 0 : 1)} m
        </text>
        <text x="42" y="153">
          0 s
        </text>
        <text x="304" y="153">
          {duration.toFixed(2)} s
        </text>
        <path
          className="gravity-plot-line gravity-plot-line--a"
          d={pathFor(trials[0], duration, heightScale)}
        />
        <path
          className="gravity-plot-line gravity-plot-line--b"
          d={pathFor(trials[1], duration, heightScale)}
        />
        <line
          className="gravity-plot-marker"
          x1={markerX}
          y1="18"
          x2={markerX}
          y2="134"
        />
      </svg>
      <div className="gravity-plot-key" aria-hidden="true">
        <span>
          <i className="gravity-key-a" />
          {trials[0].label}
        </span>
        <span>
          <i className="gravity-key-b" />
          {trials[1].label}
        </span>
      </div>
    </div>
  );
}
