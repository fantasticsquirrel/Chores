# Implementation Plan (Auth + Core Functionality Recovery)

## Phase 0: Regression Triage (done)
- [x] 0.1 — Confirm deployed frontend exists at `/chore/` and backend health at `/chore-api/health`.
- [x] 0.2 — Reproduce core failures via browser automation (no auth enforcement, broken create-child flow).
- [x] 0.3 — Document root causes and convert into concrete implementation tasks.

## Phase 1: Authentication Foundation (backend)
- [x] 1.1 — Add auth data model/migrations (parent users + household-scoped credentials) with secure password hashing.
- [x] 1.2 — Implement auth service: login, logout, current-session (`/auth/login`, `/auth/logout`, `/auth/me`).
- [x] 1.3 — Implement secure session cookies + CSRF protection for write endpoints.
- [ ] 1.4 — Add role model enforcement (`PARENT_ADMIN`, `PARENT`, `CHILD`) and dependency guards.
- [ ] 1.5 — Protect all household data routes (children, chores, submissions, board) with auth dependencies.

## Phase 2: Frontend Auth & Route Protection
- [ ] 2.1 — Build real login form (email/password) on `/login` and wire to backend auth endpoints.
- [ ] 2.2 — Add auth state store + bootstrap (`/auth/me` on app load) and logout handling.
- [ ] 2.3 — Enforce protected routes: anonymous users must be redirected to `/login`.
- [ ] 2.4 — Add role-aware nav visibility and route access restrictions.
- [ ] 2.5 — Add login/logout/error UX states for mobile and desktop.

## Phase 3: Core Functionality Bug Fixes
- [x] 3.1 — Fix API client fetch invocation bug (`Illegal invocation`) by binding fetch correctly in all browsers.
- [ ] 3.2 — Verify and fix child creation/update forms (input wiring, payload shape, household scoping).
- [ ] 3.3 — Ensure parent dashboard and children pages actually load live data from `/chore-api`.
- [ ] 3.4 — Ensure child-today flow can fetch eligible chores and submit selected items successfully.
- [ ] 3.5 — Implement/fix submission decision endpoint used by board UI (`/submissions/{id}/items/{item_id}/decision`) and wire frontend.
- [ ] 3.6 — Validate board actions update statuses and balances correctly.

## Phase 4: Test Coverage for Auth + Flows
- [ ] 4.1 — Add backend auth tests (login success/failure, cookie/session, unauthorized access blocked).
- [ ] 4.2 — Add backend permission tests (role enforcement by endpoint).
- [ ] 4.3 — Add frontend tests for protected-route redirects and authenticated navigation.
- [ ] 4.4 — Add integration tests for create child, submit chore, approve/reject flow under authenticated session.
- [ ] 4.5 — Add regression test for API client fetch binding bug.

## Phase 5: Deploy + Verify
- [ ] 5.1 — Rebuild frontend and restart backend service.
- [ ] 5.2 — Smoke test with Playwright on deployed `/chore/`: login required, create child works, child submission works, board approval works.
- [ ] 5.3 — Verify anonymous access is blocked on protected pages and APIs return 401/403 correctly.
- [ ] 5.4 — Update README with auth setup, first parent bootstrap user flow, and production test checklist.
- [ ] 5.5 — Mark plan complete only after all auth and functional checks pass.
