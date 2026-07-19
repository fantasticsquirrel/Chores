# Family Manager Hardening and Product Finish Tracker

> **For Hermes:** Execute this tracker with strict TDD and independent review. Mark boxes only after revision-specific tests, CI, deployment, and live proof.

**Goal:** Close the July 2026 architecture/security/operations audit, clean production hygiene, turn the deployed chore-era shell into a coherent task-first Family Manager, and prepare a household subscription service with explicit customer ownership and least-privilege platform operations without removing working chores, homeschool, recipes, notifications, web, or mobile behavior.

**Architecture:** Alembic becomes the authoritative schema path; security-sensitive network/session/permission/workflow behavior receives explicit policy services and negative tests; production jobs use systemd timers; the parent home becomes a cross-module Today projection; secondary workflows use progressive disclosure. Existing `/chore/` and `/chore-api/` routes remain stable during this delivery, with one canonical public hostname. Subscription state is household-scoped and backend-authoritative, provider events project into entitlements, and platform owner/support identities remain separate from household roles and content authorization.

**Tech stack:** FastAPI, SQLAlchemy, Alembic, SQLite/WAL, React/Vite, Expo/React Native, Pytest, Vitest, Playwright, systemd, nginx, GitHub Actions.

## Current verified strengths

- [x] Auth, role, module, household, child, and CSRF boundaries exist.
- [x] Chore submit/review, homeschool CRUD/calendar, recipes, admin, notifications APIs, and mobile client exist.
- [x] Final local gates pass: backend 182, frontend 126, mobile 15, shared contracts 14, isolated Playwright 9.
- [x] Production service/readiness and authenticated desktop/mobile route crawl are healthy.

## Phase 0 — Safety and tracking

- [x] Create integrity-checked pre-hardening SQLite online backup under `/var/backups/chore-tracker/`.
- [x] Create this one active audit-remediation tracker.
- [x] Link this tracker from README and classify dated plans as historical/reference.
- [x] Preserve real Dad/A/V/W, recipes, and intended household/admin accounts before fixture cleanup.

## Phase 1 — Schema authority and CI

- [x] RED: fresh Alembic migration test asserts every model table and critical constraints/indexes.
- [x] Add a complete frozen core baseline migration/upgrade path.
- [x] Remove production reliance on `Base.metadata.create_all()` as schema authority while preserving test/bootstrap ergonomics explicitly.
- [x] Verify empty install, existing production-schema upgrade, and representative data preservation.
- [x] Expand CI to full backend, migration, frontend lint/test/build, shared contracts, mobile typecheck/tests, and dependency scans.

## Phase 2 — Push and notification security/operations

- [x] RED: reject non-HTTPS, loopback, private, link-local, reserved, metadata, DNS-rebinding/redirect push endpoints.
- [x] Enforce bounded connect/read timeout and payload size.
- [x] Move push delivery outside request/database transactions with durable queued attempts and retry bounds.
- [x] Fix notification click links for `/chore/` base path.
- [x] Enforce approval toggle, due-soon setting, daily digest time, quiet hours, user/household timezone, and disabled states.
- [x] Add systemd reminder/delivery timer and verify generated notification plus push-attempt readback.
- [ ] Make Notifications a global inbox with module-scoped preferences; add initial Homeschool/admin events or clearly scope unsupported modules.

## Phase 3 — Authorization and workflow integrity

- [x] RED: `can_view=true, can_manage=false` permits reads and denies every unsafe route.
- [x] Add explicit view/manage dependencies and route matrix coverage.
- [x] RED: concurrent/shared chore approvals produce one canonical occurrence and at most one linked reward.
- [x] Add occurrence identity, database uniqueness, atomic item claiming, and transaction source linkage/idempotency.
- [x] Preserve PER_CHILD, rotation, timeout, rejection, and zero-reward semantics.

## Phase 4 — Session/auth/security hardening

- [x] RED: copied token expires after configured max age and fails after logout/password/reset revocation.
- [x] Add timestamped, revocable sessions with per-session metadata and account-wide revocation on credential/security changes.
- [x] Add bounded login throttling for parent/child login and structured security audit events.
- [x] Normalize child-login failure behavior without losing duplicate-name recovery UX for authenticated admins.
- [x] Add nginx static security headers and CSP; trust forwarded scheme only at the known proxy boundary.
- [x] Bound nested/bulk recipe payloads and strengthen cross-household consistency checks.
- [x] Upgrade and lock affected Python/npm dependencies; verify audits and compatibility.

## Phase 5 — Production hygiene and resilience

- [x] Build dry-run cleanup inventory and explicit preserve/delete allowlists.
- [x] Delete disposable smoke/QA/E2E households and orphaned records after backup.
- [x] Remove inactive smoke child and smoke-only records from the preserved Dad household without touching A/V/W or recipes.
- [x] Verify foreign keys, integrity check, real-account login, counts, chores, recipes, homeschool, and admin readback.
- [x] Add isolated E2E database/namespace plus guaranteed cleanup so deployed smoke cannot pollute production.
- [x] Add daily online SQLite backup timer, retention, integrity check, alerting, and restore rehearsal.

