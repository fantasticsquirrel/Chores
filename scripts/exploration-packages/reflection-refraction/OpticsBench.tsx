/** @jsx h */
/** @jsxFrag Fragment */
import {
  h,
  Fragment,
  useId,
  useRef,
} from "../space-life-support/vector-author";
import { refract } from "./physics";
/** Top-down instrument view deliberately preserves measurable ray angles. */
export function OpticsBench({
  angle,
  n1,
  n2,
  onAngle,
}: {
  angle: number;
  n1: number;
  n2: number;
  onAngle: (angle: number) => void;
}) {
  const uid = useId().replace(/:/g, ""),
    dragging = useRef(false);
  const reflects = Math.abs(n1 - n2) > 1e-9;
  const result = refract(angle, n1, n2),
    theta = (angle * Math.PI) / 180,
    bend = ((result.angle ?? 0) * Math.PI) / 180;
  const cx = 420,
    cy = 310,
    r = 208,
    sx = cx - Math.sin(theta) * r,
    sy = cy - Math.cos(theta) * r;
  const reflected = {
      x: cx + Math.sin(theta) * 192,
      y: cy - Math.cos(theta) * 192,
    },
    transmitted = {
      x: cx + Math.sin(bend) * 192,
      y: cy + Math.cos(bend) * 192,
    };
  return (
    <svg
      className="optics-bench"
      viewBox="0 0 840 620"
      role="img"
      aria-label={`Optical bench. Incident and reflection angle ${angle} degrees from the normal. ${result.tir ? "Total internal reflection; no transmitted ray." : `Transmitted angle ${result.angle?.toFixed(1)} degrees.`}`}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        const box = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width) * 840,
          y = ((event.clientY - box.top) / box.height) * 620;
        onAngle(
          Math.round(
            Math.min(
              80,
              Math.max(0, (Math.atan2(cx - x, cy - y) * 180) / Math.PI),
            ),
          ),
        );
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <defs>
        <radialGradient id={`${uid}-table`}>
          <stop stopColor="#213a3e" />
          <stop offset="1" stopColor="#0c171e" />
        </radialGradient>
        <linearGradient id={`${uid}-metal`} x2=".8" y2="1">
          <stop stopColor="#e4e7df" />
          <stop offset=".25" stopColor="#798990" />
          <stop offset=".48" stopColor="#d8ddd7" />
          <stop offset=".72" stopColor="#89969a" />
          <stop offset="1" stopColor="#42545d" />
        </linearGradient>
        <radialGradient id={`${uid}-face`}>
          <stop stopColor="#334a50" />
          <stop offset=".7" stopColor="#20333c" />
          <stop offset="1" stopColor="#162631" />
        </radialGradient>
        <linearGradient id={`${uid}-glass`} x2=".2" y2="1">
          <stop stopColor="#8ce3dc" stopOpacity=".24" />
          <stop offset=".48" stopColor="#80c3ce" stopOpacity=".12" />
          <stop offset="1" stopColor="#c5eef0" stopOpacity=".35" />
        </linearGradient>
        <linearGradient id={`${uid}-laser`} x2="0" y2="1">
          <stop stopColor="#273b43" />
          <stop offset=".25" stopColor="#a7b4b4" />
          <stop offset=".48" stopColor="#ecede2" />
          <stop offset=".7" stopColor="#7f9197" />
          <stop offset="1" stopColor="#2a414a" />
        </linearGradient>
        <pattern
          id={`${uid}-holes`}
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="14" cy="14" r="1.6" fill="#0a141a" />
          <circle cx="14" cy="15" r="1.1" fill="#54666a" opacity=".3" />
        </pattern>
      </defs>
      <rect width="840" height="620" rx="20" fill={`url(#${uid}-table)`} />
      <rect
        x="16"
        y="16"
        width="808"
        height="588"
        rx="14"
        fill={`url(#${uid}-holes)`}
        stroke="#526468"
        strokeOpacity=".35"
      />
      <ellipse
        cx={cx + 3}
        cy={cy + 20}
        rx="254"
        ry="252"
        fill="#050b10"
        opacity=".65"
      />
      <circle cx={cx} cy={cy} r="253" fill={`url(#${uid}-metal)`} />
      <circle
        cx={cx}
        cy={cy}
        r="243"
        fill="#142630"
        stroke="#829296"
        strokeWidth="2"
      />
      <circle
        cx={cx}
        cy={cy}
        r="228"
        fill={`url(#${uid}-face)`}
        stroke="#60777d"
      />
      {Array.from({ length: 72 }, (_, i) => {
        const a = (i * 5 * Math.PI) / 180,
          inner = i % 3 ? 233 : 225;
        return (
          <line
            key={i}
            x1={cx + Math.sin(a) * inner}
            y1={cy - Math.cos(a) * inner}
            x2={cx + Math.sin(a) * 240}
            y2={cy - Math.cos(a) * 240}
            stroke={i % 3 ? "#71868c" : "#cad6d0"}
            strokeWidth={i % 3 ? 1 : 1.5}
          />
        );
      })}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
        <text
          key={a}
          x={cx + Math.sin((a * Math.PI) / 180) * 211}
          y={cy - Math.cos((a * Math.PI) / 180) * 211 + 4}
          fill="#cad4d1"
          textAnchor="middle"
          fontSize="25"
        >
          {Math.min(a % 180, 180 - (a % 180))}°
        </text>
      ))}
      <path
        d={`M${cx - 195} ${cy + 8}h390a195 195 0 0 1-390 0`}
        fill="#31576a"
        stroke="#80b9c5"
        strokeOpacity=".5"
      />
      <path
        d={`M${cx - 195} ${cy}h390a195 195 0 0 1-390 0`}
        fill={`url(#${uid}-glass)`}
        stroke="#b4eeee"
        strokeWidth="1.5"
      />
      <path
        d={`M${cx - 182} ${cy + 10}a182 182 0 0 0 364 0`}
        fill="none"
        stroke="#c4f4ee"
        strokeOpacity=".3"
        strokeWidth="2"
      />
      <path
        d={`M${cx} 105V515`}
        stroke="#b3c1c4"
        strokeDasharray="5 7"
        opacity=".6"
      />
      <text x="440" y="145" fill="#bcced0" fontSize="27">
        normal
      </text>
      <path
        d={`M${sx} ${sy}L${cx} ${cy}${reflects ? `L${reflected.x} ${reflected.y}` : ""}`}
        fill="none"
        stroke="#ffd18f"
        strokeWidth="13"
        opacity=".08"
      />
      <path d={`M${sx} ${sy}L${cx} ${cy}`} stroke="#ffcb73" strokeWidth="3" />
      {reflects && (
        <path
          data-testid="reflected-ray"
          d={`M${cx} ${cy}L${reflected.x} ${reflected.y}`}
          stroke="#f1aaac"
          strokeWidth={result.tir ? 3 : 2}
          opacity={result.tir ? 1 : 0.8}
        />
      )}
      {!result.tir && (
        <>
          <path
            d={`M${cx} ${cy}L${transmitted.x} ${transmitted.y}`}
            stroke="#9df6e1"
            strokeWidth="14"
            opacity=".1"
          />
          <path
            d={`M${cx} ${cy}L${transmitted.x} ${transmitted.y}`}
            stroke="#a8f9df"
            strokeWidth="3"
          />
        </>
      )}
      <circle cx={cx} cy={cy} r="9" fill="#ffe0a6" opacity=".15" />
      <circle cx={cx} cy={cy} r="3" fill="#fff5d8" />
      <g
        transform={`translate(${sx} ${sy}) rotate(${-angle})`}
        style={{ cursor: "grab" }}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.ownerSVGElement?.setPointerCapture(
            event.pointerId,
          );
        }}
      >
        <rect
          x="-21"
          y="-57"
          width="42"
          height="61"
          rx="8"
          fill="#071118"
          opacity=".5"
          transform="translate(3 5)"
        />
        <rect
          x="-20"
          y="-58"
          width="40"
          height="58"
          rx="7"
          fill={`url(#${uid}-laser)`}
          stroke="#a9b7b7"
        />
        {[-46, -39, -32].map((y) => (
          <path key={y} d={`M-18 ${y}h36`} stroke="#30474e" strokeWidth="2" />
        ))}
        <rect
          x="-13"
          y="-15"
          width="26"
          height="18"
          rx="3"
          fill="#18252b"
          stroke="#8d9da1"
        />
        <rect x="-4" y="0" width="8" height="5" fill="#ffdb8b" />
        <circle cx="0" cy="-23" r="3" fill="#b9ecc7" />
      </g>
      <g fill="#b9cbd0" fontSize="27">
        <text x="32" y="578">
          Drag the laser or adjust the angle below.
        </text>
        <text x="650" y="275">
          n₁ = {n1.toFixed(2)}
        </text>
        <text x="650" y="341">
          n₂ = {n2.toFixed(2)}
        </text>
      </g>
      {[
        [38, 92],
        [802, 92],
        [38, 530],
        [802, 530],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="6" fill={`url(#${uid}-metal)`} />
          <path d={`M${x - 3} ${y}h6`} stroke="#263b43" />
        </g>
      ))}
    </svg>
  );
}
