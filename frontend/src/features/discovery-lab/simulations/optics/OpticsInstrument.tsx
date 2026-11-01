import { useId } from "react";
import { opticsActivity } from "@family-manager/family-api/discovery-models/optics";

type Result = ReturnType<typeof opticsActivity>;
const CENTER = { x: 480, y: 300 };

function point(angle: number, radius: number, lower = false) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER.x + Math.sin(radians) * radius,
    y: CENTER.y + (lower ? 1 : -1) * Math.cos(radians) * radius,
  };
}

function arc(
  angle: number,
  radius: number,
  side: "left" | "right",
  lower = false,
) {
  const end = point(side === "left" ? -angle : angle, radius, lower);
  const start = point(0, radius, lower);
  const sweep = lower ? (side === "right" ? 0 : 1) : side === "right" ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep} ${end.x} ${end.y}`;
}

function materialTone(id: Result["from"]["id"], lower: boolean, uid: string) {
  return `url(#${uid}-${id}-${lower ? "lower" : "upper"})`;
}

export function OpticsInstrument({ result }: { result: Result }) {
  const uid = useId().replace(/:/g, "");
  const incidentStart = point(-result.inputs.angle, 230);
  const reflectedEnd = point(result.inputs.angle, 218);
  const refractedEnd = point(result.refractedAngle ?? 0, 228, true);
  const criticalPoint = result.criticalAngle
    ? point(-result.criticalAngle, 178)
    : null;
  const lowerTone =
    result.from.id === result.to.id
      ? materialTone(result.from.id, false, uid)
      : materialTone(result.to.id, true, uid);
  const description = `${result.from.name} to ${result.to.name}. Incident angle ${result.inputs.angle.toFixed(1)} degrees from the normal. ${
    result.reflectedAngle === null
      ? "Equal indices: no reflected branch."
      : `Reflected angle ${result.reflectedAngle.toFixed(1)} degrees.`
  } ${
    result.tir
      ? `Total internal reflection above the ${result.criticalAngle?.toFixed(1)} degree critical angle; no transmitted ray.`
      : `Refracted angle ${result.refractedAngle?.toFixed(1)} degrees.`
  }`;

  return (
    <figure className="optics-instrument">
      <svg viewBox="0 0 960 610" role="img" aria-label={description}>
        <defs>
          <linearGradient id={`${uid}-frame`} x2="0" y2="1">
            <stop stopColor="#66798a" />
            <stop offset=".18" stopColor="#1b2d3b" />
            <stop offset=".78" stopColor="#07121d" />
            <stop offset="1" stopColor="#445968" />
          </linearGradient>
          <radialGradient id={`${uid}-air-upper`}>
            <stop stopColor="#173b55" />
            <stop offset="1" stopColor="#071722" />
          </radialGradient>
          <linearGradient id={`${uid}-air-lower`} x2="0" y2="1">
            <stop stopColor="#102a3c" />
            <stop offset="1" stopColor="#06131d" />
          </linearGradient>
          <linearGradient id={`${uid}-water-upper`} x2="0" y2="1">
            <stop stopColor="#155b74" />
            <stop offset="1" stopColor="#092435" />
          </linearGradient>
          <linearGradient id={`${uid}-water-lower`} x2="0" y2="1">
            <stop stopColor="#17627c" />
            <stop offset="1" stopColor="#071c2b" />
          </linearGradient>
          <linearGradient id={`${uid}-glass-upper`} x2="1" y2="1">
            <stop stopColor="#27485b" />
            <stop offset=".48" stopColor="#153b4d" />
            <stop offset="1" stopColor="#102531" />
          </linearGradient>
          <linearGradient id={`${uid}-glass-lower`} x2="1" y2="1">
            <stop stopColor="#1a4052" />
            <stop offset=".5" stopColor="#286171" />
            <stop offset="1" stopColor="#0b2635" />
          </linearGradient>
          <pattern
            id={`${uid}-grid`}
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M32 0H0V32"
              fill="none"
              stroke="#9bc7d5"
              strokeOpacity=".07"
            />
          </pattern>
          <filter
            id={`${uid}-glow`}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id={`${uid}-shadow`}
            x="-30%"
            y="-30%"
            width="160%"
            height="180%"
          >
            <feDropShadow
              dx="0"
              dy="11"
              stdDeviation="12"
              floodColor="#000"
              floodOpacity=".7"
            />
          </filter>
          <marker
            id={`${uid}-gold-arrow`}
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10z" fill="#ffd27a" />
          </marker>
          <marker
            id={`${uid}-rose-arrow`}
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10z" fill="#ff9cae" />
          </marker>
          <marker
            id={`${uid}-cyan-arrow`}
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0L10 5L0 10z" fill="#8fffe1" />
          </marker>
        </defs>

        <rect
          x="5"
          y="5"
          width="950"
          height="600"
          rx="32"
          fill={`url(#${uid}-frame)`}
          filter={`url(#${uid}-shadow)`}
        />
        <rect
          x="20"
          y="20"
          width="920"
          height="570"
          rx="24"
          fill="#07131e"
          stroke="#8094a0"
          strokeOpacity=".48"
        />
        <path
          d="M32 32H928V300H32z"
          fill={materialTone(result.from.id, false, uid)}
        />
        <path d="M32 300H928V578H32z" fill={lowerTone} />
        <rect
          x="32"
          y="32"
          width="896"
          height="546"
          fill={`url(#${uid}-grid)`}
        />

        {result.to.id === "glass" && (
          <g opacity=".25">
            <path
              d="M74 548L337 300M205 578L468 300M530 578L793 300M660 578L923 330"
              stroke="#bdfcff"
              strokeWidth="11"
            />
          </g>
        )}
        {result.from.id === "glass" && (
          <g opacity=".18">
            <path
              d="M93 268L345 32M260 300L517 32M610 300L877 45"
              stroke="#bdfcff"
              strokeWidth="10"
            />
          </g>
        )}

        <g className="optics-medium-label">
          <text x="58" y="66">
            FROM · {result.from.name.toUpperCase()}
          </text>
          <text x="58" y="114">
            n = {result.from.refractiveIndex.toFixed(3)}
          </text>
          <text x="58" y="340">
            TO · {result.to.name.toUpperCase()}
          </text>
          <text x="58" y="388">
            n = {result.to.refractiveIndex.toFixed(3)}
          </text>
        </g>

        <g className="optics-ticks" aria-hidden="true">
          {Array.from({ length: 17 }, (_, index) => -80 + index * 10).flatMap(
            (angle) => {
              const upperOuter = point(angle, 190);
              const upperInner = point(angle, angle % 30 === 0 ? 176 : 182);
              const lowerOuter = point(angle, 190, true);
              const lowerInner = point(
                angle,
                angle % 30 === 0 ? 176 : 182,
                true,
              );
              return [
                <line
                  key={`u-${angle}`}
                  x1={upperInner.x}
                  y1={upperInner.y}
                  x2={upperOuter.x}
                  y2={upperOuter.y}
                />,
                <line
                  key={`l-${angle}`}
                  x1={lowerInner.x}
                  y1={lowerInner.y}
                  x2={lowerOuter.x}
                  y2={lowerOuter.y}
                />,
              ];
            },
          )}
          <path d="M290 300A190 190 0 0 1 670 300" />
          <path d="M290 300A190 190 0 0 0 670 300" />
        </g>

        <line
          className="optics-normal"
          x1={CENTER.x}
          y1="54"
          x2={CENTER.x}
          y2="554"
        />
        <g className="optics-normal-label">
          <rect x="490" y="50" width="260" height="48" rx="22" />
          <text x="620" y="82" textAnchor="middle">
            NORMAL · 0°
          </text>
        </g>
        <line
          className="optics-boundary"
          x1="32"
          y1={CENTER.y}
          x2="928"
          y2={CENTER.y}
        />

        {criticalPoint && (
          <g className="optics-critical-mark">
            <line
              x1={criticalPoint.x - 5}
              y1={criticalPoint.y - 5}
              x2={criticalPoint.x + 8}
              y2={criticalPoint.y + 8}
            />
            <text
              x={criticalPoint.x - 110}
              y={criticalPoint.y - 13}
              textAnchor="end"
            >
              θc {result.criticalAngle?.toFixed(1)}°
            </text>
          </g>
        )}

        <g filter={`url(#${uid}-glow)`} className="optics-rays">
          <path
            className="optics-ray-glow optics-ray-glow--incident"
            d={`M${incidentStart.x} ${incidentStart.y}L${CENTER.x} ${CENTER.y}`}
          />
          <path
            className="optics-ray optics-ray--incident"
            markerEnd={`url(#${uid}-gold-arrow)`}
            d={`M${incidentStart.x} ${incidentStart.y}L${CENTER.x} ${CENTER.y}`}
          />
          {result.reflectedAngle !== null && (
            <>
              <path
                className="optics-ray-glow optics-ray-glow--reflected"
                d={`M${CENTER.x} ${CENTER.y}L${reflectedEnd.x} ${reflectedEnd.y}`}
              />
              <path
                data-testid="reflected-ray"
                className="optics-ray optics-ray--reflected"
                markerEnd={`url(#${uid}-rose-arrow)`}
                d={`M${CENTER.x} ${CENTER.y}L${reflectedEnd.x} ${reflectedEnd.y}`}
              />
            </>
          )}
          {!result.tir && (
            <>
              <path
                className="optics-ray-glow optics-ray-glow--refracted"
                d={`M${CENTER.x} ${CENTER.y}L${refractedEnd.x} ${refractedEnd.y}`}
              />
              <path
                className="optics-ray optics-ray--refracted"
                markerEnd={`url(#${uid}-cyan-arrow)`}
                d={`M${CENTER.x} ${CENTER.y}L${refractedEnd.x} ${refractedEnd.y}`}
              />
            </>
          )}
        </g>

        <path
          className="optics-angle optics-angle--incident"
          d={arc(result.inputs.angle, 83, "left")}
        />
        <text
          className="optics-angle-label"
          x={point(-result.inputs.angle / 2, 106).x}
          y={point(-result.inputs.angle / 2, 106).y}
          textAnchor="end"
        >
          θᵢ {result.inputs.angle.toFixed(1)}°
        </text>
        {result.reflectedAngle !== null && (
          <>
            <path
              className="optics-angle optics-angle--reflected"
              d={arc(result.reflectedAngle, 72, "right")}
            />
            <text
              className="optics-angle-label"
              x={point(result.reflectedAngle / 2, 99).x}
              y={point(result.reflectedAngle / 2, 99).y}
              textAnchor="start"
            >
              θᵣ {result.reflectedAngle.toFixed(1)}°
            </text>
          </>
        )}
        {!result.tir && result.refractedAngle !== null && (
          <>
            <path
              className="optics-angle optics-angle--refracted"
              d={arc(result.refractedAngle, 80, "right", true)}
            />
            <text
              className="optics-angle-label"
              x={point(result.refractedAngle / 2, 110, true).x}
              y={point(result.refractedAngle / 2, 110, true).y}
            >
              θ₂ {result.refractedAngle.toFixed(1)}°
            </text>
          </>
        )}

        <g
          transform={`translate(${incidentStart.x} ${incidentStart.y}) rotate(${-result.inputs.angle})`}
          className="optics-emitter"
        >
          <rect
            x="-35"
            y="-73"
            width="70"
            height="72"
            rx="13"
            className="optics-emitter-shadow"
          />
          <rect
            x="-31"
            y="-76"
            width="62"
            height="69"
            rx="12"
            className="optics-emitter-body"
          />
          <path d="M-27 -58H27M-27 -45H27M-27 -32H27" />
          <rect
            x="-17"
            y="-24"
            width="34"
            height="22"
            rx="5"
            className="optics-emitter-neck"
          />
          <circle cx="0" cy="-18" r="4" className="optics-emitter-light" />
        </g>
        <circle
          cx={CENTER.x}
          cy={CENTER.y}
          r="13"
          className="optics-impact-glow"
        />
        <circle cx={CENTER.x} cy={CENTER.y} r="4" className="optics-impact" />

        {result.tir && (
          <g className="optics-tir-badge">
            <rect x="530" y="465" width="350" height="100" rx="18" />
            <text x="705" y="505" textAnchor="middle">
              TIR
            </text>
            <text x="705" y="550" textAnchor="middle">
              NO RAY CROSSES
            </text>
          </g>
        )}
        {[45, 915].flatMap((x) =>
          [62, 548].map((y) => (
            <g key={`${x}-${y}`} className="optics-screw">
              <circle cx={x} cy={y} r="9" />
              <path d={`M${x - 4} ${y}H${x + 4}`} />
            </g>
          )),
        )}
      </svg>
      <figcaption>
        <span>
          <i className="is-incident" /> incident
        </span>
        <span>
          <i className="is-reflected" /> reflected
        </span>
        {!result.tir && (
          <span>
            <i className="is-refracted" /> refracted
          </span>
        )}
        <span>angles from the normal</span>
      </figcaption>
    </figure>
  );
}
