import type {
  bridge,
  BridgeMaterial,
} from "@family-manager/family-api/discovery-models/physical-world";

export function BridgeDrawing({
  material,
  braces,
  load,
  position,
  result,
}: {
  material: BridgeMaterial;
  braces: boolean[];
  load: number;
  position: number;
  result: ReturnType<typeof bridge>;
}) {
  const loadX = 100 + position * 5.2;
  const colors = result.utilization.map((u) =>
    u > 1 ? "#fc9b8a" : u > 0.7 ? "#ffdd91" : "#8ee0c4",
  );
  const materialColor = material === "steel" ? "#aac3d7" : "#c89b62";
  return (
    <>
      <text x="30" y="34" className="dl-world-caption">
        BRIDGE / FOLLOW THE LOAD
      </text>
      <path
        d="M0 123L50 88L119 142L175 115L270 176L400 111L506 160L607 96L720 139V265H0Z"
        fill="#527161"
        opacity=".5"
      />
      <path
        d="M0 204H90L129 253L191 306H525L596 245L630 204H720V330H0Z"
        fill="#8c8065"
      />
      <path
        d="M0 232L91 225L123 271L175 316H535L602 259L633 228H720V330H0Z"
        fill="#675e50"
      />
      <path d="M209 275Q370 247 518 286L567 328H166Z" fill="#388ca0" />
      <path
        d="M239 285Q342 270 479 291M213 308Q371 287 532 315"
        fill="none"
        stroke="#9dd4d4"
        opacity=".5"
        strokeWidth="2"
      />
      {[100, 620].map((x) => (
        <g key={x}>
          <rect
            x={x - 17}
            y="196"
            width="34"
            height="64"
            rx="2"
            fill="#a8b6ae"
          />
          <path
            d={`M${x - 14} 215H${x + 14}M${x - 14} 237H${x + 14}`}
            stroke="#627c7e"
          />
          <path d={`M${x - 13} 199L${x} 184L${x + 13} 199Z`} fill="#dfd7b4" />
        </g>
      ))}
      {braces.map((on, i) => (
        <g key={i}>
          <path
            d={`M${100 + i * 130} 186V119H${230 + i * 130}V186`}
            stroke={materialColor}
            strokeWidth="7"
            fill="none"
          />
          {on && (
            <path
              d={`M${100 + i * 130} 186L${230 + i * 130} 119`}
              stroke={materialColor}
              strokeWidth="8"
            />
          )}
          <path
            d={`M${100 + i * 130} 190H${230 + i * 130}`}
            stroke={colors[i]}
            strokeWidth="13"
          />
          {[100 + i * 130, 230 + i * 130].map((x) => (
            <circle
              key={x}
              cx={x}
              cy="119"
              r="5"
              fill="#e8e7d0"
              stroke="#627687"
            />
          ))}
          <text x={165 + i * 130} y="218" textAnchor="middle">
            {i + 1} · {Math.round(result.utilization[i] * 100)}%
          </text>
        </g>
      ))}
      <g transform={`translate(${loadX} 183)`}>
        <rect x="-29" y="-32" width="41" height="23" rx="4" fill="#f4be77" />
        <path d="M12-26H29L39-14V-5H12Z" fill="#d98d55" />
        <path d="M18-23H27L34-15H18Z" fill="#aecfda" />
        <path d="M-33-6H42" stroke="#263b48" strokeWidth="7" />
        <circle cx="-19" cy="-4" r="7" fill="#172f3d" />
        <circle cx="28" cy="-4" r="7" fill="#172f3d" />
        <path
          d="M0-82V-47m-6-8l6 8 6-8"
          stroke="#ffe0a0"
          strokeWidth="3"
          fill="none"
        />
        <text x="0" y="-90" textAnchor="middle">
          {load} kN
        </text>
      </g>
      {[
        { x: 100, force: result.leftReaction },
        { x: 620, force: result.rightReaction },
      ].map(({ x, force }) => (
        <g key={x}>
          <path
            d={`M${x} 302V${302 - force * 2}m-6 8l6-8 6 8`}
            stroke="#a5ead4"
            fill="none"
            strokeWidth="3"
          />
          <text x={x} y="320" textAnchor="middle" className="dl-svg-small">
            {force.toFixed(1)} kN ↑
          </text>
        </g>
      ))}
      <rect
        x="30"
        y="338"
        width="660"
        height="62"
        rx="10"
        fill="#0c2227"
        stroke="#466663"
      />
      <text x="45" y="358" className="dl-world-caption">
        BENDING MOMENT
      </text>
      <path
        d={`M230 354L${230 + position * 4.2} ${354 + Math.min(30, result.maxMoment * 0.4)}L650 354Z`}
        fill="#d3c58a"
        opacity=".6"
      />
      <path d="M230 354H650" stroke="#749b9c" />
      <text x="45" y="383" className="dl-svg-small">
        Peak {result.maxMoment.toFixed(1)} kN·m
      </text>
      <text x="440" y="391" className="dl-svg-small" textAnchor="middle">
        10 m span · strongest bending under the load
      </text>
    </>
  );
}
