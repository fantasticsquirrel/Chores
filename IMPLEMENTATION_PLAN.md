# Implementation Plan (Auth + Core Functionality Recovery)

## Phase 0: Regression Triage (done)
- [x] 0.1 — Confirm deployed frontend exists at `/chore/` and backend health at `/chore-api/health`.
- [x] 0.2 — Reproduce core failures via browser automation (no auth enforcement, broken create-child flow).
- [x] 0.3 — Document root causes and convert into concrete implementation tasks.

## Phase 1: Authentication Foundation (backend)
- [x] 1.1 — Add auth data model/migrations (parent users + household-scoped credentials) with secure password hashing.
- [x] 1.2 — Implement auth service: login, logout, current-session (`/auth/login`, `/auth/logout`, `/auth/me`).
- [x] 1.3 — Implement secure session cookies + CSRF protection for write endpoints.
- [x] 1.4 — Add role model enforcement (`PARENT_ADMIN`, `PARENT`, `CHILD`) and dependency guards.
- [x] 1.5 — Protect all household data routes (children, chores, submissions, board) with auth dependencies.

## Phase 2: Frontend Auth & Route Protection
- [x] 2.1 — Build real login form (email/password) on `/login` and wire to backend auth endpoints.
- [x] 2.2 — Add auth state store + bootstrap (`/auth/me` on app load) and logout handling.
- [x] 2.3 — Enforce protected routes: anonymous users must be redirected to `/login`.
- [x] 2.4 — Add role-aware nav visibility and route access restrictions.
- [x] 2.5 — Add login/logout/error UX states for mobile and desktop.

## Phase 3: Core Functionality Bug Fixes
- [x] 3.1 — Fix API client fetch invocation bug (`Illegal invocation`) by binding fetch correctly in all browsers.
- [x] 3.2 — Verify and fix child creation/update forms (input wiring, payload shape, household scoping).
- [x] 3.3 — Ensure parent dashboard and children pages actually load live data from `/chore-api`.
- [x] 3.4 — Ensure child-today flow can fetch eligible chores and submit selected items successfully.
- [x] 3.5 — Implement/fix submission decision endpoint used by board UI (`/submissions/{id}/items/{item_id}/decision`) and wire frontend.
- [x] 3.6 — Validate board actions update statuses and balances correctly.

## Phase 4: Test Coverage for Auth + Flows
- [x] 4.1 — Add backend auth tests (login success/failure, cookie/session, unauthorized access blocked).
- [x] 4.2 — Add backend permission tests (role enforcement by endpoint).
- [x] 4.3 — Add frontend tests for protected-route redirects and authenticated navigation.
- [x] 4.4 — Add integration tests for create child, submit chore, approve/reject flow under authenticated session.
- [x] 4.5 — Add regression test for API client fetch binding bug.

## Phase 5: Deploy + Verify
- [x] 5.1 — Rebuild frontend and restart backend service.
- [x] 5.2 — Smoke test with Playwright on deployed `/chore/`: login required, create child works, child submission works, board approval works.
- [x] 5.3 — Verify anonymous access is blocked on protected pages and APIs return 401/403 correctly.
- [x] 5.4 — Update README with auth setup, first parent bootstrap user flow, and production test checklist.
- [x] 5.5 — Mark plan complete only after all auth and functional checks pass.

STATUS: COMPLETE

---

# Family Manager Integration Plan

## Phase FM-0: Incremental shell + module scaffold (done)
- [x] Rename visible app shell copy to Family Manager while keeping existing `/chore/` and `/chore-api/` deployment routes stable.
- [x] Add role-default module registry for `chores`, `homeschool`, and `admin`.
- [x] Add authenticated `/modules/me` endpoint so the frontend can discover default visible modules.
- [x] Add frontend module scaffolding with `/homeschool` and `/admin/dashboard` placeholders.

## Phase FM-1: Database-backed module access
- [x] Add Alembic migration for `modules`, `household_module_access`, and `user_module_access`.
- [x] Seed default module catalog and preserve current role-based default access.
- [x] Replace role-default-only `/modules/me` logic with persisted household/user grants layered over safe role defaults.
- [x] Add admin APIs for viewing users and granting/revoking module access.

## Phase FM-2: Admin dashboard
- [x] Show household users and child-linked accounts in one dashboard.
- [x] Add module access matrix by user/child account.
- [ ] Move child account create/reset actions into the Family Manager admin experience.

## Phase FM-3: Homeschool data model
- [x] Add household-scoped homeschool tables for semesters, subjects, attendance, day comments, and grades.
- [x] Tie homeschool attendance records to existing `children.id` so child identity is shared with Chores.
- [x] Skip old Homeschool import utility by product decision; Jon will start Homeschool data fresh.

## Phase FM-4: Homeschool frontend integration
- [x] Port core Homeschool setup, attendance calendar, comments, grades, and semester summary UI into the Vite React app.
- [x] Replace standalone/Firebase/local-state persistence with Family Manager FastAPI endpoints for the implemented Homeschool scope.
- [x] Add backend and frontend tests for Homeschool workflows, module access, and setup record mutations.
- [ ] Add richer report/export generation after the first Family Manager PR.


STATUS: READY FOR PR REVIEW — `family-manager` keeps `/chore/` and `/chore-api/` routes stable, adds persisted modules/admin access, ports core Homeschool workflows, and has passing frontend/backend gates. Do not merge without Jon approval.
