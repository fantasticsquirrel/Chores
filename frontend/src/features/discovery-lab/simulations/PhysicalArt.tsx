import { useId } from "react";
export function BotanicalLeaf() {
  const id = useId();
  const outline = "M245 280C190 140 335 75 495 115C490 260 360 345 245 280Z";
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#9fca70" />
          <stop offset=".35" stopColor="#3a8b5d" />
          <stop offset=".7" stopColor="#1f674b" />
          <stop offset="1" stopColor="#104332" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={outline} />
        </clipPath>
        <pattern
          id={`${id}-cells`}
          width="24"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 10L6 0h12l6 10-6 10H6Z"
            fill="none"
            stroke="#9bdb94"
            strokeWidth=".7"
            opacity=".25"
          />
          <ellipse cx="10" cy="8" rx="2" ry="1" fill="#b4dd7f" opacity=".3" />
        </pattern>
      </defs>
      <path
        d={outline}
        fill="#071f19"
        transform="translate(5 8)"
        opacity=".6"
      />
      <path
        d={outline}
        fill={`url(#${id}-leaf)`}
        stroke="#9acb87"
        strokeWidth="1.5"
      />
      <g clipPath={`url(#${id}-clip)`}>
        <rect
          x="200"
          y="90"
          width="310"
          height="230"
          fill={`url(#${id}-cells)`}
        />
        <path
          d="M245 280Q345 230 470 133"
          fill="none"
          stroke="#143e2c"
          strokeWidth="9"
          opacity=".3"
        />
        <path
          d="M245 280Q345 230 470 133"
          fill="none"
          stroke="#b7d492"
          strokeWidth="3"
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <path
              d={`M${275 + i * 35} ${261 - i * 25}q-26-16-30-55M${275 + i * 35} ${261 - i * 25}q38 12 67-3`}
              fill="none"
              stroke="#a0cd86"
              strokeWidth="1.4"
            />
            {[0, 1, 2].map((j) => (
              <path
                key={j}
                d={`M${265 + i * 35 - j * 5} ${246 - i * 25 - j * 12}l-18-3M${291 + i * 35 + j * 12} ${260 - i * 25 - j}l12-12`}
                stroke="#8fc581"
                strokeWidth=".65"
                fill="none"
                opacity=".7"
              />
            ))}
          </g>
        ))}
      </g>
      <path d="M230 305L245 280" stroke="#335f36" strokeWidth="9" />
      <path d="M230 303L245 278" stroke="#a3c67d" strokeWidth="3" />
    </g>
  );
}
export function GlassMedium() {
  const id = useId();
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-glass`} x2="0" y2="1">
          <stop stopColor="#99e3ec" stopOpacity=".3" />
          <stop offset=".08" stopColor="#4d9eba" stopOpacity=".24" />
          <stop offset="1" stopColor="#113a60" stopOpacity=".45" />
        </linearGradient>
      </defs>
      <path d="M1 210H719V400H1Z" fill={`url(#${id}-glass)`} />
      <path
        d="M1 213H719M1 218H719"
        stroke="#b7f4ef"
        strokeWidth=".7"
        opacity=".35"
      />
      <path
        d="M45 230l100 165M62 230l100 165M600 230l90 145"
        stroke="#b7f4ef"
        strokeWidth="12"
        opacity=".035"
      />
    </g>
  );
}
export function Chamber({ x }: { x: number }) {
  const id = useId();
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-tube`}>
          <stop stopColor="#5b7c9f" stopOpacity=".5" />
          <stop offset=".15" stopColor="#25405b" stopOpacity=".6" />
          <stop offset=".55" stopColor="#101e34" />
          <stop offset="1" stopColor="#52708a" stopOpacity=".6" />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x2="0" y2="1">
          <stop stopColor="#c4cfcd" />
          <stop offset=".3" stopColor="#607582" />
          <stop offset=".6" stopColor="#98a6aa" />
          <stop offset="1" stopColor="#334857" />
        </linearGradient>
      </defs>
      <rect
        x={x - 75}
        y="73"
        width="150"
        height="290"
        rx="18"
        fill="#050d1c"
        opacity=".6"
      />
      <rect
        x={x - 70}
        y="70"
        width="140"
        height="290"
        rx="18"
        fill={`url(#${id}-tube)`}
        stroke="#607b96"
      />
      <rect
        x={x - 70}
        y="70"
        width="140"
        height="15"
        rx="5"
        fill={`url(#${id}-metal)`}
      />
      <rect
        x={x - 75}
        y="344"
        width="150"
        height="17"
        rx="4"
        fill={`url(#${id}-metal)`}
      />
      <path
        d={`M${x - 52} 92v240M${x + 58} 95v240`}
        stroke="#a4d3e0"
        strokeWidth="2"
        opacity=".25"
      />
      {[-60, 60].map((dx) => (
        <circle key={dx} cx={x + dx} cy="77" r="2" fill="#182d3b" />
      ))}
    </g>
  );
}
