import type { riverStorm } from "@family-manager/family-api/discovery-models/physical-world";

export function RiverLandscape({
  slope,
  rain,
  vegetation,
  next,
  deposited,
}: {
  slope: number;
  rain: number;
  vegetation: number;
  next: ReturnType<typeof riverStorm>;
  deposited: number;
}) {
  const sourceY = 163 - slope * 2.8;
  const river = `M166 ${sourceY}C335 ${sourceY - 10} 240 217 383 227S477 271 579 290`;
  const runoffShare = next.rainVolume ? next.runoff / next.rainVolume : 0;
  const exportShare = next.eroded ? next.exported / next.eroded : 0;
  return (
    <>
      <text x="30" y="34" className="dl-world-caption">
        RIVER / WATER MOVES THE LAND
      </text>
      <path
        d="M38 228L122 111L201 72L310 148L385 111L530 177L681 219V309H38Z"
        fill="#4d6e58"
      />
      <path
        d={`M55 245L153 ${sourceY - 40}L254 ${sourceY + 7}L353 184L489 218L666 283L600 315H109Z`}
        fill="#a58b62"
      />
      <path
        d={`M55 245L153 ${sourceY - 40}L254 ${sourceY + 7}L353 184L489 218L666 283L600 315H109Z`}
        fill="#5e8d62"
        opacity={vegetation / 125}
      />
      <path
        d="M109 315H600L666 283V309L600 338H109L55 269V245Z"
        fill="#68513f"
      />
      <path d="M110 326H600M65 260L109 316" stroke="#ba9a6e" opacity=".45" />
      {next.floodVolume > 0 && (
        <path
          d={river}
          fill="none"
          stroke="#78bdd2"
          opacity=".24"
          strokeWidth={52 + next.floodVolume / 8}
          strokeLinecap="round"
        />
      )}
      <path
        d={river}
        fill="none"
        stroke="#d7b985"
        strokeWidth={38 + next.eroded / 35}
        strokeLinecap="round"
      />
      <path
        d={river}
        fill="none"
        stroke="#3e9cb4"
        strokeWidth={12 + next.runoff / 25}
        strokeLinecap="round"
      />
      <path
        d={river}
        fill="none"
        stroke="#b7e6e1"
        opacity=".6"
        strokeWidth="2"
        strokeDasharray="13 25"
      />
      {Array.from({ length: Math.round(vegetation / 6) }, (_, i) => {
        const x = 110 + ((i * 97) % 476),
          y = 155 + ((i * 41) % 116);
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M0 0V24" stroke="#694e35" strokeWidth="4" />
            <path
              d="M0-21L-14 6H-9L-18 16H18L9 6H14Z"
              fill={i % 2 ? "#3a654b" : "#739c64"}
            />
            <path d="M0 0L-8 17M0 7L9 17" stroke="#8db57a" opacity=".5" />
          </g>
        );
      })}
      <g
        transform="translate(438 72)"
        fill="#cedfe5"
        opacity={0.3 + rain / 150}
      >
        <ellipse rx="61" ry="19" />
        <circle cx="-23" cy="-15" r="24" />
        <circle cx="12" cy="-21" r="31" />
        <circle cx="43" cy="-7" r="21" />
      </g>
      {Array.from({ length: Math.round(rain / 5) }, (_, i) => (
        <path
          key={i}
          d={`M${380 + ((i * 23) % 120)} ${104 + ((i * 13) % 40)}l-6 10`}
          stroke="#8ccfe3"
          strokeWidth="2"
        />
      ))}
      {Array.from(
        { length: Math.min(32, Math.ceil(deposited / 20)) },
        (_, i) => (
          <circle
            key={i}
            cx={405 + ((i * 31) % 135)}
            cy={238 + ((i * 17) % 54)}
            r={1.5 + (i % 3)}
            fill="#e3c789"
          />
        ),
      )}
      <text x="54" y="69" className="dl-svg-small">
        Slope {slope}% · roots hold soil
      </text>
      <text x="535" y="127" className="dl-svg-small">
        {rain} mm / hour
      </text>
      <path
        d="M589 286l45 15m-10-12l10 12-16 3"
        stroke="#d5e7dc"
        strokeWidth="2"
        fill="none"
      />
      <text x="633" y="278" textAnchor="middle" className="dl-svg-small">
        outlet
      </text>
      <rect
        x="28"
        y="343"
        width="664"
        height="60"
        rx="10"
        fill="#102a2c"
        stroke="#3c625d"
      />
      <text x="42" y="361" className="dl-world-caption">
        NEXT STORM / WATER
      </text>
      <text x="374" y="361" className="dl-world-caption">
        NEXT STORM / MOVED SOIL
      </text>
      <rect x="42" y="370" width="286" height="7" rx="3" fill="#31504b" />
      {rain > 0 && (
        <>
          <rect
            x="42"
            y="370"
            width={286 * (1 - runoffShare)}
            height="7"
            fill="#9ccf8b"
          />
          <rect
            x={42 + 286 * (1 - runoffShare)}
            y="370"
            width={286 * runoffShare}
            height="7"
            fill="#7ccbe2"
          />
        </>
      )}
      <rect x="374" y="370" width="286" height="7" rx="3" fill="#31504b" />
      {next.eroded > 0 && (
        <>
          <rect
            x="374"
            y="370"
            width={286 * (1 - exportShare)}
            height="7"
            fill="#dfc392"
          />
          <rect
            x={374 + 286 * (1 - exportShare)}
            y="370"
            width={286 * exportShare}
            height="7"
            fill="#c19a66"
          />
        </>
      )}
      <text x="42" y="394" className="dl-svg-small">
        Infiltrated {next.infiltration.toFixed(0)} · runoff{" "}
        {next.runoff.toFixed(0)} m³
      </text>
      <text x="374" y="394" className="dl-svg-small">
        Deposited {next.deposited.toFixed(1)} · out {next.exported.toFixed(1)}{" "}
        kg
      </text>
    </>
  );
}
