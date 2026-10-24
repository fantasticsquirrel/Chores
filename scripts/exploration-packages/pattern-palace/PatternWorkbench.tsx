/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment, useId } from "../shared/vector-author";
import { regularTile, vertexFit } from "./model";
import { sectorPath } from "./mathLifeGeometry";
const COLORS = [
  "#2d7b78",
  "#c0904a",
  "#647fa5",
  "#aa6270",
  "#668861",
  "#9475a0",
];
export function MosaicMotif({
  rotation = 0,
  mirror = false,
  x = 0,
  y = 0,
  size = 1,
}: {
  rotation?: number;
  mirror?: boolean;
  x?: number;
  y?: number;
  size?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <g
        transform={`rotate(${rotation}) scale(${mirror ? -1 : 1} 1)`}
        stroke="#f0e4ca"
        strokeWidth="1.4"
        strokeLinejoin="round"
      >
        <path
          d="M-42-42H42V42H-42Z"
          fill="#e2d7ba"
          stroke="#8b8065"
          strokeWidth="2"
        />
        <path d="M-39-39H39L0 0Z" fill="#315c5d" />
        <path d="M39-39V39L0 0Z" fill="#c4934d" />
        <path d="M39 39H-39L0 0Z" fill="#698c83" />
        <path d="M-39 39V-39L0 0Z" fill="#81a4a0" />
        <path d="M0-32L20 7L6 4L-13 29L-10 1L-28-8Z" fill="#f2dfb0" />
        <path
          d="M0-32L6 4L-13 29"
          fill="none"
          stroke="#a46f3f"
          strokeWidth="2"
        />
        <circle cx="-28" cy="-26" r="5" fill="#ba5a3f" stroke="#eed4a1" />
        <circle cx="28" cy="26" r="3" fill="#2a5d57" />
      </g>
    </g>
  );
}
export function PatternWorkbench({
  sides,
  copies,
  rotation,
  mirror,
  repeat,
}: {
  sides: number;
  copies: number;
  rotation: number;
  mirror: boolean;
  repeat: number;
}) {
  const id = useId(),
    fit = vertexFit(sides, copies);
  const result = fit.gap
    ? `${fit.gap}° gap`
    : fit.overlap
      ? `${fit.overlap}° overlap`
      : "360° exact fit";
  return (
    <div
      className="pattern-workbench"
      role="img"
      aria-label={`${repeat} copies of a motif rotated ${rotation} degrees${mirror ? " and reflected" : ""}. ${copies} regular ${sides}-sided tiles meet at a vertex, leaving ${fit.gap} degrees of gap and ${fit.overlap} degrees of overlap.`}
    >
      <div className="pattern-tile-board">
        <svg viewBox="0 0 640 540" aria-hidden="true">
          <defs>
            <pattern
              id={`${id}-grid`}
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M24 0H0V24"
                fill="none"
                stroke="#69857e"
                strokeWidth=".5"
                opacity=".35"
              />
            </pattern>
            <pattern
              id={`${id}-ceramic`}
              width="41"
              height="37"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="9" cy="11" r="1" fill="#fff2d0" opacity=".2" />
              <circle cx="31" cy="24" r=".6" fill="#173e3a" opacity=".2" />
              <path
                d="M5 29l4-1m13-20 3 2"
                stroke="#e6e1c6"
                strokeWidth=".4"
                opacity=".2"
              />
            </pattern>
            <linearGradient id={`${id}-glaze`} x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#fff" stopOpacity=".22" />
              <stop offset=".4" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#102f34" stopOpacity=".18" />
            </linearGradient>
            <filter
              id={`${id}-shadow`}
              x="-30%"
              y="-30%"
              width="170%"
              height="180%"
            >
              <feDropShadow
                dx="3"
                dy="7"
                stdDeviation="4"
                floodColor="#102925"
                floodOpacity=".35"
              />
            </filter>
          </defs>
          <rect
            x="12"
            y="13"
            width="616"
            height="514"
            rx="20"
            fill="#254b45"
            stroke="#b6a271"
            strokeWidth="3"
          />
          <rect
            x="22"
            y="23"
            width="596"
            height="494"
            rx="12"
            fill={`url(#${id}-grid)`}
          />
          <circle
            cx="320"
            cy="269"
            r="220"
            fill="#2f554d"
            stroke="#a2b3a2"
            strokeWidth=".75"
          />
          <circle
            cx="320"
            cy="269"
            r="207"
            fill="none"
            stroke="#abbba7"
            strokeWidth=".5"
            opacity=".6"
          />
          {Array.from({ length: 72 }, (_, i) => {
            const a = (i * Math.PI) / 36,
              inner = i % 6 === 0 ? 209 : 215;
            return (
              <path
                key={i}
                d={`M${320 + Math.sin(a) * inner} ${269 - Math.cos(a) * inner}L${320 + Math.sin(a) * 220} ${269 - Math.cos(a) * 220}`}
                stroke="#c2cbb5"
                strokeWidth={i % 6 === 0 ? 1.3 : 0.6}
              />
            );
          })}
          {[0, 90, 180, 270].map((angle) => (
            <text
              key={angle}
              x={320 + Math.sin((angle * Math.PI) / 180) * 238}
              y={274 - Math.cos((angle * Math.PI) / 180) * 238}
              textAnchor="middle"
              fill="#cdd6c2"
              fontSize="12"
            >
              {angle}°
            </text>
          ))}
          {fit.gap > 0 && (
            <path
              d={sectorPath(320, 269, 204, fit.angle * copies - 90, 270)}
              fill="#e9c87a"
              fillOpacity=".35"
              stroke="#f2d28c"
              strokeWidth="2"
            />
          )}
          {Array.from({ length: copies }, (_, i) => {
            const points = regularTile(sides, 96, i * fit.angle - 90)
              .map((p) => `${320 + p.x},${269 + p.y}`)
              .join(" ");
            const mid = ((i * fit.angle - 90 + fit.angle / 2) * Math.PI) / 180;
            return (
              <g key={i} filter={`url(#${id}-shadow)`}>
                <polygon
                  points={points}
                  transform="translate(0 5)"
                  fill="#173d38"
                  stroke="#153d38"
                  strokeWidth="3"
                />
                <polygon
                  points={points}
                  fill={COLORS[i]}
                  stroke="#d2d3b7"
                  strokeWidth="2"
                  fillOpacity={(i + 1) * fit.angle > 360 ? 0.86 : 1}
                />
                <polygon points={points} fill={`url(#${id}-glaze)`} />
                <polygon points={points} fill={`url(#${id}-ceramic)`} />
                <text
                  x={320 + Math.cos(mid) * 65}
                  y={274 + Math.sin(mid) * 65}
                  textAnchor="middle"
                  fill="#fff6db"
                  fontSize="15"
                  fontFamily="Georgia"
                >
                  {fit.angle}°
                </text>
              </g>
            );
          })}
          {fit.overlap > 0 && (
            <path
              d={sectorPath(
                320,
                269,
                198,
                -90,
                -90 + Math.min(fit.overlap, 359.99),
              )}
              fill="#e7a1b0"
              fillOpacity=".27"
              stroke="#f7bec7"
              strokeWidth="2"
              strokeDasharray="6 5"
            />
          )}
          <circle
            cx="320"
            cy="269"
            r="7"
            fill="#ebd4a4"
            stroke="#162f2b"
            strokeWidth="2"
          />
          <circle cx="320" cy="269" r="2" fill="#4e5e45" />
          <rect
            x="210"
            y="465"
            width="220"
            height="39"
            rx="5"
            fill="#1c3934"
            stroke="#81937c"
          />
          <text
            x="320"
            y="491"
            fill="#f0e4c3"
            textAnchor="middle"
            fontSize="21"
            fontFamily="Georgia"
          >
            {result}
          </text>
        </svg>
        <p className="pattern-board-caption">
          {copies} × {fit.angle}° = <strong>{copies * fit.angle}°</strong>{" "}
          around one point
        </p>
      </div>
      <aside className="pattern-transform-study">
        <span className="tactile-kicker">FOLLOW THE RED DOT</span>
        <div className="pattern-motif-pair">
          <div>
            <svg viewBox="0 0 130 130" aria-hidden="true">
              <MosaicMotif x={65} y={65} />
            </svg>
            <span>Original</span>
          </div>
          <div>
            <svg viewBox="0 0 130 130" aria-hidden="true">
              <path d="M65 8V122" stroke="#927f5d" strokeDasharray="3 4" />
              <MosaicMotif x={65} y={65} rotation={rotation} mirror={mirror} />
            </svg>
            <span>
              {mirror ? "Reflected, then turned" : `Turned ${rotation}°`}
            </span>
          </div>
        </div>
        <p>
          A turn changes direction. A reflection reverses left and right.
          Neither changes lengths or angles.
        </p>
        <div className="pattern-measure">
          <span>TURN</span>
          <strong>{rotation}°</strong>
          <span>REFLECTION</span>
          <strong>{mirror ? "Left ↔ right" : "None"}</strong>
        </div>
        <div className="pattern-repeat">
          <span className="tactile-kicker">{repeat} IDENTICAL COPIES</span>
          <svg
            viewBox={`0 0 ${Math.max(2, repeat) * 95} 105`}
            aria-hidden="true"
          >
            {Array.from({ length: repeat }, (_, i) => (
              <MosaicMotif
                key={i}
                x={48 + i * 95}
                y={52}
                rotation={rotation}
                mirror={mirror}
              />
            ))}
          </svg>
        </div>
      </aside>
    </div>
  );
}
