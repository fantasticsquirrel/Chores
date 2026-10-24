/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from "../shared/vector-author";
import type { PondState } from "./model";
const traces = [
  { key: "algae", label: "Algae", color: "#6f8c35" },
  { key: "zooplankton", label: "Zooplankton", color: "#367d8c" },
  { key: "fish", label: "Fish", color: "#ae6137" },
  { key: "oxygen", label: "Oxygen", color: "#796b99" },
] as const;
export function PondTrend({
  trail,
  week,
}: {
  trail: PondState[];
  week: number;
}) {
  return (
    <div className="landscape-trend">
      <div className="landscape-trend-key">
        {traces.map((trace) => (
          <span key={trace.key}>
            <i style={{ background: trace.color }} />
            {trace.label}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 800 100" aria-hidden="true" preserveAspectRatio="none">
        {[0, 50, 100].map((value) => (
          <line
            key={value}
            x1="0"
            x2="800"
            y1={95 - value * 0.9}
            y2={95 - value * 0.9}
            stroke="#ccd6be"
            strokeDasharray="4 6"
          />
        ))}
        {traces.map((trace) => (
          <polyline
            key={trace.key}
            points={trail
              .map(
                (pond, index) =>
                  `${(index / Math.max(1, trail.length - 1)) * 800},${95 - pond[trace.key] * 0.9}`,
              )
              .join(" ")}
            fill="none"
            stroke={trace.color}
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <p className="landscape-trend-caption">
        Week {Math.max(0, week - trail.length + 1)} → {week} · Vertical range
        0–100 · Relative indices, not animal counts
      </p>
    </div>
  );
}
