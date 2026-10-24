export function ExpansionArtwork({ id }: { id: string }) {
  const line = "#a7d9cb",
    warm = "#edc08a",
    pale = "#e6eee0";
  if (id === "machine-workshop")
    return (
      <g strokeLinecap="round">
        <path
          d="M80 175V58h180M80 65l170 48M90 175l35-40M125 135V58"
          stroke={warm}
          strokeWidth="10"
          fill="none"
        />
        <circle
          cx="244"
          cy="80"
          r="22"
          fill="#324b59"
          stroke={pale}
          strokeWidth="6"
        />
        <circle cx="244" cy="80" r="6" fill={warm} />
        <path d="M225 80v67m38-67v93" stroke={line} strokeWidth="3" />
        <rect
          x="198"
          y="145"
          width="55"
          height="38"
          rx="5"
          fill="#99744f"
          stroke={warm}
        />
        <path d="M50 186h245" stroke="#446575" strokeWidth="8" />
      </g>
    );
  if (id === "heat-house")
    return (
      <g stroke={pale} strokeLinejoin="round">
        <path d="M90 95l90-58 90 58v88H90Z" fill="#c6b496" strokeWidth="3" />
        <path
          d="M78 96l102-67 102 67"
          fill="none"
          stroke={warm}
          strokeWidth="12"
        />
        <path
          d="M102 104h17v70h-17m139-70h17v70h-17"
          fill="#d38763"
          stroke="none"
        />
        <rect
          x="139"
          y="109"
          width="70"
          height="50"
          fill="#4f8d9b"
          strokeWidth="4"
        />
        <path d="M174 110v49m-35-25h70" strokeWidth="3" />
        {[50, 180, 300].map((x) => (
          <path
            key={x}
            d={`M${x} 70q-14-12 0-24t0-24`}
            fill="none"
            stroke={line}
            strokeWidth="3"
          />
        ))}
      </g>
    );
  if (id === "pressure-tank")
    return (
      <g>
        <path
          d="M105 44v129q55 23 110 0V44"
          fill="#417a8e"
          stroke={pale}
          strokeWidth="4"
        />
        <ellipse
          cx="160"
          cy="44"
          rx="55"
          ry="15"
          fill="#8dc9c9"
          stroke={pale}
          strokeWidth="3"
        />
        <path
          d="M215 130q65 0 91 64"
          fill="none"
          stroke={line}
          strokeWidth="7"
        />
        <path
          d="M80 45v135m-8-135h16m-16 135h16"
          stroke={warm}
          strokeWidth="3"
        />
        {[65, 85, 105, 125, 145].map((y) => (
          <path key={y} d={`M109 ${y}h12`} stroke={pale} strokeWidth="2" />
        ))}
      </g>
    );
  if (id === "moving-plates")
    return (
      <g strokeLinejoin="round">
        <path d="m40 125 104-40 54 38 119-29v75H40Z" fill="#a36e4e" />
        <path
          d="m40 125 104-40 54 38 119-29v22l-119 30-54-37-104 42Z"
          fill="#7ba18a"
        />
        <path
          d="m145 99 39 50 65 32"
          fill="none"
          stroke={warm}
          strokeWidth="12"
        />
        <path
          d="M61 62h60m-12-11 12 11-12 11M298 60h-60m12-11-12 11 12 11"
          fill="none"
          stroke={line}
          strokeWidth="4"
        />
      </g>
    );
  if (id === "cloud-rain-lab")
    return (
      <g>
        <path d="M73 172l79-96 72 96" fill="#70908b" />
        <path d="m131 103 21-27 22 29-22-6Z" fill={pale} />
        <g fill={pale}>
          <ellipse cx="223" cy="80" rx="70" ry="25" />
          <circle cx="206" cy="58" r="30" />
          <circle cx="248" cy="65" r="25" />
        </g>
        {[205, 230, 255, 280].map((x) => (
          <path
            key={x}
            d={`m${x} 120-8 24`}
            stroke={line}
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}
        <path
          d="M70 144q-20-55 29-88m-15 2 15-2-1 16"
          fill="none"
          stroke={warm}
          strokeWidth="4"
        />
      </g>
    );
  if (id === "magnetic-fields")
    return (
      <g>
        {[30, 48, 66].map((r) => (
          <ellipse
            key={r}
            cx="180"
            cy="104"
            rx={r + 70}
            ry={r}
            fill="none"
            stroke={line}
            opacity=".6"
            strokeWidth="2"
          />
        ))}
        <rect x="95" y="87" width="85" height="35" rx="4" fill="#ca7764" />
        <rect x="180" y="87" width="85" height="35" rx="4" fill="#5d8cba" />
        <text x="125" y="112" fill={pale} fontSize="23">
          N
        </text>
        <text x="220" y="112" fill={pale} fontSize="23">
          S
        </text>
        <circle
          cx="182"
          cy="46"
          r="21"
          fill="#233a43"
          stroke={warm}
          strokeWidth="3"
        />
        <path d="m167 46 15-6 15 6-15 6Z" fill={pale} />
      </g>
    );
  if (id === "cell-explorer")
    return (
      <g>
        <ellipse
          cx="180"
          cy="110"
          rx="113"
          ry="65"
          fill="#548a75"
          stroke={line}
          strokeWidth="7"
        />
        <ellipse cx="180" cy="110" rx="103" ry="55" fill="#acd0a0" />
        <ellipse
          cx="180"
          cy="110"
          rx="46"
          ry="30"
          fill="#5b9aaf"
          opacity=".75"
        />
        <circle cx="120" cy="105" r="22" fill="#bc8a9b" />
        <circle cx="120" cy="105" r="8" fill="#6c506c" />
        {[
          [-60, 32],
          [45, -27],
          [75, 20],
          [-30, -34],
        ].map(([x, y]) => (
          <ellipse
            key={x}
            cx={180 + x}
            cy={110 + y}
            rx="17"
            ry="8"
            fill="#397656"
            stroke={line}
            strokeWidth="2"
          />
        ))}
      </g>
    );
  if (id === "shape-slicer")
    return (
      <g stroke={pale} strokeWidth="3" strokeLinejoin="round">
        <path d="m104 75 76-38 80 43-74 40Z" fill="#6e989f" />
        <path d="m104 75 82 46v69l-82-47Z" fill="#426e80" />
        <path d="m186 121 74-41v69l-74 41Z" fill="#294f68" />
        <path
          d="m66 119 114-56 118 63-113 61Z"
          fill={warm}
          fillOpacity=".55"
          stroke={warm}
        />
        <path
          d="m104 101 76-38 80 43-74 40Z"
          fill="none"
          stroke={line}
          strokeWidth="5"
        />
      </g>
    );
  if (id === "adaptation-island")
    return (
      <g>
        <ellipse cx="180" cy="142" rx="126" ry="49" fill="#5b7862" />
        <path d="m108 121 56-65 37 39 22-19 49 57" fill="#8c8976" />
        {[
          [91, 143, 0],
          [126, 159, 1],
          [165, 146, 0],
          [208, 159, 1],
          [250, 144, 0],
        ].map(([x, y, d]) => (
          <g key={x}>
            <ellipse
              cx={x}
              cy={y}
              rx="12"
              ry="17"
              fill={d ? warm : "#29343d"}
              stroke="#adb9a0"
            />
            <path
              d={`M${x} ${y - 10}v21`}
              stroke={d ? "#9d7954" : "#5c6b71"}
              strokeWidth="2"
            />
          </g>
        ))}
      </g>
    );
  return null;
}
