import { useState } from "react";
import {
  apiClient,
  type FamilyTreePerson,
  type FamilyTreePeoplePage,
  type FamilyTreeRelativeRelationship,
} from "../../../api";
import { Button, InlineNotice } from "../../../ui";
import { formatApiError } from "../../../lib/errors";
import { useTreeRuntime } from "../hooks/useTreeCommand";
import { useTreeRead, useTreePages } from "../hooks/useTreeReads";
import { personName } from "../lib/workflows/workflows";
import {
  identityEditor,
  relativeEditor,
  type EditorSpec,
} from "../lib/workflows/editors";
export function RelativeChooser({
  anchor,
  originRevision,
  onChoose,
}: {
  anchor: FamilyTreePerson;
  originRevision: number;
  onChoose: (spec: EditorSpec) => void;
}) {
  const [query, setQuery] = useState(""),
    [direction, setDirection] =
      useState<FamilyTreeRelativeRelationship["direction"]>("parent"),
    [mode, setMode] = useState("new");
  const people = useTreePages<FamilyTreePerson, FamilyTreePeoplePage>(
    ["relative-directory", query],
    (cursor, requestOptions) =>
      apiClient.listFamilyTreePeople(
        {
          query,
          cursor,
          limit: 40,
          archived: false,
        },
        requestOptions,
      ),
    mode === "existing",
  );
  return (
    <section>
      <p>
        Add a recorded relationship to {personName(anchor)}. No relationship is
        inferred from names or account membership.
      </p>
      <label>
        Relationship direction
        <select
          value={direction}
          onChange={(event) =>
            setDirection(
              event.target.value as FamilyTreeRelativeRelationship["direction"],
            )
          }
        >
          <option value="parent">Parent of this person</option>
          <option value="child">Child of this person</option>
          <option value="caregiver">Caregiver of this person</option>
          <option value="recipient">Care recipient of this person</option>
          <option value="partner">Partner of this person</option>
        </select>
      </label>
      <label>
        Relative record
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="new">
            Create a new person atomically with relationship
          </option>
          <option value="existing">Use an existing person</option>
        </select>
      </label>
      {mode === "new" ? (
        <Button
          onClick={() =>
            onChoose({
              ...relativeEditor(anchor, direction),
              originRevision,
              reviewTarget: { entity: "person", id: anchor.id },
            })
          }
        >
          Continue with new person
        </Button>
      ) : (
        <>
          <label>
            Search existing people
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {people.isPending ? <p>Loading recorded people…</p> : null}
          {people.error ? (
            <InlineNotice variant="error">
              {formatApiError(people.error)}{" "}
              <Button onClick={() => void people.refetch()}>
                Retry relatives directory
              </Button>
            </InlineNotice>
          ) : null}
          {!people.consistent ? (
            <InlineNotice variant="error">
              The directory changed while paging.{" "}
              <Button onClick={() => void people.refresh()}>
                Refresh relatives directory
              </Button>
            </InlineNotice>
          ) : null}
          <ul>
            {people.items
              .filter(
                (person) =>
                  person.id !== anchor.id &&
                  !person.merged_into_person_id &&
                  !person.is_locked,
              )
              .map((person) => (
                <li key={person.id}>
                  <Button
                    onClick={() =>
                      onChoose({
                        ...relativeEditor(anchor, direction, person),
                        originRevision: Math.min(
                          originRevision,
                          people.revision ?? -1,
                        ),
                        reviewTarget: { entity: "person", id: anchor.id },
                      })
                    }
                  >
                    Select {personName(person)} (person {person.id})
                  </Button>
                </li>
              ))}
          </ul>
          {people.hasNextPage ? (
            <Button
              disabled={people.isFetching}
              onClick={() => void people.fetchNextPage()}
            >
              Load more existing people
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

export function IdentityChooser({
  person,
  originRevision,
  onChoose,
}: {
  person: FamilyTreePerson;
  originRevision: number;
  onChoose: (spec: EditorSpec) => void;
}) {
  const runtime = useTreeRuntime();
  const candidates = useTreeRead(
    ["identity-candidates"],
    (requestOptions) =>
      apiClient.listFamilyTreeIdentityCandidates(requestOptions),
    runtime.manage,
  );
  return (
    <section>
      <p>
        Choose an existing household identity, then explicitly confirm the
        association. This does not change sign-in, permissions, or lineage.
      </p>
      {candidates.isPending ? <p>Loading eligible identities…</p> : null}
      {candidates.error ? (
        <InlineNotice variant="error">
          {formatApiError(candidates.error)}{" "}
          <Button onClick={() => void candidates.refetch()}>
            Retry identities
          </Button>
        </InlineNotice>
      ) : null}
      <ul>
        {candidates.data?.items.map((candidate) => (
          <li key={`${candidate.kind}:${candidate.id}`}>
            <Button
              onClick={() =>
                onChoose({
                  ...identityEditor(person, candidate),
                  originRevision,
                  reviewTarget: { entity: "person", id: person.id },
                })
              }
            >
              {candidate.kind}: {candidate.label}
              {candidate.active ? "" : " (inactive)"}
            </Button>
          </li>
        ))}
      </ul>
      {candidates.data?.items.length === 0 ? (
        <p>No eligible household identities are available.</p>
      ) : null}
    </section>
  );
}
