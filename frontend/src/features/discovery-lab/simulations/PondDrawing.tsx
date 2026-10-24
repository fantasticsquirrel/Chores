import { useId } from "react";
import type { PondState } from "@family-manager/family-api/discovery-models/physical-world";

export function PondDrawing({
  pond,
  trail,
  week,
  nutrients,
  drought,
}: {
  pond: PondState;
  trail: PondState[];
  week: number;
  nutrients: number;
  drought: number;
}) {
  const id = useId(),
    waterTop = 112 + drought * 0.55;
  const species = [
    { key: "algae", color: "#a1cf71" },
    { key: "zooplankton", color: "#a3d8ef" },
    { key: "fish", color: "#efb375" },
    { key: "oxygen", color: "#ded6ef" },
  ] as const;
  return (
    <>
      <defs>
        <linearGradient id={`${id}-water`} x1="0" x2="0" y2="1">
          <stop stopColor="#4d9397" />
          <stop offset="1" stopColor="#173c4b" />
        </linearGradient>
        <clipPath id={`${id}-pond`}>
          <path d={`M80 ${waterTop}H640L610 247Q360 270 110 247Z`} />
        </clipPath>
      </defs>
      <text x="30" y="34" className="dl-world-caption">
        POND / FOLLOW THE FOOD
      </text>
      <text x="90" y="69" className="dl-svg-small">
        algae → zooplankton → fish
      </text>
      <text x="633" y="69" textAnchor="end" className="dl-svg-small">
        Nutrients {nutrients} · drought {drought}%
      </text>
      <path
        d="M35 115Q92 91 127 117H594Q635 95 687 115L645 259Q362 296 73 259Z"
        fill="#6b6042"
      />
      <path
        d="M35 115Q92 91 127 117H594Q635 95 687 115"
        stroke="#85a869"
        strokeWidth="9"
        fill="none"
      />
      <path
        d={`M80 ${waterTop}H640L610 247Q360 270 110 247Z`}
        fill={`url(#${id}-water)`}
      />
      <path
        d={`M80 ${waterTop}Q170 ${waterTop - 6} 270 ${waterTop}T640 ${waterTop}`}
        stroke="#a3d6c6"
        strokeWidth="3"
        fill="none"
      />
      <g clipPath={`url(#${id}-pond)`}>
        <rect
          x="80"
          y={waterTop}
          width="560"
          height="145"
          fill="#a2c35d"
          opacity={pond.algae / 340}
        />
        {Array.from({ length: Math.ceil(pond.algae / 2.5) }, (_, i) => (
          <g key={i} fill="#b0d777" opacity=".8">
            <ellipse
              cx={110 + ((i * 71) % 493)}
              cy={waterTop + 8 + ((i * 17) % 20)}
              rx={4 + (i % 3)}
              ry="2"
            />
            <circle
              cx={127 + ((i * 41) % 483)}
              cy={waterTop + 20 + ((i * 31) % 72)}
              r="1.5"
            />
          </g>
        ))}
        {Array.from({ length: Math.ceil(pond.zooplankton / 3) }, (_, i) => (
          <g
            key={i}
            transform={`translate(${125 + ((i * 61) % 460)} ${waterTop + 30 + ((i * 19) % 54)})`}
          >
            <ellipse rx="2.5" ry="4" fill="#bbe1e9" />
            <path d="M0-3L-4-7M0-3L4-7" stroke="#b0d9e2" />
          </g>
        ))}
        {Array.from({ length: Math.ceil(pond.fish / 5) }, (_, i) => (
          <g
            key={i}
            transform={`translate(${170 + ((i * 103) % 365)} ${waterTop + 50 + ((i * 21) % 35)}) scale(${i % 2 ? -1 : 1} 1)`}
          >
            <path d="M-14 0L-28-10V10Z" fill="#d48f5e" />
            <ellipse rx="20" ry="9" fill="#e5ba7d" />
            <path d="M-4-7L2-15L10-7M-4 7L3 14L9 7" fill="#bd865b" />
            <path d="M9-6Q3 0 9 6" fill="none" stroke="#ae764f" />
            <circle cx="13" cy="-2" r="2" fill="#263d3e" />
          </g>
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <path
            key={i}
            d={`M${130 + i * 48} 257q-13-19 0-36q12-11 0-24`}
            fill="none"
            stroke="#577d56"
            strokeWidth="3"
          />
        ))}
      </g>
      <path
        d="M58 113V67M62 111L70 79M660 110V60M666 111L680 76"
        stroke="#9db16b"
        strokeWidth="3"
      />
      <path
        d="M58 68V55M660 61V48"
        stroke="#a28758"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <text x="360" y="282" textAnchor="middle" className="dl-svg-small">
        Relative population indices · oxygen shown with a dotted line
      </text>
      <rect
        x="33"
        y="294"
        width="654"
        height="111"
        rx="11"
        fill="#0c2630"
        stroke="#365965"
      />
      {[0, 50, 100].map((value) => (
        <g key={value}>
          <path
            d={`M72 ${383 - value * 0.66}H663`}
            stroke="#43606c"
            strokeDasharray="2 5"
          />
          <text
            x="60"
            y={387 - value * 0.66}
            textAnchor="end"
            className="dl-svg-small"
          >
            {value}
          </text>
        </g>
      ))}
      {species.map(({ key, color }) => (
        <g key={key}>
          <polyline
            points={trail
              .map(
                (p, i) =>
                  `${75 + (i / Math.max(20, trail.length - 1)) * 584},${383 - p[key] * 0.66}`,
              )
              .join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeDasharray={key === "oxygen" ? "4 4" : undefined}
          />
          <circle
            cx={
              75 + ((trail.length - 1) / Math.max(20, trail.length - 1)) * 584
            }
            cy={383 - pond[key] * 0.66}
            r="3"
            fill={color}
          />
        </g>
      ))}
      <text x="76" y="399" className="dl-svg-small">
        Week {Math.max(0, week - 20)}
      </text>
      <text x="660" y="399" textAnchor="end" className="dl-svg-small">
        {week < 20 ? "20-week window" : `Week ${week}`}
      </text>
    </>
  );
}
