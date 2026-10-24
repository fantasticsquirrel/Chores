import { useId } from "react";
import { sectorPath } from "./mathLifeGeometry";
export function FractionPizza({
  x,
  numerator,
  denominator,
  selected,
  label,
}: {
  x: number;
  numerator: number;
  denominator: number;
  selected: boolean;
  label: string;
}) {
  const id = useId();
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-crust`}>
          <stop stopColor="#e8b465" />
          <stop offset=".85" stopColor="#b9662d" />
          <stop offset="1" stopColor="#774025" />
        </radialGradient>
        <radialGradient id={`${id}-cheese`}>
          <stop stopColor="#ffdc83" />
          <stop offset="1" stopColor="#efb74b" />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy="246" rx="127" ry="21" fill="#050a12" opacity=".4" />
      <circle
        cx={x}
        cy="187"
        r="126"
        fill="#244a54"
        stroke={selected ? "#a3e5df" : "#63858d"}
        strokeWidth={selected ? 3 : 1}
      />
      <circle cx={x} cy="187" r="117" fill="#142e38" stroke="#57737d" />
      <circle cx={x} cy="187" r="106" fill={`url(#${id}-crust)`} />
      {Array.from({ length: denominator }, (_, i) => {
        const start = -90 + (i * 360) / denominator,
          end = start + 360 / denominator;
        const middle = (((start + end) / 2) * Math.PI) / 180;
        const active = i < numerator;
        return (
          <g key={i}>
            <path
              d={sectorPath(x, 187, 98, start, end)}
              fill={active ? `url(#${id}-cheese)` : "#433c34"}
              stroke="#795333"
              strokeWidth="1.5"
            />
            {active && (
              <g>
                <circle
                  cx={x + Math.cos(middle) * 66}
                  cy={187 + Math.sin(middle) * 66}
                  r={Math.min(11, 75 / denominator)}
                  fill="#ba5136"
                  stroke="#e98454"
                />
                <path
                  d={`M${x + Math.cos(middle) * 39 - 3} ${187 + Math.sin(middle) * 39}q9-8 13-1q-7 7-13 1`}
                  fill="#668d4a"
                />
                <circle
                  cx={x + Math.cos(middle + 0.08) * 85}
                  cy={187 + Math.sin(middle + 0.08) * 85}
                  r="2"
                  fill="#a47b31"
                />
              </g>
            )}
          </g>
        );
      })}
      <text
        x={x}
        y="343"
        textAnchor="middle"
        style={{ fontSize: 25, fontWeight: 700 }}
      >
        {numerator}/{denominator}
      </text>
      <text x={x} y="368" textAnchor="middle" className="dl-svg-small">
        {label} · same-size whole
      </text>
    </g>
  );
}
