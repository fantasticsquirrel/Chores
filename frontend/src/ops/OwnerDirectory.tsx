import { useCallback, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Card, FormField, InlineNotice, TextInput } from "../ui";
import { opsApi } from "./api/client";
import { useOpsRead } from "./useOpsRead";
import { OwnerPagination } from "./OwnerPagination";

export function OwnerDirectory() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const read = useOpsRead(
    useCallback(
      () => opsApi.listOwnerHouseholds({ query, offset, limit: 25 }),
      [query, offset],
    ),
  );
  function search(event: FormEvent) {
    event.preventDefault();
    setOffset(0);
    if (query === draft.trim() && offset === 0) read.retry();
    setQuery(draft.trim());
  }
  function clear() {
    setDraft("");
    setQuery("");
    setOffset(0);
    if (!query && offset === 0) read.retry();
  }
  return (
    <Card as="section" className="ops-panel">
      <h2>Households</h2>
      <p>
        Browse all households or search any adult member’s email, household
        name, or ID. Owner email is redacted.
      </p>
      <form className="ops-search" onSubmit={search}>
        <FormField label="Household name, ID, or member email">
          <TextInput
            type="search"
            maxLength={200}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </FormField>
        <Button type="submit">Search</Button>
        <Button onClick={clear}>Clear search</Button>
      </form>
      {read.pending ? (
        <p role="status">Loading households…</p>
      ) : read.error ? (
        <InlineNotice variant="error">
          {read.error}
          <Button onClick={read.retry}>Retry households</Button>
        </InlineNotice>
      ) : read.data ? (
        <>
          {read.data.items.length === 0 ? (
            <p>No households found.</p>
          ) : (
            <div className="ops-result-list">
              {read.data.items.map((item) => (
                <Link
                  className="ops-result"
                  key={item.id}
                  to={`/ops/households/${item.id}`}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      Household #{item.id} · {item.timezone}
                    </small>
                  </span>
                  <span>
                    {item.owner_email}
                    <small>
                      {item.active_account_count} active / {item.account_count}{" "}
                      accounts
                    </small>
                  </span>
                  <span>{item.billing_status.replace(/_/g, " ")}</span>
                </Link>
              ))}
            </div>
          )}
          <OwnerPagination
            {...read.data}
            count={read.data.items.length}
            label="households"
            onOffset={setOffset}
          />
        </>
      ) : null}
    </Card>
  );
}
