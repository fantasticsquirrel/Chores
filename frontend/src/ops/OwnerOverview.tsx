import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Button, Card, InlineNotice } from "../ui";
import { opsApi } from "./api/client";
import { useOpsRead } from "./useOpsRead";

export function OwnerOverview() {
  const read = useOpsRead(useCallback(() => opsApi.getOwnerOverview(), []));
  return (
    <section className="ops-stack">
      <div>
        <h2>Owner overview</h2>
        <p>Application-wide operations. Household content remains private.</p>
      </div>
      {read.pending ? (
        <p role="status">Loading overview…</p>
      ) : read.error ? (
        <InlineNotice variant="error">
          {read.error}
          <Button onClick={read.retry}>Retry overview</Button>
        </InlineNotice>
      ) : read.data ? (
        <dl className="ops-metrics">
          <Card as="div">
            <dt>Households</dt>
            <dd>{read.data.household_count}</dd>
            <Link to="/ops/households">Browse households →</Link>
          </Card>
          <Card as="div">
            <dt>Active accounts</dt>
            <dd>
              {read.data.active_account_count} of {read.data.account_count}
            </dd>
            <p>Account and role summaries are available per household.</p>
          </Card>
          <Card as="div">
            <dt>Enabled modules</dt>
            <dd>
              {read.data.enabled_module_count} of {read.data.module_count}
            </dd>
            <Link to="/ops/modules">Manage global modules →</Link>
          </Card>
        </dl>
      ) : null}
      <Card as="section">
        <h3>Operations boundaries</h3>
        <p>
          Global switches affect every household. Household switches retain each
          household’s opt-in when global access is disabled. Every change
          requires a reason, current password and MFA.
        </p>
        <p>
          Household Admin is a separate account realm; operator credentials do
          not provide household navigation or private family content.
        </p>
      </Card>
    </section>
  );
}
