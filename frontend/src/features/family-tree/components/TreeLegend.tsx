import { RELATIONSHIP_LEGEND } from "@family-manager/family-tree-core";
import { edgeDash } from "../lib/presentation/viewport";

export function TreeLegend() {
  return (
    <section aria-label="Relationship legend" className="family-tree-legend">
      <details>
        <summary>Relationship legend</summary>
        <ul>
          {RELATIONSHIP_LEGEND.map((item) => (
            <li key={`${item.type}:${item.label}`}>
              <svg width="40" height="16" aria-hidden="true">
                <line
                  x1="2"
                  y1="8"
                  x2="38"
                  y2="8"
                  className="family-tree-edge"
                  strokeWidth={item.pattern === "double" ? 6 : 2}
                  strokeDasharray={edgeDash[item.pattern]}
                />
                {item.pattern === "double" && (
                  <line
                    x1="2"
                    y1="8"
                    x2="38"
                    y2="8"
                    className="family-tree-edge-inner"
                    strokeWidth="2"
                  />
                )}
              </svg>
              <span>
                {item.label} ({item.pattern} line)
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
