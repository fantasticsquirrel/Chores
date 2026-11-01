import type { CSSProperties } from "react";

const COLORS = [
  "#c76646",
  "#2f8782",
  "#8063a5",
  "#bd8f28",
  "#618d53",
  "#4f789f",
];
export function ChanceDistribution({
  chances,
  counts,
  selected,
  onSelect,
}: {
  chances: number[];
  counts: number[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  return (
    <div className="chance-distribution">
      <header className="chance-distribution-header">
        <h3>Observed vs expected</h3>
        <div className="chance-chart-legend" aria-hidden="true">
          <span>
            <i className="chance-observed-key" /> observed
          </span>
          <span>
            <i className="chance-theory-key" /> expected
          </span>
        </div>
      </header>
      <div className="chance-chart-axis">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      {chances.map((chance, index) => {
        const observed = total ? counts[index] / total : 0;
        return (
          <button
            className="chance-chart-row"
            key={index}
            type="button"
            aria-label={`Inspect outcome ${index + 1}`}
            aria-pressed={selected === index}
            onClick={() => onSelect(index)}
            style={{ "--chance-color": COLORS[index] } as CSSProperties}
          >
            <span
              className={`chance-chart-number chance-chart-pattern-${index + 1}`}
            >
              {index + 1}
            </span>
            <span className="chance-chart-body">
              <span className="chance-chart-track">
                <span
                  className="chance-chart-fill"
                  style={{
                    width: `${observed * 100}%`,
                  }}
                />
                <i
                  className="chance-expected-mark"
                  style={{ left: `${chance * 100}%` }}
                />
              </span>
              <span className="chance-chart-caption">
                <span>{counts[index].toLocaleString()} draws</span>
                <span>
                  {total ? `${(observed * 100).toFixed(1)}%` : "—"} · expected{" "}
                  {(chance * 100).toFixed(1)}%
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
