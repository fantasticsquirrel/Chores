import { CastleMaterials } from "./CastleMaterials";
import { useId } from "react";
export function CastleDrawing({
  moat,
  towers,
  gate,
  inner,
  approach,
  sight,
}: {
  moat: number;
  towers: boolean;
  gate: boolean;
  inner: boolean;
  approach: string;
  sight: boolean;
}) {
  const id = useId();
  return (
    <g>
      <CastleMaterials id={id} />
      <path
        d="M30 330Q90 280 98 210T150 60M580 65q62 50 48 150t60 130"
        fill="none"
        stroke="#728060"
        strokeWidth="1"
        opacity=".5"
      />
      <path
        d="M360 420V350M360 85V55"
        stroke="#9c9673"
        strokeWidth="32"
        opacity=".35"
      />
      {Array.from({ length: 20 }, (_, i) => {
        const x = i < 10 ? 55 + (i % 3) * 35 : 590 + (i % 3) * 35,
          y = 75 + (i % 10) * 29;
        return (
          <g key={i}>
            <ellipse
              cx={x + 7}
              cy={y + 7}
              rx="13"
              ry="9"
              fill="#102b23"
              opacity=".35"
            />
            <circle cx={x} cy={y} r={8 + (i % 4)} fill={`url(#${id}-tree)`} />
            <circle cx={x - 3} cy={y - 3} r="3" fill="#8ca46f" opacity=".3" />
          </g>
        );
      })}
      <rect
        x="202"
        y="112"
        width="322"
        height="225"
        rx="8"
        fill="#0a1d19"
        opacity=".5"
        transform="translate(9 9)"
      />
      {moat > 0 && (
        <>
          <rect
            x={210 - moat}
            y={105 - moat * 0.6}
            width={300 + moat * 2}
            height={220 + moat * 1.2}
            rx="25"
            fill="none"
            stroke="#172f2c"
            strokeWidth={moat + 5}
          />
          <rect
            x={210 - moat}
            y={105 - moat * 0.6}
            width={300 + moat * 2}
            height={220 + moat * 1.2}
            rx="25"
            fill="none"
            stroke={`url(#${id}-water)`}
            strokeWidth={moat}
          />
          <path
            d={`M240 ${105 - moat * 0.6}h70m80 0h80M${210 - moat} 155v28m0 40v22M${510 + moat} 160v34m0 45v30`}
            stroke="#b8d5bd"
            strokeWidth="1"
            opacity=".35"
            fill="none"
          />
        </>
      )}
      <rect
        x="210"
        y="105"
        width="300"
        height="220"
        fill={`url(#${id}-pave)`}
        stroke={`url(#${id}-stone)`}
        strokeWidth="16"
      />
      <path
        d="M222 118H498V313"
        fill="none"
        stroke="#20372e"
        strokeWidth="7"
        opacity=".5"
      />
      {Array.from({ length: 15 }, (_, i) => (
        <g key={i}>
          <rect
            x={210 + i * 20 + 2}
            y="96"
            width="9"
            height="22"
            fill="#5a6355"
            opacity=".5"
          />
          <rect
            x={210 + i * 20}
            y="94"
            width="9"
            height="20"
            fill={`url(#${id}-tower)`}
          />
          <rect
            x={210 + i * 20}
            y="314"
            width="9"
            height="22"
            fill={`url(#${id}-tower)`}
          />
        </g>
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i}>
          <rect
            x="199"
            y={115 + i * 20}
            width="22"
            height="9"
            fill={`url(#${id}-tower)`}
          />
          <rect
            x="499"
            y={115 + i * 20}
            width="22"
            height="9"
            fill={`url(#${id}-tower)`}
          />
        </g>
      ))}
      {towers &&
        [
          [210, 105],
          [510, 105],
          [210, 325],
          [510, 325],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            {sight && (
              <>
                <path
                  d={`M${x} ${y}l${x < 300 ? 80 : -80} 0 0 ${y < 200 ? -45 : 45}Z`}
                  fill="#f2d78b"
                  opacity=".2"
                />
                <path
                  d={`M${x} ${y}l0 ${y < 200 ? 80 : -80} ${x < 300 ? -45 : 45} 0Z`}
                  fill="#f2d78b"
                  opacity=".2"
                />
              </>
            )}
            <circle cx={x + 5} cy={y + 6} r="24" fill="#10261f" opacity=".5" />
            <circle
              cx={x}
              cy={y}
              r="23"
              fill={`url(#${id}-tower)`}
              stroke="#dcd7ba"
              strokeWidth="2"
            />
            <circle
              cx={x}
              cy={y}
              r="14"
              fill={`url(#${id}-stone)`}
              stroke="#687260"
              strokeWidth="2"
            />
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return (
                <rect
                  key={i}
                  x={x + Math.cos(a) * 20 - 3}
                  y={y + Math.sin(a) * 20 - 3}
                  width="6"
                  height="6"
                  fill="#e0d8b9"
                  transform={`rotate(${i * 45} ${x + Math.cos(a) * 20} ${y + Math.sin(a) * 20})`}
                />
              );
            })}
            <circle cx={x} cy={y} r="5" fill="#526251" />
          </g>
        ))}
      {inner && (
        <>
          <rect
            x="270"
            y="145"
            width="180"
            height="120"
            rx="3"
            fill="none"
            stroke="#243b2e"
            strokeWidth="11"
            transform="translate(3 4)"
          />
          <rect
            x="270"
            y="145"
            width="180"
            height="120"
            rx="3"
            fill="none"
            stroke={`url(#${id}-stone)`}
            strokeWidth="7"
          />
        </>
      )}
      <path
        d="M327 324v-70h-3"
        fill="none"
        stroke="#b6ab87"
        strokeWidth="12"
        opacity=".45"
      />
      <rect
        x="290"
        y="162"
        width="73"
        height="59"
        fill="#293c2d"
        opacity=".6"
        transform="translate(5 7)"
      />
      <rect x="286" y="156" width="76" height="60" fill={`url(#${id}-roof)`} />
      <path
        d="M286 156l38 30 38-30M324 186v30"
        fill="none"
        stroke="#dca883"
        strokeWidth="2"
      />
      <path d="M324 186l38-30v60h-38Z" fill="#2b1e1a" opacity=".22" />
      <rect
        x="300"
        y="165"
        width="9"
        height="12"
        fill="#716c5d"
        stroke="#c0b69a"
      />
      <text x="324" y="238" textAnchor="middle" className="dl-svg-small">
        great hall · home
      </text>
      <rect
        x="380"
        y="178"
        width="50"
        height="42"
        fill="#293c2d"
        transform="translate(4 6)"
      />
      <rect x="376" y="174" width="50" height="42" fill={`url(#${id}-roof)`} />
      <path d="M401 174v42" stroke="#dcc29b" strokeWidth="2" />
      <text x="401" y="238" textAnchor="middle" className="dl-svg-small">
        stores
      </text>
      <rect
        x="337"
        y="313"
        width="46"
        height="64"
        fill="#382f24"
        transform="translate(3 4)"
      />
      <rect x="337" y="313" width="46" height="63" fill="#a5895d" />
      {Array.from({ length: 10 }, (_, i) => (
        <path
          key={i}
          d={`M338 ${315 + i * 6}h44`}
          stroke="#584b35"
          strokeWidth="1"
        />
      ))}
      <path d="M339 315v61M381 315v61" stroke="#d6be8b" strokeWidth="3" />
      <rect x="328" y="300" width="20" height="40" fill={`url(#${id}-stone)`} />
      <rect x="372" y="300" width="20" height="40" fill={`url(#${id}-stone)`} />
      <rect x="348" y="310" width="24" height="18" fill="#182b23" />
      {gate ? (
        <g>
          <rect x="348" y="317" width="24" height="9" fill="#654b30" />
          {[350, 357, 364, 371].map((x) => (
            <line
              key={x}
              x1={x}
              y1="313"
              x2={x}
              y2="331"
              stroke="#d2b380"
              strokeWidth="2"
            />
          ))}
          <path d="M348 318h24M348 324h24" stroke="#2d231a" strokeWidth="2" />
        </g>
      ) : (
        <path d="M348 310v19M372 310v19" stroke="#c3b28d" strokeWidth="2" />
      )}
      {approach === "bridge" ? (
        <path
          d={`M360 402V${gate ? 340 : 246}`}
          stroke="#ffe7a1"
          strokeWidth="3"
          fill="none"
          strokeDasharray="7 5"
        />
      ) : (
        <path
          d={`M360 50V${moat > 0 ? 75 : 115}`}
          stroke="#ffe7a1"
          strokeWidth="3"
          fill="none"
          strokeDasharray="7 5"
        />
      )}
      <text x="30" y="395" className="dl-svg-small">
        PLAN VIEW · light from upper left · schematic terrain
      </text>
    </g>
  );
}
