import { useEffect, useState } from "react";
import { apiClient, type FamilyTreeCollectionState } from "../../../api";
import { Button, ButtonLink, Card, InlineNotice } from "../../../ui";
import { useFamilyTreeAccess } from "../hooks/useFamilyTreeAccess";
import { formatApiError } from "../../../lib/errors";

/** Mounted by Home only after AuthContext's no-fallback discovery includes FT. */
export function FamilyTreeHomeShortcut() {
  const { access, refresh } = useFamilyTreeAccess();
  const [collection, setCollection] =
      useState<FamilyTreeCollectionState | null>(null),
    [error, setError] = useState<string | null>(null),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let owned = true;
    const controller = new AbortController();
    const requestOptions = { signal: controller.signal };
    setCollection(null);
    setError(null);
    if (access.state === "allowed" && !access.checking)
      void apiClient
        .getFamilyTreeCollection(requestOptions)
        .then((value) => {
          if (owned) setCollection(value);
        })
        .catch((reason) => {
          if (owned) setError(formatApiError(reason));
        });
    return () => {
      owned = false;
      controller.abort();
    };
  }, [access.state, access.owner, access.checking, retry]);
  if (access.state === "denied") return null;
  return (
    <Card
      className="dashboard-panel"
      as="section"
      aria-label="Family Tree shortcut"
    >
      <h2>Family Tree</h2>
      {access.state === "loading" ? (
        <p>Checking Family Tree access…</p>
      ) : access.state === "error" ? (
        <>
          <InlineNotice variant="error">
            Could not check Family Tree access: {access.error}
          </InlineNotice>
          <Button onClick={() => void refresh()}>
            Retry Family Tree access
          </Button>
        </>
      ) : error ? (
        <>
          <InlineNotice variant="error">
            Could not load Family Tree: {error}
          </InlineNotice>
          <Button onClick={() => setRetry((value) => value + 1)}>
            Retry Family Tree shortcut
          </Button>
        </>
      ) : collection ? (
        <>
          <p>
            {collection.active_people_count} active recorded{" "}
            {collection.active_people_count === 1 ? "person" : "people"}. Family
            records are separate from today&apos;s chore tasks.
          </p>
          <ButtonLink to="/family-tree">
            {collection.active_people_count === 0 &&
            access.manage &&
            collection.capabilities.can_manage
              ? "Start Family Tree"
              : "Open Family Tree"}
          </ButtonLink>
        </>
      ) : (
        <p>Loading Family Tree summary…</p>
      )}
    </Card>
  );
}
