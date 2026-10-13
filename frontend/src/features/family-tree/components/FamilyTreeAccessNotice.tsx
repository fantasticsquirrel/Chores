import { Button, Card, InlineNotice } from "../../../ui";
import type { TreeAccess } from "../hooks/useFamilyTreeAccess";
/** No content reads or optimistic role-derived grants belong to this boundary. */
export function FamilyTreeAccessNotice({
  access,
  refresh,
}: {
  access: TreeAccess;
  refresh: () => Promise<void>;
}) {
  if (access.state === "loading")
    return (
      <Card as="section">
        <h1>Family Tree</h1>
        <p role="status">Checking authoritative Family Tree access…</p>
      </Card>
    );
  if (access.state === "error")
    return (
      <Card as="section">
        <h1>Family Tree access could not be checked</h1>
        <InlineNotice variant="error">{access.error}</InlineNotice>
        <Button onClick={() => void refresh()}>Retry access check</Button>
        <p>
          No genealogy content is loaded without a successful access response.
        </p>
      </Card>
    );
  if (access.state === "denied")
    return (
      <Card as="section">
        <h1>Family Tree not available</h1>
        <p>
          This adult-only module is disabled or not granted for your account.
          Ask a household admin to check access.
        </p>
        <Button onClick={() => void refresh()}>Check access again</Button>
      </Card>
    );
  return null;
}
