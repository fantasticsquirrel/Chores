import { useId } from "react";
import {
  POLLINATOR_FLOWERS,
  type PollinatorState,
} from "@family-manager/family-api/discovery-models/math-life";
export function PollinatorGarden({
  state,
  reach,
  habitat,
}: {
  state: PollinatorState;
  reach: number;
  habitat: boolean;
}) {
  const id = useId();
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-meadow`}>
          <stop stopColor="#537c52" />
          <stop offset=".68" stopColor="#2d5845" />
          <stop offset="1" stopColor="#163a34" />
        </radialGradient>
        <radialGradient id={`${id}-gold`}>
          <stop stopColor="#f6ae3c" />
          <stop offset=".65" stopColor="#ffe8a0" />
          <stop offset="1" stopColor="#dda14d" />
        </radialGradient>
        <radialGradient id={`${id}-violet`}>
          <stop stopColor="#b77dd5" />
          <stop offset=".65" stopColor="#ead2f5" />
          <stop offset="1" stopColor="#9665b4" />
        </radialGradient>
        <radialGradient id={`${id}-bee`}>
          <stop stopColor="#ffe5a1" />
          <stop offset="1" stopColor="#d99b36" />
        </radialGradient>
        <filter
          id={`${id}-shadow`}
          x="-60%"
          y="-60%"
          width="220%"
          height="220%"
        >
          <feDropShadow
            dx="2"
            dy="4"
            stdDeviation="3"
            floodColor="#061b18"
            floodOpacity=".7"
          />
        </filter>
      </defs>
      <path
        d="M26 72Q119 38 243 73Q300 122 288 256Q298 373 179 386Q54 383 29 308Z"
        fill={`url(#${id}-meadow)`}
        stroke="#769b6d"
        strokeOpacity=".3"
      />
      <path
        d="M442 72Q536 38 678 83L693 333Q612 401 471 373Q420 324 430 235Q412 118 442 72Z"
        fill={`url(#${id}-meadow)`}
        stroke="#769b6d"
        strokeOpacity=".3"
      />
      <path
        d="M331 50Q379 167 319 237Q299 311 374 405"
        fill="none"
        stroke="#aaa37a"
        strokeWidth="48"
        opacity=".18"
      />
      {habitat && (
        <path
          d="M252 159Q344 132 429 181L439 264Q392 351 300 330L276 259Z"
          fill={`url(#${id}-meadow)`}
          stroke="#8ebc83"
          strokeOpacity=".6"
        />
      )}
      {Array.from({ length: 95 }, (_, i) => {
        const x = 38 + ((i * 137) % 645),
          y = 80 + ((i * 79) % 300);
        if (!habitat && x > 275 && x < 438) return null;
        return (
          <g key={i} opacity={0.18 + (i % 3) * 0.08}>
            <path
              d={`M${x} ${y}q-9-8-2-18q6 9 2 18m0 0q10-13 14-6q-4 9-14 6`}
              fill={i % 2 ? "#b3c780" : "#6fbe87"}
            />
            <circle cx={x - 5} cy={y - 18} r="1.5" fill="#e3d99e" />
          </g>
        );
      })}
      <circle
        cx={state.x}
        cy={state.y}
        r={reach}
        fill="#d7e7a9"
        fillOpacity=".035"
        stroke="#cee0a7"
        strokeWidth="1"
        strokeDasharray="6 7"
        opacity=".65"
      />
      <polyline
        points={state.path.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke="#f2d68e"
        strokeWidth="2"
        strokeDasharray="3 5"
        opacity=".7"
      />
      {POLLINATOR_FLOWERS.filter((flower) => habitat || !flower.bridge).map(
        (flower) => {
          const accessible =
            Math.hypot(flower.x - state.x, flower.y - state.y) <= reach;
          const received = state.pollinated.includes(flower.id);
          return (
            <g key={flower.id} transform={`translate(${flower.x} ${flower.y})`}>
              <circle
                r="35"
                fill="none"
                stroke={
                  received ? "#d6efad" : accessible ? "#b7dfd0" : "#788a7a"
                }
                strokeWidth={received ? 2 : 1}
                opacity={accessible || received ? 0.75 : 0.2}
                strokeDasharray={received ? undefined : "2 5"}
              />
              <g filter={`url(#${id}-shadow)`}>
                <path
                  d="M-6 18Q-36 24-32 2Q-13 0-6 18M6 18Q34 36 35 10Q15 1 6 18"
                  fill="#579364"
                  stroke="#81ab73"
                  strokeWidth=".6"
                />
                {Array.from(
                  { length: flower.species === "gold" ? 8 : 5 },
                  (_, i) => (
                    <ellipse
                      key={i}
                      cx="0"
                      cy="-13"
                      rx={flower.species === "gold" ? 8 : 12}
                      ry="17"
                      transform={`rotate(${(i * 360) / (flower.species === "gold" ? 8 : 5)})`}
                      fill={`url(#${id}-${flower.species})`}
                      stroke={flower.species === "gold" ? "#f5d97c" : "#e7c8ef"}
                      strokeWidth=".6"
                    />
                  ),
                )}
                <circle
                  r="10"
                  fill={flower.species === "gold" ? "#8b673c" : "#e2b957"}
                  stroke="#f5d886"
                  strokeWidth="1"
                />
                {Array.from({ length: 7 }, (_, i) => (
                  <circle
                    key={i}
                    cx={Math.cos(i) * 6}
                    cy={Math.sin(i) * 6}
                    r="1.1"
                    fill="#ffe3a0"
                  />
                ))}
              </g>
              <rect
                x="-44"
                y="39"
                width="88"
                height="20"
                rx="8"
                fill="#102c2b"
                opacity=".85"
              />
              <text y="53" textAnchor="middle" className="dl-svg-small">
                {flower.name}
                {received ? " ✓" : ""}
              </text>
            </g>
          );
        },
      )}
      <g
        transform={`translate(${state.x + 14} ${state.y - 25}) rotate(-23)`}
        filter={`url(#${id}-shadow)`}
      >
        <ellipse
          cx="-7"
          cy="-11"
          rx="8"
          ry="13"
          transform="rotate(-30 -7 -11)"
          fill="#d8eff0"
          fillOpacity=".7"
          stroke="#b6d6df"
        />
        <ellipse
          cx="8"
          cy="-11"
          rx="8"
          ry="13"
          transform="rotate(30 8 -11)"
          fill="#e6f5f5"
          fillOpacity=".7"
          stroke="#b6d6df"
        />
        <ellipse cy="1" rx="10" ry="15" fill={`url(#${id}-bee)`} />
        <path d="M-9-4H9M-9 4H9M-6 11H6" stroke="#4a3a27" strokeWidth="4" />
        <circle cy="-14" r="7" fill="#493b2b" />
        <path d="M-3-20l-4-5M3-20l4-5" stroke="#b8c4a4" strokeWidth="1.5" />
        {state.pollen && (
          <>
            <circle
              cx="-12"
              cy="5"
              r="3"
              fill={state.pollen.species === "gold" ? "#ffd879" : "#d4a2ed"}
            />
            <circle
              cx="12"
              cy="5"
              r="3"
              fill={state.pollen.species === "gold" ? "#ffd879" : "#d4a2ed"}
            />
          </>
        )}
      </g>
      <text x="45" y="398" className="dl-svg-small">
        Dashed circle: flight reach · ✓ compatible pollen received
      </text>
    </g>
  );
}
