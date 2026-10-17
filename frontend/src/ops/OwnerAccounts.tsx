import { useCallback, useState } from "react";
import { Button, Card, InlineNotice } from "../ui";
import { opsApi } from "./api/client";
import { useOpsRead } from "./useOpsRead";
import { OwnerPagination } from "./OwnerPagination";

export function OwnerAccounts({ householdId }: { householdId: number }) {
  const [offset, setOffset] = useState(0);
  const read = useOpsRead(
    useCallback(
      () =>
        opsApi.listOwnerHouseholdAccounts(householdId, { offset, limit: 25 }),
      [householdId, offset],
    ),
  );
  return (
    <Card as="section">
      <h3>Accounts and roles</h3>
      <p>
        Read-only account summaries for household #{householdId}. Ownership and
        household roles do not grant platform operator access.
      </p>
      {read.pending ? (
        <p role="status">Loading accounts…</p>
      ) : read.error ? (
        <InlineNotice variant="error">
          {read.error}
          <Button onClick={read.retry}>Retry accounts</Button>
        </InlineNotice>
      ) : read.data ? (
        <>
          {read.data.items.length === 0 ? (
            <p>No accounts found.</p>
          ) : (
            <div className="ops-table-scroll">
              <table>
                <caption>Household #{householdId} accounts</caption>
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Household role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Ownership</th>
                  </tr>
                </thead>
                <tbody>
                  {read.data.items.map((account) => (
                    <tr key={account.id}>
                      <th scope="row">
                        {account.email}
                        <small>Account #{account.id}</small>
                      </th>
                      <td>{account.role.replace(/_/g, " ")}</td>
                      <td>{account.active ? "Active" : "Inactive"}</td>
                      <td>
                        {account.is_household_owner
                          ? "Household owner"
                          : "Member"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <OwnerPagination
            {...read.data}
            count={read.data.items.length}
            label="accounts"
            onOffset={setOffset}
          />
        </>
      ) : null}
    </Card>
  );
}
