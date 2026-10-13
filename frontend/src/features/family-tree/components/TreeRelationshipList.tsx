import type { ReactNode } from "react";
import { birthBandAccent, type LayoutResult } from "@family-manager/family-tree-core";
import { useBirthBandColors } from "../hooks/useBirthBandColors";
import { birthBandStyle } from "../lib/presentation/birthBandStyle";
import { Button } from "../../../ui/Button";

export interface PersonNavigationProps {
  onSelectPerson: (id: number) => void;
  onFocusPerson: (id: number) => void;
}
export function TreeRelationshipList({
  layout,
  onSelectPerson,
  onFocusPerson,
  renderBranches,
}: PersonNavigationProps & {
  layout: LayoutResult;
  renderBranches?: (id: number, label: string) => ReactNode;
}) {
  const colors = useBirthBandColors();
  const names = new Map(
    layout.list.map((row) => [row.node.id, row.node.label]),
  );
  return (
    <section aria-label="Relationships" className="family-tree-list">
      <h3>Relationships</h3>
      <p>
        Recorded facts only. Co-parent links do not imply marriage or a
        partnership.
      </p>
      <ul className="family-tree-people">
        {layout.list.map((row) => (
          <li
            key={row.node.id}
            className={`family-tree-list-person${row.birthYear.bucket.kind === "unknown" ? " family-tree-person-unknown" : ""}`}
            style={birthBandStyle(row.birthYear.bucket, colors.custom)}
          >
            <div className="family-tree-list-heading">
              <Button
                className="family-tree-control"
                aria-label={`Select ${row.node.label}`}
                onClick={() => onSelectPerson(row.node.id)}
              >
                {row.node.label}
              </Button>
              <span>{row.birthYear.label}</span>
              {row.birthYear.bucket.kind === "years" && (
                <span>{birthBandAccent(row.birthYear.bucket).label}</span>
              )}
              <Button
                className="family-tree-control"
                onClick={() => onFocusPerson(row.node.id)}
                aria-label={`Show ${row.node.label} in tree`}
              >
                Show in tree
              </Button>
            </div>
            {renderBranches?.(row.node.id, row.node.label)}
            {row.relationships.length ? (
              <ul>
                {row.relationships.map((relationship) => (
                  <li key={relationship.key}>
                    <span>{relationship.label}</span>
                    {" — "}
                    <button
                      className="family-tree-text-action"
                      type="button"
                      onClick={() => onSelectPerson(relationship.otherId)}
                      aria-label={`Select ${names.get(relationship.otherId) ?? "recorded person"} (${relationship.label})`}
                    >
                      {names.get(relationship.otherId) ?? "Recorded person"}
                    </button>
                    <span className="family-tree-pattern-name">
                      {" "}
                      ({relationship.pattern} line)
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No relationships shown in this view.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
