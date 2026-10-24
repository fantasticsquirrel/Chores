export function SoundDrawing({
  length,
  amplitude,
  progress,
  frequency,
}: {
  length: number;
  amplitude: number;
  progress: number;
  frequency: number;
}) {
  const end = 130 + length * 3.6;
  const stringPath = Array.from({ length: 81 }, (_, i) => {
    const x = 130 + ((end - 130) * i) / 80;
    const y =
      168 -
      Math.sin((i / 80) * Math.PI) *
        amplitude *
        7 *
        Math.cos(progress * Math.PI * 2);
    return `${i ? "L" : "M"}${x},${y}`;
  }).join(" ");
  const pressure = Array.from(
    { length: 241 },
    (_, i) =>
      `${i ? "L" : "M"}${80 + i * 2.3},${315 - Math.sin((i / 240) * frequency * 0.01 * Math.PI * 2 - progress * Math.PI * 2) * amplitude * 4}`,
  ).join(" ");
  return (
    <>
      <text x="30" y="34" className="dl-world-caption">
        SOUND / ONE STRING, TWO VIEWS
      </text>
      <rect x="70" y="105" width="580" height="114" rx="20" fill="#a66e43" />
      <rect x="79" y="111" width="562" height="100" rx="15" fill="#d2a36c" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M90 ${120 + i * 18} Q310 ${110 + i * 18} 625 ${124 + i * 18}`}
          stroke="#9b653b"
          fill="none"
          opacity=".35"
        />
      ))}
      <ellipse
        cx="355"
        cy="165"
        rx="55"
        ry="34"
        fill="#553c32"
        stroke="#edc996"
        strokeWidth="5"
      />
      <path
        d={`M130 118V213M${end} 118V213`}
        stroke="#534331"
        strokeWidth="13"
      />
      <path
        d={`M130 168H${end}`}
        stroke="#d5e4eb"
        opacity=".35"
        strokeDasharray="5 5"
      />
      <path d={stringPath} fill="none" stroke="#fff1b5" strokeWidth="4" />
      <circle cx="130" cy="168" r="6" fill="#f7e5bd" />
      <circle cx={end} cy="168" r="6" fill="#f7e5bd" />
      <path d={`M130 85V92H${end}V85`} stroke="#9eafc9" fill="none" />
      <text x={(130 + end) / 2} y="78" textAnchor="middle">
        {length} cm between fixed ends
      </text>
      <text x="80" y="246" className="dl-svg-small">
        STRING DISPLACEMENT · fundamental mode · slowed
      </text>
      <rect
        x="65"
        y="265"
        width="584"
        height="102"
        rx="12"
        fill="#0a1626"
        stroke="#31435d"
      />
      <path d="M80 315H632" stroke="#345473" strokeDasharray="3 4" />
      <path d={pressure} stroke="#78e1d0" strokeWidth="2.5" fill="none" />
      <text x="80" y="286" className="dl-world-caption">
        AIR PRESSURE AT ONE POINT
      </text>
      <text x="80" y="388" className="dl-svg-small">
        0 ms
      </text>
      <text x="630" y="388" textAnchor="end" className="dl-svg-small">
        10 ms
      </text>
      <text x="360" y="388" textAnchor="middle" className="dl-svg-small">
        More cycles in this window = higher pitch
      </text>
    </>
  );
}
