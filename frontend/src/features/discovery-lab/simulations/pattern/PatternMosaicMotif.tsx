import {
  PATTERN_MARKER,
  rigidTransformPoint,
} from "@family-manager/family-api/discovery-models/patterns";

export function MosaicMotif({
  rotation = 0,
  mirror = false,
  x = 0,
  y = 0,
  size = 1,
}: {
  rotation?: number;
  mirror?: boolean;
  x?: number;
  y?: number;
  size?: number;
}) {
  const marker = rigidTransformPoint(PATTERN_MARKER, {
    rotationDegreesClockwise: rotation,
    reflectAcrossVertical: mirror,
  })!;
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <g
        transform={`rotate(${rotation}) scale(${mirror ? -1 : 1} 1)`}
        stroke="#f0e4ca"
        strokeWidth="1.4"
        strokeLinejoin="round"
      >
        <path
          d="M-42-42H42V42H-42Z"
          fill="#e2d7ba"
          stroke="#8b8065"
          strokeWidth="2"
        />
        <path d="M-39-39H39L0 0Z" fill="#315c5d" />
        <path d="M39-39V39L0 0Z" fill="#c4934d" />
        <path d="M39 39H-39L0 0Z" fill="#698c83" />
        <path d="M-39 39V-39L0 0Z" fill="#81a4a0" />
        <path d="M0-32L20 7L6 4L-13 29L-10 1L-28-8Z" fill="#f2dfb0" />
        <path
          d="M0-32L6 4L-13 29"
          fill="none"
          stroke="#a46f3f"
          strokeWidth="2"
        />
        <circle cx="28" cy="26" r="3" fill="#2a5d57" />
      </g>
      <circle
        cx={marker.x}
        cy={marker.y}
        r="7"
        fill="#ba5a3f"
        stroke="#fff0bf"
      />
      <text
        x={marker.x}
        y={marker.y + 2.5}
        textAnchor="middle"
        fill="#fffdf1"
        stroke="none"
        fontSize="7"
        fontFamily="system-ui"
        fontWeight="700"
      >
        M
      </text>
    </g>
  );
}
