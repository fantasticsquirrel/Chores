import {
  type CaravanCargo,
  type CaravanRoute,
  type CaravanSeason,
} from "@family-manager/family-api/discovery-models/math-life";
const ROAD_PATHS = {
  ridge: "M83 245Q162 56 346 91Q510 69 638 232",
  river: "M83 245Q242 286 381 216Q505 165 638 232",
  oasis: "M83 245Q213 362 402 313Q540 315 638 232",
};
function Camel({
  x,
  y,
  color,
  packs,
}: {
  x: number;
  y: number;
  color: string;
  packs: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-30-2Q-21-20-13-4Q-5-23 5-4L20-5L25-27L36-30L42-25L32-21L29 5L18 10L15 32H10L9 11H-14L-19 32H-24L-22 7L-33 4L-37-4"
        fill="#c9a678"
        stroke="#654c3b"
        strokeWidth="2"
      />
      <path d="M-25-3Q-8 1 12-4L11 10H-23Z" fill={color} stroke="#e3ce9a" />
      {Array.from({ length: packs }, (_, i) => (
        <rect
          key={i}
          x={-24 + i * 7}
          y="-9"
          width="6"
          height="11"
          rx="1"
          fill={color}
          stroke="#efdeb0"
          strokeWidth=".7"
        />
      ))}
      <circle cx="36" cy="-27" r="1.3" fill="#241c23" />
    </g>
  );
}
export function CaravanMap({
  route,
  season,
  cargo,
  units,
}: {
  route: CaravanRoute;
  season: CaravanSeason;
  cargo: CaravanCargo;
  units: number;
}) {
  const color =
    cargo === "grain" ? "#e5bf62" : cargo === "cloth" ? "#b28bd0" : "#dc8b65";
  return (
    <g>
      <path
        d="M12 50Q160 15 300 56T708 48V349Q570 374 350 350T12 355Z"
        fill="#b3a67e"
        opacity=".12"
      />
      {[180, 245, 312, 390, 460].map((x, i) => (
        <g key={x}>
          <path
            d={`M${x - 45} 148L${x} ${63 - (i % 2) * 15}L${x + 54} 148Z`}
            fill={i % 2 ? "#777a6e" : "#626c63"}
            stroke="#a9aa8b"
            strokeWidth=".6"
          />
          <path
            d={`M${x - 13} ${93 - (i % 2) * 15}L${x} ${63 - (i % 2) * 15}L${x + 18} ${94 - (i % 2) * 15}l-15-7-9 6Z`}
            fill={season === "wet" ? "#d4ddd3" : "#bcbfa8"}
            opacity={season === "wet" ? 0.9 : 0.4}
          />
        </g>
      ))}
      <path
        d="M110 180Q210 306 368 222T692 227"
        fill="none"
        stroke="#4d8c9e"
        strokeWidth={season === "wet" ? 22 : 9}
        opacity=".7"
      />
      <path
        d="M110 180Q210 306 368 222T692 227"
        fill="none"
        stroke="#99d3cd"
        strokeWidth="2"
        opacity=".7"
      />
      <ellipse cx="362" cy="310" rx="48" ry="17" fill="#567d60" />
      {[328, 365, 396].map((x) => (
        <g key={x}>
          <path
            d={`M${x} 307q8-25 3-40`}
            stroke="#b99a60"
            strokeWidth="4"
            fill="none"
          />
          <path
            d={`M${x + 3} 267q-21-16-26 4q17-7 26-4q19-18 28 2q-17-6-28-2q-2-24 12-20q-9 8-12 20`}
            fill="#71a575"
          />
        </g>
      ))}
      {Object.entries(ROAD_PATHS).map(([key, path]) => (
        <path
          key={key}
          d={path}
          fill="none"
          stroke={route === key ? "#f4d58d" : "#c6bca2"}
          strokeWidth={route === key ? 4 : 1.5}
          strokeDasharray={route === key ? "8 5" : "3 7"}
          opacity={route === key ? 1 : 0.4}
        />
      ))}
      {[
        { x: 55, y: 229 },
        { x: 610, y: 215 },
      ].map(({ x, y }) => (
        <g key={x} transform={`translate(${x} ${y})`}>
          <rect width="53" height="33" fill="#c8ad80" stroke="#74694f" />
          <path d="M-6 0L26-26L59 0Z" fill="#946844" />
          <rect x="21" y="10" width="12" height="23" fill="#394c43" />
          <path d="M0 38H58" stroke="#d6c096" strokeWidth="2" />
          <rect x="39" y="-30" width="4" height="30" fill="#d5c59b" />
          <path d="M43-30h19l-8 8H43Z" fill="#9ac3b9" />
        </g>
      ))}
      <text x="80" y="286" textAnchor="middle">
        Willow market
      </text>
      <text x="638" y="280" textAnchor="middle">
        Harbor town
      </text>
      <text x="348" y="57" textAnchor="middle" className="dl-svg-small">
        MOUNTAIN PASS
      </text>
      <text x="478" y="179" className="dl-svg-small">
        RIVER ROAD
      </text>
      <text x="409" y="342" className="dl-svg-small">
        OASIS TRAIL
      </text>
      <g
        transform={
          route === "ridge"
            ? "translate(290 117)"
            : route === "river"
              ? "translate(285 239)"
              : "translate(244 314)"
        }
      >
        <Camel x={0} y={0} color={color} packs={Math.min(5, units)} />
        <Camel x={-82} y={7} color={color} packs={Math.max(0, units - 5)} />
        <path d="M-43-24L-63-19" stroke="#d6c3a4" fill="none" />
      </g>
      <path d="M670 64v-23m-6 8 6-8 6 8" fill="none" stroke="#e7d1a2" />
      <text x="670" y="32" textAnchor="middle" className="dl-svg-small">
        N
      </text>
    </g>
  );
}
