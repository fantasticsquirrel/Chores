import type { Dispatch, SetStateAction } from "react";
import { Link } from "react-router-dom";
import type { FamilyTreePerson, FamilyTreePeoplePage } from "../../../api";
import { Button, Card, InlineNotice } from "../../../ui";
import { formatApiError } from "../../../lib/errors";
import { personName } from "../lib/workflows/workflows";
import { personEditor, type EditorSpec } from "../lib/workflows/editors";
import type { useTreePages } from "../hooks/useTreeReads";
type Props = {
  activePeopleCount: number;
  searchParams: URLSearchParams;
  tag: string;
  setTag: Dispatch<SetStateAction<string>>;
  living: string;
  setLiving: Dispatch<SetStateAction<string>>;
  archived: boolean;
  setArchived: Dispatch<SetStateAction<boolean>>;
  busy: boolean;
  online: boolean;
  authoritativeManage: boolean;
  people: ReturnType<
    typeof useTreePages<FamilyTreePerson, FamilyTreePeoplePage>
  >;
  edit: (spec: EditorSpec) => void;
  showInTree: (id: number) => void;
};
export function FamilyTreeDirectory({
  activePeopleCount,
  searchParams,
  tag,
  setTag,
  living,
  setLiving,
  archived,
  setArchived,
  busy,
  online,
  authoritativeManage,
  people,
  edit,
  showInTree,
}: Props) {
  return (
    <Card as="section">
      <h2>People directory</h2>
      <p>Find any recorded person, including disconnected branches.</p>
      <div className="family-tree-directory-filters">
        <label>
          Tag filter
          <input
            value={tag}
            disabled={busy}
            onChange={(event) => setTag(event.target.value)}
          />
        </label>
        <label>
          Living status filter
          <select
            value={living}
            disabled={busy}
            onChange={(event) => setLiving(event.target.value)}
          >
            <option value="">Any living status</option>
            <option value="living">Living</option>
            <option value="deceased">Deceased</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={archived}
            disabled={busy}
            onChange={(event) => setArchived(event.target.checked)}
          />{" "}
          Archived people
        </label>
      </div>
      {authoritativeManage && activePeopleCount > 0 ? (
        <Button disabled={!online || busy} onClick={() => edit(personEditor())}>
          Add disconnected person
        </Button>
      ) : null}
      {people.isPending ? <p>Loading people…</p> : null}
      {people.error ? (
        <InlineNotice variant="error">
          Directory unavailable: {formatApiError(people.error)}{" "}
          <Button
            disabled={!online || busy}
            onClick={() => void people.refetch()}
          >
            Retry people directory
          </Button>
        </InlineNotice>
      ) : null}
      {!people.consistent ? (
        <InlineNotice variant="error">
          The directory revision changed while paging. No mixed-revision rows
          are shown.{" "}
          <Button onClick={() => void people.refresh()}>
            Refresh people directory
          </Button>
        </InlineNotice>
      ) : null}
      {people.data && people.consistent ? (
        <p>
          {people.data.pages[0].total} matching recorded people ·{" "}
          {people.items.length} loaded
        </p>
      ) : null}
      <ul aria-label="Recorded people">
        {people.items.map((person) => (
          <li key={person.id}>
            <Link to={`/family-tree/people/${person.id}?${searchParams.toString()}`}>
              {personName(person)}
            </Link>{" "}
            · {person.living_status}
            {person.is_locked ? " · locked" : ""}
            {person.merged_into_person_id
              ? ` · alias of person ${person.merged_into_person_id}`
              : ""}
            <Button
              disabled={busy || !!person.merged_into_person_id}
              onClick={() => showInTree(person.id)}
            >
              Show {personName(person)} in tree
            </Button>
          </li>
        ))}
      </ul>
      {!people.isPending &&
      !people.error &&
      people.consistent &&
      people.items.length === 0 ? (
        <p>No matching people. Try a different search or archived filter.</p>
      ) : null}
      {people.hasNextPage ? (
        <Button
          disabled={!online || busy || people.isFetching}
          onClick={() => void people.fetchNextPage()}
        >
          Load more people
        </Button>
      ) : null}
    </Card>
  );
}
