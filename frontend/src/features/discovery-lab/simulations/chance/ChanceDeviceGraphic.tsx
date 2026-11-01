import { useId } from "react";

const COLORS = [
  "#c76646",
  "#2f8782",
  "#8063a5",
  "#bd8f28",
  "#618d53",
  "#4f789f",
];

const CENTER_X = 210;
const CENTER_Y = 172;
const RADIUS = 132;

function polar(angle: number, radius = RADIUS) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER_X + Math.cos(radians) * radius,
    y: CENTER_Y + Math.sin(radians) * radius,
  };
}

function sectorPath(start: number, share: number) {
  if (share >= 0.999999) {
    return `M ${CENTER_X} ${CENTER_Y} m 0 -${RADIUS} a ${RADIUS} ${RADIUS} 0 1 1 0 ${RADIUS * 2} a ${RADIUS} ${RADIUS} 0 1 1 0 -${RADIUS * 2}`;
  }
  const end = start + share * 360;
  const first = polar(start);
  const last = polar(end);
  const largeArc = share > 0.5 ? 1 : 0;
  return `M ${CENTER_X} ${CENTER_Y} L ${first.x} ${first.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${last.x} ${last.y} Z`;
}

function pipPositions(value: number) {
  const left: [number, number] = [178, 154];
  const right: [number, number] = [242, 218];
  const middle: [number, number] = [210, 186];
  const positions: [number, number][] = [];
  if (value % 2 === 1) positions.push(middle);
  if (value >= 2) positions.push(left, right);
  if (value >= 4) positions.push([178, 218], [242, 154]);
  if (value === 6) positions.push([178, 186], [242, 186]);
  return positions;
}

