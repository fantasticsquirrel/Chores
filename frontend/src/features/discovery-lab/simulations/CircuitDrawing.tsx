import type {
  circuit,
  CircuitMode,
} from "@family-manager/family-api/discovery-models/physical-world";

function House({
  x,
  y,
  power,
  index,
  voltage,
  compact = false,
}: {
  x: number;
  y: number;
  power: number;
  index: number;
  voltage: number;
  compact?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x="-38"
        y="-18"
        width="76"
        height="40"
        rx="3"
        fill="#25465c"
        stroke="#7694a8"
      />
      <path d="M-47-18L0-48L47-18Z" fill="#59758b" stroke="#92acbe" />
      <path
        d="M-27-5H-13V9H-27ZM13-5H27V9H13Z"
        fill={power > 0 ? "#ffe19b" : "#102536"}
        opacity={power > 0 ? 0.2 + Math.min(1, power / 27) * 0.8 : 1}
      />
      <rect x="-5" y="1" width="10" height="21" fill="#8aa7af" />
      <path d="M-38 26H38" stroke="#566c80" strokeWidth="3" />
      <text x="0" y="43" textAnchor="middle" className="dl-svg-small">
        House {index + 1} · 12 Ω
      </text>
      {!compact && (
        <text x="0" y="59" textAnchor="middle" className="dl-svg-small">
          {voltage.toFixed(1)} V across load
        </text>
      )}
    </g>
  );
}
function Switch({
  x,
  y,
  closed,
  live,
}: {
  x: number;
  y: number;
  closed: boolean;
  live: boolean;
}) {
  const color = live ? "#f4d784" : "#8196ab";
  return (
    <g stroke={color} strokeWidth="3" fill="#112033">
      <circle cx={x - 17} cy={y} r="3" />
      <circle cx={x + 17} cy={y} r="3" />
      <path d={`M${x - 17} ${y}L${x + 15} ${closed ? y : y - 19}`} />
    </g>
  );
}
export function CircuitDrawing({
  mode,
  voltage,
  switches,
  result,
}: {
  mode: CircuitMode;
  voltage: number;
  switches: boolean[];
  result: ReturnType<typeof circuit>;
}) {
  const live = result.totalCurrent > 0,
    wire = live ? "#e9c980" : "#60788e";
  return (
    <>
      <text x="30" y="34" className="dl-world-caption">
        CIRCUIT CITY /{" "}
        {mode === "series" ? "ONE SHARED PATH" : "THREE INDEPENDENT PATHS"}
      </text>
      <rect
        x="32"
        y="186"
        width="76"
        height="81"
        rx="12"
        fill="#213d50"
        stroke="#7499ab"
      />
      <path d="M48 215H92M56 232H84" stroke="#d5e4dc" strokeWidth="4" />
      <text x="70" y="253" textAnchor="middle">
        {voltage} V
      </text>
      <text x="51" y="207" className="dl-svg-small">
        +
      </text>
      <text x="85" y="241" className="dl-svg-small">
        −
      </text>
      {mode === "series" ? (
        <>
          <path
            d="M70 186V130H113M147 130H182M258 130H293M327 130H362M438 130H473M507 130H542M618 130H658V307H70V267"
            fill="none"
            stroke={wire}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {switches.map((closed, i) => (
            <g key={i}>
              <Switch x={130 + i * 180} y={130} closed={closed} live={live} />
              <House
                x={220 + i * 180}
                y={130}
                index={i}
                power={result.housePower[i]}
                voltage={result.houseVoltage[i]}
              />
            </g>
          ))}
          <path d="M430 307l-10-5v10Z" fill={wire} />
          <text x="360" y="284" textAnchor="middle">
            {live
              ? `${result.totalCurrent.toFixed(2)} A everywhere in the loop`
              : "Open path: no current anywhere"}
          </text>
          <text x="360" y="341" textAnchor="middle" className="dl-svg-small">
            Closed loop: battery voltage = sum of the load voltages
          </text>
        </>
      ) : (
        <>
          <path
            d="M70 186V87H185V300M70 267V365H652V87"
            fill="none"
            stroke={wire}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {switches.map((closed, i) => {
            const y = 100 + i * 100,
              branch = result.houseCurrent[i] > 0 ? "#e9c980" : "#60788e";
            return (
              <g key={i}>
                <path
                  d={`M185 ${y}H268M302 ${y}H392M468 ${y}H652`}
                  fill="none"
                  stroke={branch}
                  strokeWidth="4"
                />
                <circle cx="185" cy={y} r="5" fill={wire} />
                <circle cx="652" cy={y} r="5" fill={wire} />
                <Switch
                  x={285}
                  y={y}
                  closed={closed}
                  live={result.houseCurrent[i] > 0}
                />
                <House
                  x={430}
                  y={y}
                  index={i}
                  power={result.housePower[i]}
                  voltage={result.houseVoltage[i]}
                  compact
                />
                <text
                  x="561"
                  y={y - 14}
                  textAnchor="middle"
                  className="dl-svg-small"
                >
                  {result.houseCurrent[i].toFixed(2)} A →
                </text>
                <text
                  x="561"
                  y={y + 20}
                  textAnchor="middle"
                  className="dl-svg-small"
                >
                  {result.houseVoltage[i].toFixed(1)} V
                </text>
              </g>
            );
          })}
          <text x="362" y="385" textAnchor="middle" className="dl-svg-small">
            At each junction, current in = current out
          </text>
        </>
      )}
      <text x="35" y="401" className="dl-svg-small">
        I = V ÷ R · Power = V × I · Arrows indicate conventional current
      </text>
    </>
  );
}
