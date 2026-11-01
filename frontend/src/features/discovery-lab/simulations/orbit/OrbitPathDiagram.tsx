import { useId } from "react";
import type {
  OrbitInputs,
  OrbitOutcome,
  OrbitPoint,
} from "@family-manager/family-api/discovery-models/orbit";
import { orbitActivity } from "@family-manager/family-api/discovery-models/orbit";

type OrbitResult = ReturnType<typeof orbitActivity>;

const OUTCOME_LABEL: Record<OrbitOutcome, string> = {
  collision: "collision",
  orbit: "bound orbit",
  escape: "escape",
};

const OUTCOME_MARK: Record<OrbitOutcome, string> = {
  collision: "×",
  orbit: "↻",
  escape: "↗",
};

function pathData(points: readonly OrbitPoint[]) {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(3)} ${(-point.y).toFixed(3)}`,
    )
    .join(" ");
}

function mainView(points: readonly OrbitPoint[]) {
  const xs = [0, ...points.map((point) => point.x)];
  const ys = [0, ...points.map((point) => -point.y)];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(2.45, maxX - minX, maxY - minY);
  const margin = span * 0.13;
  return `${((minX + maxX - span) / 2 - margin).toFixed(3)} ${((minY + maxY - span) / 2 - margin).toFixed(3)} ${(span + margin * 2).toFixed(3)} ${(span + margin * 2).toFixed(3)}`;
}

function vectorEnd(
  from: OrbitPoint,
  toward: OrbitPoint,
  length: number,
): OrbitPoint {
  const dx = toward.x - from.x;
  const dy = toward.y - from.y;
  const magnitude = Math.hypot(dx, dy) || 1;
  return {
    x: from.x + (dx / magnitude) * length,
    y: from.y + (dy / magnitude) * length,
  };
}

function outcomeDescription(result: OrbitResult) {
  if (result.outcome === "collision")
    return `The trace reaches the drawn surface at ${result.closestRadius.toFixed(2)} starting radii.`;
  if (result.outcome === "escape")
    return `The trace leaves the frame after reaching ${result.farthestRadius.toFixed(2)} starting radii; gravity still points inward.`;
  return `The trace remains bound from ${result.closestRadius.toFixed(2)} to ${result.farthestRadius.toFixed(2)} starting radii.`;
}

export function OrbitPathDiagram({
  result,
  progress,
}: {
  result: OrbitResult;
  progress: number;
}) {
  const titleId = useId();
  const markerId = useId().replace(/:/g, "");
  const index = Math.min(
    result.points.length - 1,
    Math.floor(progress * result.points.length),
  );
  const point = result.points[index];
  const next = result.points[Math.min(index + 1, result.points.length - 1)];
  const gravityEnd = vectorEnd(point, { x: 0, y: 0 }, 0.25);
  const motionEnd = vectorEnd(point, next, 0.25);
  const traveled = result.points.slice(0, Math.max(1, index + 1));
  const radius = Math.hypot(point.x, point.y);
  const gravity =
    result.inputs.mass / Math.max(result.planetRadius, radius) ** 2;

  return (
    <section className="orbit-instrument" aria-label="Current modeled path">
      <div className="orbit-instrument-heading">
        <div>
          <span className={`orbit-outcome orbit-outcome--${result.outcome}`}>
            <b aria-hidden="true">{OUTCOME_MARK[result.outcome]}</b>
            {OUTCOME_LABEL[result.outcome]}
          </span>
          <p>{outcomeDescription(result)}</p>
        </div>
        <dl>
          <div>
            <dt>Speed</dt>
            <dd>{result.inputs.speed.toFixed(2)}×</dd>
          </div>
          <div>
            <dt>Mass</dt>
            <dd>{result.inputs.mass.toFixed(1)}×</dd>
          </div>
        </dl>
      </div>
      <div className="orbit-plot-shell">
        <svg
          className="orbit-main-plot"
          viewBox={mainView(result.points)}
          role="img"
          aria-labelledby={titleId}
          preserveAspectRatio="xMidYMid meet"
        >
          <title id={titleId}>
            {`Modeled ${OUTCOME_LABEL[result.outcome]} at ${result.inputs.speed.toFixed(2)} times baseline launch speed and ${result.inputs.mass.toFixed(1)} times central mass. Current center distance ${radius.toFixed(2)} starting radii. Gravity points inward and motion follows the path.`}
          </title>
          <defs>
            <radialGradient id={`${markerId}-planet`} cx="35%" cy="30%">
              <stop offset="0" stopColor="#79b7ad" />
              <stop offset="0.55" stopColor="#2f716c" />
              <stop offset="1" stopColor="#102c38" />
            </radialGradient>
            <marker
              id={`${markerId}-gravity`}
              markerWidth="5"
              markerHeight="5"
              refX="4"
              refY="2.5"
              orient="auto"
            >
              <path d="M0,0 L5,2.5 L0,5 Z" fill="#f2b45f" />
            </marker>
            <marker
              id={`${markerId}-motion`}
              markerWidth="5"
              markerHeight="5"
              refX="4"
              refY="2.5"
              orient="auto"
            >
              <path d="M0,0 L5,2.5 L0,5 Z" fill="#78d6e8" />
            </marker>
          </defs>
          <circle className="orbit-start-ring" r="1" />
          <line className="orbit-axis" x1="0" y1="0" x2="1" y2="0" />
          <path
            className="orbit-path orbit-path--future"
            d={pathData(result.points)}
          />
          <path
            className="orbit-path orbit-path--traveled"
            d={pathData(traveled)}
          />
          <g className="orbit-planet">
            <circle r={result.planetRadius} fill={`url(#${markerId}-planet)`} />
            <path d="M-.16-.04q.07-.12.17-.09t.1.12q-.03.06-.12.07t-.08.1q-.12-.02-.17-.2Z" />
            <circle className="orbit-surface-line" r={result.planetRadius} />
          </g>
          <line
            className="orbit-vector orbit-vector--gravity"
            x1={point.x}
            y1={-point.y}
            x2={gravityEnd.x}
            y2={-gravityEnd.y}
            markerEnd={`url(#${markerId}-gravity)`}
          />
          <line
            className="orbit-vector orbit-vector--motion"
            x1={point.x}
            y1={-point.y}
            x2={motionEnd.x}
            y2={-motionEnd.y}
            markerEnd={`url(#${markerId}-motion)`}
          />
          <g
            className="orbit-probe"
            transform={`translate(${point.x} ${-point.y})`}
          >
            <rect x="-.055" y="-.035" width=".11" height=".07" rx=".012" />
            <path d="M-.14-.055h.075v.11H-.14zm.205 0h.075v.11H.065z" />
          </g>
        </svg>
        <div className="orbit-vector-key" aria-hidden="true">
          <span>
            <i className="orbit-key-gravity" />
            gravity inward
          </span>
          <span>
            <i className="orbit-key-motion" />
            motion direction
          </span>
          <span>
            <i className="orbit-key-trace" />
            modeled trace
          </span>
        </div>
      </div>
      <dl className="orbit-live-readout" aria-label="Current path values">
        <div>
          <dt>Center distance</dt>
          <dd>{radius.toFixed(2)} starting radii</dd>
        </div>
        <div>
          <dt>Gravity here</dt>
          <dd>{gravity.toFixed(2)}× starting reference</dd>
        </div>
        <div>
          <dt>Circular speed here</dt>
          <dd>{result.circularSpeed.toFixed(3)}× at the start</dd>
        </div>
      </dl>
    </section>
  );
}

