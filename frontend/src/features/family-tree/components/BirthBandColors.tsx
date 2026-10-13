import { useId, useMemo, useState } from "react";
import {
  birthBandAccent,
  type BirthBandAccent,
  type ListRow,
} from "@family-manager/family-tree-core";
import { Button } from "../../../ui/Button";
import { useBirthBandColors } from "../hooks/useBirthBandColors";

function AccentEditor({ band }: { band: BirthBandAccent }) {
  const colors = useBirthBandColors();
  const [draft, setDraft] = useState(colors.custom[band.key] ?? "");
  const [error, setError] = useState(false);
  const id = useId();
  const target = band.key === "unknown"
    ? "unknown birth year" : band.label.toLowerCase();
  return (
    <div className="family-tree-color-row">
      <label htmlFor={id}>Accent for {target}</label>
      <input
        id={id}
        type="text"
        value={draft}
        maxLength={32}
        placeholder="#RRGGBB"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        className="family-tree-control"
        aria-label={`Apply accent for ${target}`}
        onClick={() => setError(!colors.apply(band.key, draft))}
      >
        Apply accent
      </Button>
      {error && (
        <p id={`${id}-error`} role="alert">
          Use #RGB or #RRGGBB (opaque hex color).
        </p>
      )}
    </div>
  );
}
export function BirthBandColorControls({ rows }: { rows: readonly ListRow[] }) {
  const colors = useBirthBandColors();
  const bands = useMemo(() => {
    const unique = new Map<string, BirthBandAccent>();
    for (const row of rows) {
      const band = birthBandAccent(row.birthYear.bucket);
      unique.set(band.key, band);
    }
    return [...unique.values()].sort((a, b) =>
      a.key.localeCompare(b.key, "en", { numeric: true }),
    );
  }, [rows]);
  return (
    <details className="family-tree-legend family-tree-colors">
      <summary>Birth-band colors</summary>
      <p>
        Accents group birth years in 25-year bands, not family generations.
        Unknown birth years use a dashed accent. Text and card backgrounds keep
        the current theme. Changes last only in this household session.
      </p>
      {bands.map((band) => (
        <AccentEditor key={`${colors.resetVersion}:${band.key}`} band={band} />
      ))}
      <Button className="family-tree-control" onClick={colors.reset}>
        Reset birth-band colors
      </Button>
    </details>
  );
}
