/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment, useId } from "../space-life-support/vector-author";
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