function rangeText(result: OrbitResult) {
  return `${result.closestRadius.toFixed(2)}–${result.farthestRadius.toFixed(2)} starting radii`;
}

export function OrbitComparisonPlot({
  trials,
}: {
  trials: readonly OrbitInputs[];
}) {
  return (
    <div className={`orbit-comparison orbit-comparison--${trials.length}`}>
      {trials.map((inputs) => {
        const result = orbitActivity(inputs);
        return (
          <article
            className={`orbit-trial orbit-trial--${result.outcome}`}
            key={`${inputs.speed}-${inputs.mass}`}
          >
            <div className="orbit-trial-label">
              <strong>
                {inputs.speed.toFixed(2)}× {OUTCOME_LABEL[result.outcome]}
              </strong>
              <span>mass {inputs.mass.toFixed(1)}×</span>
            </div>
            <svg viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true">
              <circle className="orbit-mini-start" r="1" />
              <circle className="orbit-mini-planet" r={result.planetRadius} />
              <path className="orbit-mini-path" d={pathData(result.points)} />
              <circle className="orbit-mini-launch" cx="1" cy="0" r=".055" />
            </svg>
            <p>
              <b aria-hidden="true">{OUTCOME_MARK[result.outcome]}</b>{" "}
              {rangeText(result)}
            </p>
          </article>
        );
      })}
    </div>
  );
}
