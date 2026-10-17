# Application-owner web dashboard

Application-wide administration is web-only, under `/chore/ops`. It uses the separate operator login at `/chore/ops/login`, not a household session. The Android app does not contain owner administration.

## Owner tasks

- **Overview:** application household/account totals and module availability, with links to management pages.
- **Households:** browse without knowing a household owner's address; search by household name, ID or an adult member's email. Each household appears once, even if multiple members match. Browse/search results and account summaries are paginated.
- **Global modules:** see the persisted global availability of every module. Disabling a released module affects effective access across households but does not delete household settings, user grants or module content.
- **Household detail:** review billing/support information, global versus household module state, and account email/role/active/ownership summaries. Existing complimentary access remains finite, reasoned and owner-only.
- **Module changes:** review the exact target and scope, enter a reason, and reauthenticate with the operator password and authenticator code. A stale settings snapshot is rejected rather than silently overwriting another operator's change. Successful saves are read back; a refresh failure after acknowledgement must not replay the write.

Account summaries do not expose passwords, sessions, reset capabilities, authenticator secrets, balances, genealogy or other household content. This dashboard does not offer account impersonation, ownership transfer, role mutation or destructive account deletion.

## Guardrails

- Only `PLATFORM_OWNER` can call the new `/ops-api/owner/*` management APIs. Support keeps its existing redacted, case-scoped billing/support surface; household credentials cannot authenticate as an operator.
- Existing MFA/session expiry, double-submit operator CSRF, recent reauthentication and append-only platform audit apply. Audit records contain target IDs/module keys and before/after flags, never password/MFA values.
- The Admin module cannot be disabled globally or for a household.
- Unreleased modules remain visibly unavailable. In particular, the Family Tree implementation is present but its platform-discovery and operational rollout gates are still disabled. This dashboard must explain that state, not turn it on automatically or pretend that a global boolean completes activation.
- Household module permission grants and ownership remain authoritative. A platform-owner role does not grant access to private household feature content.

## Delivery and verification

No database schema migration or APK rebuild is required for these owner-only web/API changes. Use the repository's exact-revision test/review/CI workflow. Before backend cutover, rehearse against a protected online production-backup clone: unfiltered `alembic check`, all preexisting-table row/schema preservation, and real ORM read/write/rollback paths. Back up the actual service database and static bundle, preserve unrelated files, and restart only the owned backend service.

Use a marker-guarded disposable database for browser mutation tests: owner/member lookup, pagination, global and household state changes/readbacks, denial of support/consumer sessions, stale/conflict handling and module safety restrictions. On production, authenticate the real owner, find their household by their member email, inspect the named controls/account summaries, capture desktop/mobile-web evidence, and log out the owned smoke session. Do not seed production or toggle real modules merely to make a screenshot look populated.
