/** Deterministic topic thumbnails; all model controls live on the lesson page. */
export function ExtendedArtwork({ id }: { id: string }) {
  const gold = "#f7cc85",
    teal = "#8cdcc8",
    blue = "#8bbfdf";
  if (id === "sound-playground")
    return (
      <g>
        <path
          d="M45 150V60h20v90m230 0V60h20v90"
          stroke="#98a6b4"
          strokeWidth="7"
        />
        <path
          d="M55 104Q86 34 117 104T179 104T241 104T303 104"
          fill="none"
          stroke={gold}
          strokeWidth="4"
        />
        <path d="M45 153h270v22H45z" fill="#694e3d" />
        <path d="M60 160h240" stroke="#ac8866" />
        {[100, 180, 260].map((x) => (
          <path
            key={x}
            d={`M${x} 55v100`}
            stroke={teal}
            opacity=".25"
            strokeDasharray="4 5"
          />
        ))}
      </g>
    );
  if (id === "bridge-builder")
    return (
      <g>
        <path d="M0 158q90-26 180 0t180 0v52H0" fill="#285c74" />
        <path
          d="M30 145V95h300v50M30 95l60 50 60-50 60 50 60-50 60 50M30 145h300"
          fill="none"
          stroke={teal}
          strokeWidth="6"
        />
        <path d="M18 145h30v65H18m294-65h30v65h-30" fill="#87969a" />
        <rect x="142" y="66" width="56" height="22" rx="5" fill={gold} />
        <circle cx="152" cy="90" r="7" fill="#122232" />
        <circle cx="186" cy="90" r="7" fill="#122232" />
      </g>
    );
  if (id === "river-sculptor")
    return (
      <g>
        <path d="M0 95 85 25l90 60 90-45 95 50v120H0" fill="#486a58" />
        <path
          d="M145 60c140 20-125 60 20 83s40 40-40 67"
          stroke="#88cddd"
          strokeWidth="24"
          fill="none"
        />
        <path
          d="M147 66c120 17-105 55 20 77s40 40-40 67"
          stroke="#4d99b6"
          strokeWidth="9"
          fill="none"
        />
        {[40, 78, 260, 300].map((x, i) => (
          <g key={x}>
            <path
              d={`M${x} ${125 + (i % 2) * 24}v35`}
              stroke="#8c7350"
              strokeWidth="4"
            />
            <path
              d={`m${x - 16} ${138 + (i % 2) * 24} 16-36 16 36Z`}
              fill={teal}
            />
          </g>
        ))}
      </g>
    );
  if (id === "circuit-city")
    return (
      <g>
        <path
          d="M40 172V55h270v117H40m75-117v117m80-117v117"
          fill="none"
          stroke={gold}
          strokeWidth="3"
        />
        {[115, 195, 275].map((x) => (
          <g key={x}>
            <path
              d={`m${x - 25} 104 25-26 25 26v41h-50Z`}
              fill="#446478"
              stroke={blue}
            />
            <rect x={x - 7} y="110" width="14" height="18" fill={gold} />
          </g>
        ))}
        <path d="M25 92h30m-23 12h16" stroke={teal} strokeWidth="5" />
      </g>
    );
  if (id === "food-web-rescue")
    return (
      <g>
        <ellipse
          cx="180"
          cy="115"
          rx="148"
          ry="72"
          fill="#29565f"
          stroke="#5e9e90"
          strokeWidth="7"
        />
        {[65, 88, 285].map((x) => (
          <path
            key={x}
            d={`M${x} 164q-16-30 5-66m-5 45-17-19`}
            stroke={teal}
            strokeWidth="5"
            fill="none"
          />
        ))}
        <path d="M143 112q35-34 70 0-35 34-70 0l-23-18v36Z" fill={gold} />
        <circle cx="199" cy="108" r="3" fill="#172b40" />
        {[120, 236, 256].map((x, i) => (
          <circle key={x} cx={x} cy={65 + i * 24} r="5" fill={blue} />
        ))}
      </g>
    );
  if (id === "fraction-feast")
    return (
      <g>
        <ellipse
          cx="180"
          cy="153"
          rx="99"
          ry="23"
          fill="#09111e"
          opacity=".4"
        />
        <circle
          cx="180"
          cy="105"
          r="77"
          fill="#d69a57"
          stroke="#eed0a0"
          strokeWidth="8"
        />
        <circle cx="180" cy="105" r="67" fill={gold} />
        {[0, 60, 120].map((a) => (
          <path
            key={a}
            d="M104 105h152"
            transform={`rotate(${a} 180 105)`}
            stroke="#a25f43"
            strokeWidth="3"
          />
        ))}
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <circle
            key={a}
            cx="219"
            cy="127"
            r="9"
            fill="#ba6956"
            transform={`rotate(${a} 180 105)`}
          />
        ))}
      </g>
    );
  if (id === "pattern-palace")
    return (
      <g>
        {[0, 1, 2].flatMap((row) =>
          [0, 1, 2, 3, 4].map((col) => (
            <g
              key={`${row}-${col}`}
              transform={`translate(${48 + col * 54} ${36 + row * 54})`}
            >
              <path
                d="M0 0h52v52H0z"
                fill={(row + col) % 2 ? "#345d73" : "#6aa99e"}
                stroke="#162c43"
              />
              <path
                d="m5 5 42 0-21 42Z"
                fill={gold}
                transform={`rotate(${(row + col) * 90} 26 26)`}
              />
            </g>
          )),
        )}
      </g>
    );
  if (id === "caravan-crossroads")
    return (
      <g>
        <path d="m0 136 70-84 68 72 65-95 80 89 77-45v137H0" fill="#74624f" />
        <path
          d="M35 178Q95 70 180 145T325 70"
          stroke={gold}
          strokeWidth="4"
          strokeDasharray="6 6"
          fill="none"
        />
        {[42, 180, 310].map((x, i) => (
          <g key={x} transform={`translate(${x} ${148 - i * 28})`}>
            <rect width="24" height="20" fill="#d4b18c" />
            <path d="m-3 0 15-15 15 15" fill="#b66c59" />
          </g>
        ))}
      </g>
    );
  if (id === "pollinator-express")
    return (
      <g>
        {[75, 180, 285].map((x, i) => (
          <g key={x}>
            <path d={`M${x} 175v-65`} stroke={teal} strokeWidth="4" />
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse
                key={a}
                cx={x}
                cy={89 - (i % 2) * 20}
                rx="10"
                ry="19"
                fill={i % 2 ? "#ad9bdb" : "#e1a3b7"}
                transform={`rotate(${a} ${x} ${108 - (i % 2) * 20})`}
              />
            ))}
            <circle cx={x} cy={108 - (i % 2) * 20} r="11" fill={gold} />
          </g>
        ))}
        <ellipse cx="233" cy="54" rx="16" ry="10" fill={gold} />
        <path d="M230 45v18m8-18v18" stroke="#283344" strokeWidth="4" />
        <ellipse cx="225" cy="42" rx="7" ry="11" fill={blue} opacity=".8" />
      </g>
    );
  if (id === "chance-carnival")
    return (
      <g>
        <circle cx="133" cy="110" r="72" fill={teal} />
        <path d="M133 38a72 72 0 0 1 72 72h-72Z" fill={gold} />
        <path d="M133 110h72a72 72 0 0 1-72 72Z" fill="#b7a0df" />
        <path
          d="M133 110 175 68m-10 3 10-3-3 10"
          stroke="#15364b"
          strokeWidth="5"
          fill="none"
        />
        <circle cx="133" cy="110" r="7" fill="#f5eedf" />
        <rect x="237" y="80" width="69" height="69" rx="13" fill="#e9e5d9" />
        {[
          [250, 93],
          [293, 93],
          [271, 114],
          [250, 136],
          [293, 136],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#29435a" />
        ))}
      </g>
    );
  return null;
}
