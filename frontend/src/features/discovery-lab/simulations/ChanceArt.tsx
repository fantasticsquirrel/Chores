const COLORS = [
  "#bf6c48",
  "#398b88",
  "#8e71b1",
  "#c29b42",
  "#6e955e",
  "#567fa5",
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
      <header>
        <h3>Theoretical vs observed share</h3>
        <p>
          Bar = observed share
          <br />
          <i className="chance-theory-key" /> mark = theoretical chance
        </p>
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
          >
            <span
              className="chance-chart-number"
              style={{ backgroundColor: COLORS[index] }}
            >
              {index + 1}
            </span>
            <span className="chance-chart-body">
              <span className="chance-chart-track">
                <span
                  className="chance-chart-fill"
                  style={{
                    width: `${observed * 100}%`,
                    backgroundColor: COLORS[index],
                  }}
                />
                <i style={{ left: `${chance * 100}%` }} />
              </span>
              <span className="chance-chart-caption">
                <span>{counts[index].toLocaleString()} observed</span>
                <span>{(chance * 100).toFixed(1)}% chance</span>
              </span>
            </span>
            <strong>{total ? `${(observed * 100).toFixed(1)}%` : "—"}</strong>
          </button>
        );
      })}
      <p className="chance-chart-note">
        The bars use the same 0–100% scale. Small samples can look very uneven.
      </p>
    </div>
  );
}