export function ChanceDeviceGraphic({
  chances,
  die,
  last,
  selected,
}: {
  chances: number[];
  die: boolean;
  last: number | null;
  selected: number;
}) {
  const patternPrefix = useId().replace(/:/g, "");
  const sampledValue = (last ?? 0) + 1;

  if (die) {
    return (
      <svg
        className="chance-device-svg chance-device-die"
        viewBox="0 0 420 344"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={`${patternPrefix}-felt`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0" stopColor="#315e58" />
            <stop offset="1" stopColor="#173d38" />
          </linearGradient>
          <filter
            id={`${patternPrefix}-shadow`}
            x="-30%"
            y="-30%"
            width="160%"
            height="180%"
          >
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="10"
              floodColor="#142b25"
              floodOpacity=".3"
            />
          </filter>
        </defs>
        <rect
          x="34"
          y="28"
          width="352"
          height="270"
          rx="44"
          fill={`url(#${patternPrefix}-felt)`}
        />
        <path
          d="M61 257C131 287 290 292 359 247"
          fill="none"
          stroke="#d4ae62"
          strokeWidth="3"
          opacity=".55"
        />
        <g
          data-testid="chance-die"
          data-value={sampledValue}
          filter={`url(#${patternPrefix}-shadow)`}
        >
          <rect
            x="130"
            y="70"
            width="160"
            height="160"
            rx="34"
            fill="#fffaf0"
            stroke="#d5c8ad"
            strokeWidth="5"
          />
          <path
            d="M153 91H267"
            stroke="#fff"
            strokeWidth="7"
            strokeLinecap="round"
            opacity=".9"
          />
          {pipPositions(sampledValue).map(([cx, cy], index) => (
            <circle
              key={`${cx}-${cy}-${index}`}
              cx={cx}
              cy={cy}
              r="12"
              fill="#193f3a"
            />
          ))}
        </g>
      </svg>
    );
  }

  let cursor = -90;
  const sectors = chances.map((share, index) => {
    const start = cursor;
    const middle = start + share * 180;
    cursor += share * 360;
    const label = polar(middle, Math.min(88, 64 + share * 84));
    return { share, index, start, middle, label };
  });
  const pointerMiddle =
    last === null ? -90 : (sectors[last]?.middle ?? sectors[0]?.middle ?? -90);
  const pointerRotation = pointerMiddle + 90;

  return (
    <svg
      className="chance-device-svg chance-device-spinner"
      viewBox="0 0 420 344"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter
          id={`${patternPrefix}-wheel-shadow`}
          x="-30%"
          y="-30%"
          width="170%"
          height="190%"
        >
          <feDropShadow
            dx="0"
            dy="11"
            stdDeviation="9"
            floodColor="#2b352a"
            floodOpacity=".32"
          />
        </filter>
        <pattern
          id={`${patternPrefix}-p0`}
          width="13"
          height="13"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="3" cy="3" r="1.7" fill="#fff" opacity=".42" />
        </pattern>
        <pattern
          id={`${patternPrefix}-p1`}
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <path d="M0 1H12" stroke="#fff" strokeWidth="2" opacity=".3" />
        </pattern>
        <pattern
          id={`${patternPrefix}-p2`}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 7H14M7 0V14"
            stroke="#fff"
            strokeWidth="1.5"
            opacity=".25"
          />
        </pattern>
        <pattern
          id={`${patternPrefix}-p3`}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 0L16 16M16 0L0 16"
            stroke="#fff"
            strokeWidth="1.5"
            opacity=".22"
          />
        </pattern>
        <pattern
          id={`${patternPrefix}-p4`}
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <rect x="2" y="2" width="4" height="4" fill="#fff" opacity=".28" />
        </pattern>
        <pattern
          id={`${patternPrefix}-p5`}
          width="16"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 5Q4 0 8 5T16 5"
            fill="none"
            stroke="#fff"
            strokeWidth="1.5"
            opacity=".3"
          />
        </pattern>
      </defs>

      <g filter={`url(#${patternPrefix}-wheel-shadow)`}>
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r="146"
          fill="#3d493c"
          opacity=".24"
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r="143"
          fill="#d8b569"
          stroke="#76592c"
          strokeWidth="3"
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r="136"
          fill="#fff9e8"
          stroke="#f6e3ae"
          strokeWidth="3"
        />
        {sectors.map(({ share, index, start }) => {
          if (share <= 0) return null;
          const path = sectorPath(start, share);
          return (
            <g key={index}>
              <path
                d={path}
                fill={COLORS[index]}
                stroke="#fff8e7"
                strokeWidth={selected === index ? 6 : 3}
                data-testid={`chance-sector-${index + 1}`}
                data-share={(share * 100).toFixed(1)}
                data-selected={selected === index ? "true" : "false"}
              />
              <path
                d={path}
                fill={`url(#${patternPrefix}-p${index})`}
                data-testid="chance-sector-pattern"
                pointerEvents="none"
              />
            </g>
          );
        })}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r="136"
          fill="none"
          stroke="#314c45"
          strokeWidth="3"
        />
      </g>

      <g
        className="chance-pointer"
        data-testid="chance-pointer"
        data-outcome={last === null ? "none" : last + 1}
        style={{
          transform: `rotate(${pointerRotation}deg)`,
          transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
        }}
      >
        <path
          d="M210 166L210 54"
          stroke="#6d3d2f"
          strokeWidth="10"
          strokeLinecap="round"
          opacity=".28"
        />
        <path
          d="M210 160L210 50"
          stroke="#f9eee0"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M210 35L193 65H227Z"
          fill="#6d3d2f"
          stroke="#fff6df"
          strokeWidth="3"
        />
      </g>
      {sectors.map(({ share, index, label }) =>
        share > 0 ? (
          <g key={index}>
            <circle
              cx={label.x}
              cy={label.y}
              r="18"
              fill="#fffaf0"
              stroke="#28453f"
              strokeWidth="2"
            />
            <text
              x={label.x}
              y={label.y + 6}
              textAnchor="middle"
              className="chance-sector-label"
            >
              {index + 1}
            </text>
          </g>
        ) : null,
      )}
      <circle
        cx={CENTER_X}
        cy={CENTER_Y}
        r="19"
        fill="#d5a74c"
        stroke="#503d24"
        strokeWidth="4"
      />
      <circle cx={CENTER_X} cy={CENTER_Y} r="7" fill="#173f39" />
    </svg>
  );
}
