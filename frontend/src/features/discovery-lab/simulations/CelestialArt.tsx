import { useId } from "react";
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
export function LunarSurface({
  x,
  y,
  r,
  litPath,
}: {
  x: number;
  y: number;
  r: number;
  litPath?: string;
}) {
  const id = useId();
  const texture = (
    <g transform={`translate(${x} ${y}) scale(${r / 75})`}>
      <circle r="75" fill={`url(#${id}-stone)`} />
      <path
        d="M-44-47q22-19 39-5t-6 33q-27 10-37-9Z M6-39q34-22 49 4t-10 38q-24 6-34-17Z M-24 1q29-14 39 10t-12 24q-22-2-27-34Z"
        fill="#727f86"
        opacity=".4"
      />
      {Array.from({ length: 22 }, (_, i) => {
        const a = i * 2.399,
          radius = 13 + ((i * 19) % 51),
          cx = Math.cos(a) * radius,
          cy = Math.sin(a) * radius,
          cr = 2.5 + (i % 5) * 1.1;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={cr} fill="#5f6a73" opacity=".35" />
            <path
              d={`M${cx - cr} ${cy}a${cr} ${cr} 0 0 1 ${cr * 2} 0`}
              fill="none"
              stroke="#e1e2d4"
              strokeWidth=".8"
              opacity=".65"
            />
            <circle
              cx={cx + 0.7}
              cy={cy + 0.8}
              r={cr * 0.55}
              fill="#606b73"
              opacity=".3"
            />
          </g>
        );
      })}
      <circle r="75" fill={`url(#${id}-rim)`} />
    </g>
  );
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-stone`} cx="36%" cy="30%" r="80%">
          <stop stopColor="#eee9d5" />
          <stop offset=".6" stopColor="#bec5bb" />
          <stop offset="1" stopColor="#717e85" />
        </radialGradient>
        <radialGradient id={`${id}-rim`}>
          <stop offset=".65" stopColor="#132035" stopOpacity="0" />
          <stop offset="1" stopColor="#132035" stopOpacity=".28" />
        </radialGradient>
        <clipPath id={`${id}-disk`}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
        <clipPath id={`${id}-light`}>
          {litPath ? <path d={litPath} /> : <circle cx={x} cy={y} r={r} />}
        </clipPath>
      </defs>
      <circle cx={x} cy={y} r={r} fill="#192334" />
      <g clipPath={`url(#${id}-disk)`}>
        <g opacity=".12">{texture}</g>
        <g clipPath={`url(#${id}-light)`}>{texture}</g>
      </g>
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="none"
        stroke="#adbbca"
        strokeOpacity=".4"
        strokeWidth=".6"
      />
    </g>
  );
}
export function PlanetSphere({
  x,
  y,
  r,
  color,
  bands = false,
}: {
  x: number;
  y: number;
  r: number;
  color: string;
  bands?: boolean;
}) {
  const id = useId();
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-g`} cx="30%" cy="22%" r="80%">
          <stop stopColor="#fff8e3" />
          <stop offset=".25" stopColor={color} />
          <stop offset=".68" stopColor={color} />
          <stop offset="1" stopColor="#152037" />
        </radialGradient>
        <clipPath id={`${id}-c`}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
      </defs>
      <circle cx={x} cy={y} r={r} fill={`url(#${id}-g)`} />
      {bands && (
        <g clipPath={`url(#${id}-c)`}>
          {[-0.5, -0.2, 0.12, 0.44].map((p, i) => (
            <path
              key={p}
              d={`M${x - r} ${y + r * p}q${r} ${r * 0.18} ${r * 2} 0`}
              stroke={i % 2 ? "#f8e1bc" : "#7e5b4d"}
              strokeWidth={r * 0.13}
              opacity=".28"
              fill="none"
            />
          ))}
        </g>
      )}
    </g>
  );
}