## Phase 6 — Product contract and household model

- [x] Declare Family Manager no-finance direction or fully implement allowance; remove contradictory dead UI either way.
- [x] Remove balance/report placeholders and implementation-facing household IDs.
- [x] Make household cookbook ownership explicit with creator attribution and edit rights; migrate existing recipes safely.
- [ ] Consolidate account/security operations: child profile operations vs credential/admin operations.
- [x] Remove permission-inappropriate and placeholder production links.
- [x] Pick `family.multihost.ing` as canonical and redirect the legacy host while preserving paths.
- [ ] Update README/current scope, route matrix, module descriptions, and archive/label stale plans.

## Phase 7 — Task-first web/mobile UX

- [ ] Add backend/client Today projection covering approvals, chores due, homeschool logging, unread alerts, and recipe shortcuts.
- [x] Make parent Home a cross-module action queue with one primary action per item.
- [ ] Replace flat mobile nav-chip wall with compact primary navigation plus overflow/settings.
- [ ] Simplify Chores to one today-submission model; move setup/history into tabs/disclosures.
- [ ] Split Homeschool into Review, Daily Log, and Setup; remove stale implementation copy.
- [ ] Put cookbook content before advanced import/filter/backup controls.
- [ ] Verify role-specific desktop/mobile layouts, accessibility names, no horizontal overflow, and lower above-fold action load.

## Phase 8 — Maintainability and coverage

- [ ] Decompose remaining 700–1,400-line web/mobile screens/styles into feature-owned components/hooks/tokens without behavior drift.
- [ ] Share remaining request/error/CSRF mechanics through `packages/family-api` while preserving platform session adapters.
- [ ] Remove frontend module fail-open presentation on module-load errors.
- [ ] Add Playwright coverage for Homeschool, Admin permissions, Notifications, recipe import/delete/backup, and one cross-module family-day flow.
- [x] Eliminate React test `act(...)` warnings and adopt React Router future flags or upgrade safely.

## Phase 9 — Household subscriptions, ownership, and platform operations

### Approved authority model

- [ ] Add exactly one explicit, transferable `owner_user_id` to each household; migrate existing households by a deterministic, reviewed rule and reject ownerless or cross-household ownership.
- [ ] Keep `PARENT_ADMIN` as a household operations role, not ownership: parent admins may manage children, parent logins, and modules but cannot transfer ownership, delete the household, or change/cancel billing unless separately delegated by the household owner.
- [ ] Add a backend-generated household billing-account identity that survives email changes, device changes, parent changes, and future iOS support.
- [ ] Add an audited ownership-transfer workflow requiring an eligible active parent, explicit confirmation, session reauthentication, and rollback-safe database constraints.
- [ ] Keep platform identities in a separate authentication/authorization domain from `PARENT_ADMIN`, `PARENT`, and `CHILD`; platform roles must never gain household content access merely by having an operations role.

### Subscription and entitlement foundation

- [ ] Start with one household-wide `Family Plus` entitlement offered as monthly and annual products, plus an optional trial; keep provider product IDs mapped through configuration rather than scattered through clients.
- [ ] Integrate Google Play purchases through RevenueCat for Android and Stripe Billing for web checkout/customer portal; verify current store rules before launch and leave room for iOS without changing household identity.
- [ ] Add `billing_accounts`, provider-customer links, subscriptions, normalized idempotent billing events, and projected entitlements through Alembic migrations with household isolation and audit fields.
- [ ] Make the backend entitlement projection authoritative: provider webhooks report transactions, while every paid API capability enforces `entitlement AND module can_view/can_manage AND household/role authorization` server-side.
- [ ] Model trialing, active, grace period, billing retry, canceled-but-active, expired, refunded, and revoked states without deleting household data; define read-only/degraded behavior explicitly for expired plans.
- [ ] Add signed webhook verification, duplicate/out-of-order delivery handling, transactional projections, bounded retries, dead-letter visibility, and scheduled provider reconciliation.
- [ ] Add parent-owner billing APIs and UI for plan status, renewal date, purchase/checkout, restore purchases, billing portal, cancellation, and ownership transfer; children must never see billing controls or purchase prompts.

### Implemented provider-neutral slice

