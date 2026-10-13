import { useState } from "react";
import type { FamilyTreePerson } from "../../../api";
import { apiClient } from "../../../api";
import { Button, Card, InlineNotice } from "../../../ui";
import { formatApiError } from "../../../lib/errors";
import { personName } from "../lib/workflows/workflows";
import { useTreeRead } from "../hooks/useTreeReads";
export function FamilyTreeComparison({
  people,
  busy,
  online,
  includeHistory,
}: {
  people: FamilyTreePerson[];
  busy: boolean;
  online: boolean;
  includeHistory: boolean;
}) {
  const [comparisonIds, setComparisonIds] = useState({ a: "", b: "" }),
    [comparison, setComparison] = useState<{ a: number; b: number } | null>(
      null,
    );
  const compare = useTreeRead(
    ["compare", comparison, includeHistory],
    (requestOptions) =>
      apiClient.compareFamilyTreePeople(
        {
          person_a_id: comparison!.a,
          person_b_id: comparison!.b,
          include_history: includeHistory,
          max_nodes: 150,
          max_edges: 300,
        },
        requestOptions,
      ),
    !!comparison && online,
  );
  return (
    <Card as="section">
      <h2>Compare recorded connections</h2>
      <p>
        Choose two directory people. Results are bounded typed paths, not
        guesses about genetic kinship. Search or load more directory rows to
        find any person.
      </p>
      <label>
        First comparison person
        <select
          value={comparisonIds.a}
          onChange={(event) =>
            setComparisonIds((current) => ({
              ...current,
              a: event.target.value,
            }))
          }
        >
          <option value="">Choose first person</option>
          {comparisonIds.a &&
            !people.some((person) => String(person.id) === comparisonIds.a) && (
              <option value={comparisonIds.a}>
                Selected recorded person {comparisonIds.a}
              </option>
            )}
          {people
            .filter(
              (person) => !person.merged_into_person_id && !person.archived_at,
            )
            .map((person) => (
              <option key={person.id} value={person.id}>
                {personName(person)} (person {person.id})
              </option>
            ))}
        </select>
      </label>
      <label>
        Second comparison person
        <select
          value={comparisonIds.b}
          onChange={(event) =>
            setComparisonIds((current) => ({
              ...current,
              b: event.target.value,
            }))
          }
        >
          <option value="">Choose second person</option>
          {comparisonIds.b &&
            !people.some((person) => String(person.id) === comparisonIds.b) && (
              <option value={comparisonIds.b}>
                Selected recorded person {comparisonIds.b}
              </option>
            )}
          {people
            .filter(
              (person) => !person.merged_into_person_id && !person.archived_at,
            )
            .map((person) => (
              <option key={person.id} value={person.id}>
                {personName(person)} (person {person.id})
              </option>
            ))}
        </select>
      </label>
      <Button
        disabled={!comparisonIds.a || !comparisonIds.b || !online || busy}
        onClick={() =>
          setComparison({
            a: Number(comparisonIds.a),
            b: Number(comparisonIds.b),
          })
        }
      >
        Compare recorded path
      </Button>
      {comparison && compare.isPending ? (
        <p>Loading bounded comparison…</p>
      ) : null}
      {compare.error ? (
        <InlineNotice variant="error">
          Comparison unavailable: {formatApiError(compare.error)}{" "}
          <Button
            disabled={busy || !online}
            onClick={() => void compare.refetch()}
          >
            Retry comparison
          </Button>
        </InlineNotice>
      ) : null}
      {compare.data ? (
        <section aria-label="Comparison result">
          <p>
            Person {compare.data.person_a_id} → person{" "}
            {compare.data.person_b_id}:{" "}
            {compare.data.state === "connected"
              ? `${compare.data.distance} recorded connection steps`
              : compare.data.state === "truncated"
                ? "Search bound reached; no definitive connection result"
                : "No recorded connection in this bounded, filtered graph"}
            . Revision {compare.data.graph_revision}.
          </p>
          <ol>
            {compare.data.path.map((edge, index) => (
              <li key={edge.id}>
                Person {compare.data.person_ids[index] ?? edge.source_person_id}{" "}
                → person{" "}
                {compare.data.person_ids[index + 1] ?? edge.target_person_id}:
                recorded {edge.type} · {edge.kind}
                {edge.status ? ` · ${edge.status}` : ""} (record{" "}
                {edge.record_id})
              </li>
            ))}
          </ol>
          {compare.data.warnings.map((warning, index) => (
            <p key={index}>{warning}</p>
          ))}
        </section>
      ) : null}
    </Card>
  );
}
