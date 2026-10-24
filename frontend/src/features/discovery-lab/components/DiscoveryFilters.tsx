import { useId, useState } from "react";
import { Button } from "../../../ui";
import {
  discoveryFilterOptions,
  EMPTY_DISCOVERY_FILTERS,
  type DiscoveryFilters as Filters,
  type FilterableExploration,
} from "../lib/filters";

type Props = {
  items: FilterableExploration[];
  filters: Filters;
  onChange: (filters: Filters) => void;
  disabled?: boolean;
};
export function DiscoveryFilters({
  items,
  filters,
  onChange,
  disabled = false,
}: Props) {
  const options = discoveryFilterOptions(items);
  const [advanced, setAdvanced] = useState(false);
  const advancedId = useId();
  const count = [filters.grade, filters.tag].filter(Boolean).length;
  const update = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value });
  return (
    <fieldset className="discovery-filters" disabled={disabled}>
      <legend className="discovery-sr-only">Filter Explorations</legend>
      <label className="discovery-search">
        Find an exploration
        <input
          type="search"
          value={filters.query}
          placeholder="Try space, light, plants…"
          onChange={(event) => update("query", event.target.value)}
        />
      </label>
      <label>
        Subject
        <select
          value={filters.subject}
          onChange={(event) => update("subject", event.target.value)}
        >
          <option value="">All subjects</option>
          {options.subjects.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <Button
        className="discovery-secondary"
        aria-expanded={advanced}
        aria-controls={advancedId}
        onClick={() => setAdvanced((value) => !value)}
      >
        Filters ({count})
      </Button>
      <Button
        className="discovery-secondary"
        onClick={() => onChange(EMPTY_DISCOVERY_FILTERS)}
      >
        Clear filters
      </Button>
      {count > 0 && (
        <p className="discovery-active-filters" aria-live="polite">
          {[
            filters.grade && `Grades: ${filters.grade}`,
            filters.tag && `Tag: ${filters.tag}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {advanced && (
        <div id={advancedId} className="discovery-advanced-filters">
          <label>
            Grade band
            <select
              value={filters.grade}
              onChange={(event) => update("grade", event.target.value)}
            >
              <option value="">All grades</option>
              {options.grades.map((value) => (
                <option key={value} value={value}>
                  Grades {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag
            <select
              value={filters.tag}
              onChange={(event) => update("tag", event.target.value)}
            >
              <option value="">All tags</option>
              {options.tags.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
      )}
    </fieldset>
  );
}