- [x] Add deterministic household-owner migration/backfill, ownership constraints, owner projection, and password-confirmed transfer with audit.
- [x] Add provider-neutral billing accounts, customer references, subscriptions, append-only billing events, projected household entitlements, and disabled Stripe/RevenueCat/Google Play adapter seams.
- [x] Add separate owner/support identities, cookies, CSRF boundary, mandatory TOTP login, revocable sessions, recent reauthentication, append-only audit, and secure bootstrap tooling.
- [x] Add finite, reasoned, idempotent complimentary grant/extension transactions restricted to `PLATFORM_OWNER`, with support denial and immutable event/audit readback.
- [x] Add redacted household lookup, case-linked support notes/reconciliation, separate `/ops` navigation, and owner-only complimentary controls.
- [x] Add household-owner subscription status on web and Android while hiding billing status and controls from non-owners and children.
- [ ] Enable live checkout, store/webhook processing, refunds, provider reconciliation/dead-letter operations, and paid-entitlement enforcement only after provider accounts, credentials, and final product policy exist.

### Platform owner role

- [ ] Add a separately authenticated `PLATFORM_OWNER` role with mandatory MFA, short/revocable sessions, reauthentication for destructive actions, and complete audit logging.
- [ ] Give platform owners authority to manage platform operators, subscription products/mappings, provider configuration references, entitlement policy, refunds/revocations, complimentary access policy, household suspension/deletion workflows, reconciliation, and global operational settings.
- [ ] Build a protected `/ops` owner console covering households, subscription lifecycle, entitlements, provider linkage, failed webhooks, reconciliation, audit history, and operational health without exposing payment credentials or secrets.

### Least-privilege support role

- [ ] Add a separate `PLATFORM_SUPPORT` role; it may search customers/households, view contact/account metadata, view plan/subscription/entitlement state, inspect redacted provider identifiers and webhook/reconciliation outcomes, add support notes, and invoke explicitly safe retry/reconciliation actions.
- [ ] Deny support access to platform-user/role management, product pricing/configuration, provider secrets, raw payment instruments, refunds, permanent complimentary grants, entitlement-policy edits, household ownership transfer, account deletion/export, and global operational settings.
- [ ] Deny support access to child details and private chores, homeschool, recipes, notifications, or other household content by default. Any exceptional content access or impersonation must use an owner-approved, case-linked, time-limited break-glass grant with visible reason, automatic expiry, and audit trail.
- [ ] Require support actions to include a case/reason where they affect customer state; make support notes append-only/audited and keep sensitive values redacted in UI, logs, exports, and API responses.
- [ ] Add a permission matrix and negative tests proving `PLATFORM_SUPPORT` cannot call owner-only or household-content endpoints, cannot widen its own permissions, and cannot cross support-case scope.

### Operations, verification, and release gates

- [ ] Add sandbox fixtures and deterministic tests for purchase, renewal, cancellation, grace period, expiration, refund/revocation, restore purchase, duplicate/out-of-order webhooks, failed reconciliation, household ownership transfer, and cross-household denial.
- [ ] Add owner/support end-to-end journeys proving separate navigation, least privilege, MFA/reauthentication, redaction, audit events, safe retries, and break-glass expiry; include direct API negative tests rather than relying on hidden UI.
- [ ] Add billing/provider dashboards, alerts, reconciliation metrics, webhook dead-letter alerts, runbooks, backup/restore coverage, and credential-rotation procedures.
- [ ] Independently review billing correctness, authorization, privacy, provider-policy compliance, and support-role boundaries before enabling real purchases.
- [ ] Launch behind a feature flag; prove sandbox Android and web purchases against the deployed app, then perform a controlled production rollout with provider/backend readbacks and rollback steps.

## Phase 10 — Household-wide module controls

- [x] RED: prove only `PARENT_ADMIN` users with Admin manage access can read or change household-wide module state.
- [x] Make a disabled household module a backend-authoritative ceiling that per-user grants cannot bypass.
- [x] Prevent disabling the Admin module so every household retains an administrative recovery path.
- [x] Add audited household module list/update APIs and aligned shared contracts.
- [x] Add clearly separated global module toggles to the web Admin Dashboard, with pending, retry, error, and success states.
- [x] Add equivalent accessible module management to Android and refresh effective navigation after changes.
- [ ] Run backend, shared, frontend, mobile, browser, CI, independent review, deployment, and live readback gates.

## Release gates

- [ ] Independent spec and security/code-quality reviews have no open Critical/High findings.
- [x] `git diff --check` passes.
- [x] Full backend, frontend lint/test/build, shared, and mobile gates pass on final revision.
- [x] Fresh-install and production-copy migration rehearsals pass.
- [x] Dependency audits have no untriaged high/critical runtime findings.
- [ ] PR CI passes and PR is merged; main CI passes on the squash/merge commit.
- [ ] Production migration, frontend build, service/timers, and nginx config deploy successfully.
- [ ] Public health, authenticated API readbacks, and desktop/mobile Playwright journeys pass.
- [x] Production DB integrity, backup/restore, fixture cleanup, and real family data preservation are proven.
- [ ] 1920×1080 and 390×844 screenshots show task-first Home, Chores, Homeschool, Recipes, Notifications, and Admin with no console/page/network errors.
