import { useId, type ReactNode } from "react";
export function Scene({
  title,
  description,
  children,
  environment = "space",
}: {
  environment?: "space" | "bench" | "garden" | "landscape";
  title: string;
  description: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <svg
      className="dl-scene"
      viewBox="0 0 720 420"
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <defs>
        <radialGradient id={`${id}-bg`}>
          <stop
            stopColor={
              environment === "landscape"
                ? "#405b48"
                : environment === "garden"
                  ? "#1b413b"
                  : "#203455"
            }
          />
          <stop
            offset="1"
            stopColor={environment === "landscape" ? "#1a3029" : "#090f23"}
          />
        </radialGradient>
      </defs>
      <rect width="720" height="420" rx="20" fill={`url(#${id}-bg)`} />
      {environment === "space" &&
        Array.from({ length: 35 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 137 + 37) % 710}
            cy={(i * 73 + 19) % 410}
            r={i % 3 === 0 ? 1.5 : 0.7}
            fill="#c7daff"
            opacity=".32"
          />
        ))}
      {environment === "bench" && (
        <g opacity=".12" stroke="#90b5d1" strokeWidth=".5">
          {Array.from({ length: 17 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={40 + i * 40}
              y1="60"
              x2={40 + i * 40}
              y2="365"
            />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={`h${i}`}
              x1="30"
              y1={70 + i * 40}
              x2="690"
              y2={70 + i * 40}
            />
          ))}
        </g>
      )}
      {children}
    </svg>
  );
}
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="dl-slider">
      <div className="dl-slider-heading">
        <label htmlFor={id}>{label}</label>
        <span className="dl-value" aria-hidden="true">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={`${value}${unit}`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="dl-range-labels">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}
export function LabLayout({
  children,
  controls,
  readout,
  question,
}: {
  children: ReactNode;
  controls: ReactNode;
  readout: ReactNode;
  question: string;
}) {
  return (
    <div className="dl-lab">
      <div className="dl-stage">
        {children}
        <div className="dl-readout">{readout}</div>
      </div>
      <div className="dl-controls">
        {controls}
        <div className="dl-prompt">
          <strong>Try this</strong>
          <p>{question}</p>
        </div>
      </div>
    </div>
  );
}
export function Playback({
  playing,
  toggle,
  reset,
}: {
  playing: boolean;
  toggle: () => void;
  reset: () => void;
}) {
  return (
    <div className="dl-actions">
      <button type="button" onClick={toggle}>
        {playing ? "Pause motion" : "Play motion"}
      </button>
      <button type="button" onClick={reset}>
        Reset
      </button>
    </div>
  );
}
