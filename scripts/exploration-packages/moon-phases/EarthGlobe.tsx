/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment, useId } from "../space-life-support/vector-author";
/** Procedural illustrations, deliberately schematic rather than geographic maps. */
export function EarthGlobe({
  x,
  y,
  r,
  sunlightFromRight = false,
}: {
  x: number;
  y: number;
  r: number;
  sunlightFromRight?: boolean;
}) {
  const id = useId();
  return (
    <g transform={`translate(${x} ${y}) scale(${r / 50})`}>
      <defs>
        <radialGradient
          id={`${id}-ocean`}
          cx={sunlightFromRight ? "80%" : "32%"}
          cy={sunlightFromRight ? "45%" : "25%"}
          r="80%"
        >
          <stop stopColor="#62d7ee" />
          <stop offset=".45" stopColor="#247fb1" />
          <stop offset="1" stopColor="#102643" />
        </radialGradient>
        <radialGradient
          id={`${id}-shade`}
          cx={sunlightFromRight ? "85%" : "30%"}
          cy={sunlightFromRight ? "50%" : "25%"}
          r="75%"
        >
          <stop offset=".45" stopColor="#03132a" stopOpacity="0" />
          <stop offset="1" stopColor="#02091b" stopOpacity=".8" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle r="50" />
        </clipPath>
      </defs>
      <circle r="55" fill="#64c9f6" opacity=".07" />
      <circle r="52" fill="#64c9f6" opacity=".13" />
      <circle r="50" fill={`url(#${id}-ocean)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <path
          d="M-43-26l15-11 15 3 6 12-7 9-13 1-2 11-11-8Z M-19 0l15 6 4 19-8 22-8-7-5-22Z M15-41l20 5 17 20-14 10-13-2-10 17-11-6 4-18 9-10Z M30 28l15-4 13 13-16 7-14-6Z"
          fill="#81b782"
        />
        <path
          d="M-34-18q12-9 24-2M8-26q18-7 32 4M-13 16q9 12 4 25"
          stroke="#b3d3a0"
          strokeWidth="4"
          opacity=".45"
          fill="none"
        />
        <path
          d="M-50-8q25-15 50-4t50-8M-40 30q24-8 44 2t36-3M-25-39q22-8 48 4"
          fill="none"
          stroke="#f2faf8"
          strokeWidth="5"
          strokeLinecap="round"
          opacity=".62"
        />
        <path
          d="M-52 1q24-10 41-4M9 10q23-8 45-5"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          opacity=".5"
        />
        <circle r="50" fill={`url(#${id}-shade)`} />
      </g>
      <circle
        r="50"
        fill="none"
        stroke="#91d9ef"
        strokeOpacity=".6"
        strokeWidth=".7"
      />
    </g>
  );
}
