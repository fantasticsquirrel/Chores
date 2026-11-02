import { useId } from "react";
import {
  PATTERN_MARKER,
  rigidTransformPoint,
} from "@family-manager/family-api/discovery-models/patterns";
import {
  regularTile,
  vertexFit,
} from "@family-manager/family-api/discovery-models/math-life";
import { sectorPath } from "../mathLifeGeometry";
import { MosaicMotif } from "../pattern/PatternMosaicMotif";
import { PATTERN_TILE_COLORS } from "../pattern/patternVisualConstants";
export { MosaicMotif } from "../pattern/PatternMosaicMotif";
export function PatternWorkbench({
  sides,
  copies,
  rotation,
  mirror,
  repeat,
  transformationLabel,
}: {
  sides: number;
  copies: number;
  rotation: number;
  mirror: boolean;
  repeat: number;
  transformationLabel?: string;
}) {
  const id = useId(),
    fit = vertexFit(sides, copies);
  const marker = rigidTransformPoint(PATTERN_MARKER, {
    rotationDegreesClockwise: rotation,
    reflectAcrossVertical: mirror,
  })!;
  const result = fit.gap
    ? `${fit.gap}° gap`
    : fit.overlap
      ? `${fit.overlap}° overlap`
      : "360° exact fit";
  return (
    <div
      className="pattern-workbench"
      role="img"
      aria-label={`${copies} regular ${sides}-sided tiles meet at one point. Each interior angle is ${fit.angle} degrees; the total is ${fit.angle * copies} degrees, with ${fit.gap} degrees of gap and ${fit.overlap} degrees of overlap. Motif image: ${transformationLabel ?? `${rotation} degree rotation${mirror ? " after a vertical reflection" : ""}`}; point M is ${Math.abs(marker.x)} units ${marker.x < 0 ? "left" : "right"} and ${Math.abs(marker.y)} units ${marker.y < 0 ? "up" : "down"} from center. ${repeat} identical motif copies are shown.`}
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
              id={`${id}-inlay`}
              width="44"
              height="44"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="22" height="22" fill="#2b554e" />
              <rect x="22" y="22" width="22" height="22" fill="#37655b" />
              <path d="M0 22H44M22 0V44" stroke="#92a68e" strokeWidth=".5" />
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
          <path
            d="M34 507V146Q34 42 138 42H502Q606 42 606 146V507Z"
            fill={`url(#${id}-inlay)`}
            stroke="#d0b36d"
            strokeWidth="4"
          />
          <rect
            x="48"
            y="58"
            width="544"
            height="440"
            rx="12"
            fill={`url(#${id}-grid)`}
            stroke="#173b36"
            strokeWidth="8"
          />
          {[
            [63, 72],
            [577, 72],
            [63, 484],
            [577, 484],
          ].map(([x, y], index) => (
            <g key={`rosette-${index}`} transform={`translate(${x} ${y})`}>
              <circle r="13" fill="#cda85a" stroke="#f3dfaa" />
              <path
                d="M0-10L3-3L10 0L3 3L0 10L-3 3L-10 0L-3-3Z"
                fill="#2d5c52"
              />
            </g>
          ))}
          <circle
            cx="320"
            cy="269"
            r="220"
            fill="#2f554d"
            stroke="#a2b3a2"
            strokeWidth=".75"
            filter={`url(#${id}-shadow)`}
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
          {[0, 90, 270].map((angle) => (
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
                  fill={PATTERN_TILE_COLORS[i % PATTERN_TILE_COLORS.length]}
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
            fill="#132f2c"
            stroke="#d0b36d"
          />
          <text
            x="320"
            y="491"
            fill="#f0e4c3"
            textAnchor="middle"
            fontSize="21"
            fontFamily="Georgia"
          >
            {result === "360° exact fit" ? "exact 360° fit" : result}
          </text>
        </svg>
        <p className="pattern-board-caption">
          {copies} × {fit.angle}° = <strong>{copies * fit.angle}°</strong>{" "}
          around one point
        </p>
      </div>
      <aside className="pattern-transform-study">
        <span className="tactile-kicker">TRACK POINT M</span>
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
              <MosaicMotif x={65} y={65} rotation={90} />
            </svg>
            <span>90° clockwise</span>
          </div>
          <div>
            <svg viewBox="0 0 130 130" aria-hidden="true">
              <path d="M65 8V122" stroke="#927f5d" strokeDasharray="3 4" />
              <MosaicMotif x={65} y={65} mirror />
            </svg>
            <span>Vertical reflection</span>
          </div>
        </div>
        <p>
          Original M: 30 left, 18 up. Turned M: 18 right, 30 up. Reflected M: 30
          right, 18 up. Corresponding lengths and angles stay equal.
        </p>
        <div className="pattern-measure">
          <span>CURRENT IMAGE</span>
          <strong>{transformationLabel ?? `${rotation}° turn`}</strong>
          <span>POINT M</span>
          <strong>
            {Math.abs(marker.x)} {marker.x < 0 ? "left" : "right"} ·{" "}
            {Math.abs(marker.y)} {marker.y < 0 ? "up" : "down"}
          </strong>
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
