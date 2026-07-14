# Family Manager Hardening and Product Finish Tracker

> **For Hermes:** Execute this tracker with strict TDD and independent review. Mark boxes only after revision-specific tests, CI, deployment, and live proof.

**Goal:** Close the July 2026 architecture/security/operations audit, clean production hygiene, and turn the deployed chore-era shell into a coherent task-first Family Manager without removing working chores, homeschool, recipes, notifications, web, or mobile behavior.

**Architecture:** Alembic becomes the authoritative schema path; security-sensitive network/session/permission/workflow behavior receives explicit policy services and negative tests; production jobs use systemd timers; the parent home becomes a cross-module Today projection; secondary workflows use progressive disclosure. Existing `/chore/` and `/chore-api/` routes remain stable during this delivery, with one canonical public hostname.

**Tech stack:** FastAPI, SQLAlchemy, Alembic, SQLite/WAL, React/Vite, Expo/React Native, Pytest, Vitest, Playwright, systemd, nginx, GitHub Actions.

## Current verified strengths

- [x] Auth, role, module, household, child, and CSRF boundaries exist.
- [x] Chore submit/review, homeschool CRUD/calendar, recipes, admin, notifications APIs, and mobile client exist.
- [x] Baseline local gates pass: backend 138, frontend 123, mobile 15, shared contracts 14.
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

- [ ] RED: reject non-HTTPS, loopback, private, link-local, reserved, metadata, DNS-rebinding/redirect push endpoints.
- [ ] Enforce bounded connect/read timeout and payload size.
- [ ] Move push delivery outside request/database transactions with durable queued attempts and retry bounds.
- [ ] Fix notification click links for `/chore/` base path.
- [ ] Enforce approval toggle, due-soon setting, daily digest time, quiet hours, user/household timezone, and disabled states.
- [ ] Add systemd reminder/delivery timer and verify generated notification plus push-attempt readback.
- [ ] Make Notifications a global inbox with module-scoped preferences; add initial Homeschool/admin events or clearly scope unsupported modules.

## Phase 3 — Authorization and workflow integrity

- [ ] RED: `can_view=true, can_manage=false` permits reads and denies every unsafe route.
- [ ] Add explicit view/manage dependencies and route matrix coverage.
- [ ] RED: concurrent/shared chore approvals produce one canonical occurrence and at most one linked reward.
- [ ] Add occurrence identity, database uniqueness, atomic item claiming, and transaction source linkage/idempotency.
- [ ] Preserve PER_CHILD, rotation, timeout, rejection, and zero-reward semantics.

## Phase 4 — Session/auth/security hardening

- [ ] RED: copied token expires after configured max age and fails after logout/password/reset revocation.
- [ ] Add timestamped, revocable sessions with per-session metadata and account-wide revocation on credential/security changes.
- [ ] Add bounded login throttling for parent/child login and structured security audit events.
- [ ] Normalize child-login failure behavior without losing duplicate-name recovery UX for authenticated admins.
- [x] Add nginx static security headers and CSP; trust forwarded scheme only at the known proxy boundary.
- [ ] Bound nested/bulk recipe payloads and strengthen cross-household consistency checks.
- [ ] Upgrade and lock affected Python/npm dependencies; verify audits and compatibility.

## Phase 5 — Production hygiene and resilience

- [x] Build dry-run cleanup inventory and explicit preserve/delete allowlists.
- [x] Delete disposable smoke/QA/E2E households and orphaned records after backup.
- [x] Remove inactive smoke child and smoke-only records from the preserved Dad household without touching A/V/W or recipes.
- [x] Verify foreign keys, integrity check, real-account login, counts, chores, recipes, homeschool, and admin readback.
- [ ] Add isolated E2E database/namespace plus guaranteed cleanup so deployed smoke cannot pollute production.
- [x] Add daily online SQLite backup timer, retention, integrity check, alerting, and restore rehearsal.

## Phase 6 — Product contract and household model

- [ ] Declare Family Manager no-finance direction or fully implement allowance; remove contradictory dead UI either way.
- [ ] Remove balance/report placeholders and implementation-facing household IDs.
- [ ] Make household cookbook ownership explicit with creator attribution and edit rights; migrate existing recipes safely.
- [ ] Consolidate account/security operations: child profile operations vs credential/admin operations.
- [ ] Remove permission-inappropriate and placeholder production links.
- [x] Pick `family.multihost.ing` as canonical and redirect the legacy host while preserving paths.
- [ ] Update README/current scope, route matrix, module descriptions, and archive/label stale plans.

## Phase 7 — Task-first web/mobile UX

- [ ] Add backend/client Today projection covering approvals, chores due, homeschool logging, unread alerts, and recipe shortcuts.
- [ ] Make parent Home a cross-module action queue with one primary action per item.
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
- [ ] Eliminate React test `act(...)` warnings and adopt React Router future flags or upgrade safely.

## Release gates

- [ ] Independent spec and security/code-quality reviews have no open Critical/High findings.
- [ ] `git diff --check` passes.
- [ ] Full backend, frontend lint/test/build, shared, and mobile gates pass on final revision.
- [ ] Fresh-install and production-copy migration rehearsals pass.
- [ ] Dependency audits have no untriaged high/critical runtime findings.
- [ ] PR CI passes and PR is merged; main CI passes on the squash/merge commit.
- [ ] Production migration, frontend build, service/timers, and nginx config deploy successfully.
- [ ] Public health, authenticated API readbacks, and desktop/mobile Playwright journeys pass.
- [ ] Production DB integrity, backup/restore, fixture cleanup, and real family data preservation are proven.
- [ ] 1920×1080 and 390×844 screenshots show task-first Home, Chores, Homeschool, Recipes, Notifications, and Admin with no console/page/network errors.
