import { sectorPath } from "../mathLifeGeometry";
import type { PizzaPlate } from "./tableGeometry";
const COLORS = [
  "#bf6c48",
  "#398b88",
  "#8e71b1",
  "#c29b42",
  "#6e955e",
  "#567fa5",
];
export function PizzaFallback({ plates }: { plates: PizzaPlate[] }) {
  return (
    <div className="tactile-fallback-pizzas">
      {plates.map((plate, p) => (
        <svg key={p} viewBox="0 0 300 300">
          <circle
            cx="150"
            cy="150"
            r="133"
            fill={p ? "#d5e1db" : "#f4eddb"}
            stroke="#9a8f6d"
            strokeWidth="3"
          />
          <circle cx="150" cy="150" r="117" fill="none" stroke="#afa58b" />
          {Array.from({ length: plate.d }, (_, slice) => (
            <g key={slice}>
              <path
                d={sectorPath(
                  150,
                  150,
                  111,
                  -90 + (slice * 360) / plate.d,
                  -90 + ((slice + 1) * 360) / plate.d,
                )}
                fill={plate.slices.includes(slice) ? "#cc9751" : "#e8e5d6"}
                stroke="#a38f64"
                strokeWidth="1"
              />
              {plate.slices.includes(slice) && (
                <path
                  d={sectorPath(
                    150,
                    150,
                    99,
                    -90 + (slice * 360) / plate.d,
                    -90 + ((slice + 1) * 360) / plate.d,
                  )}
                  fill="#edc96c"
                  stroke="#ad8250"
                />
              )}
            </g>
          ))}
        </svg>
      ))}
    </div>
  );
}
export function ChanceFallback({
  chances,
  last,
  die,
}: {
  chances: number[];
  last: number | null;
  die: boolean;
}) {
  let angle = -90;
  return (
    <svg className="tactile-fallback-chance" viewBox="0 0 420 400">
      <circle
        cx="210"
        cy="200"
        r="169"
        fill="#a88c55"
        stroke="#7d6d4c"
        strokeWidth="4"
      />
      <circle cx="210" cy="200" r="154" fill="#e4decb" />
      {chances.map((chance, index) => {
        const start = angle;
        angle += chance * 360;
        const mid = (((start + angle) / 2) * Math.PI) / 180;
        return chance ? (
          <g key={index}>
            <path
              d={sectorPath(210, 200, 153, start, angle)}
              fill={COLORS[index]}
              stroke="#f1e6c8"
              strokeWidth="2"
            />
            <text
              x={210 + Math.cos(mid) * 116}
              y={207 + Math.sin(mid) * 116}
              textAnchor="middle"
              fill="#fff4d9"
              fontSize="24"
            >
              {index + 1}
            </text>
          </g>
        ) : null;
      })}
      <circle
        cx="210"
        cy="200"
        r="42"
        fill="#eee7d0"
        stroke="#8c7954"
        strokeWidth="3"
      />
      <text x="210" y="209" textAnchor="middle" fontSize="27" fill="#354f42">
        {last === null ? "—" : last + 1}
      </text>
      {die && (
        <text x="210" y="385" textAnchor="middle" fontSize="13" fill="#4b634f">
          Six die outcomes shown as probability sectors
        </text>
      )}
    </svg>
  );
}
