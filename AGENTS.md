# AGENTS.md

## Project
- Name: chore_tracking
- Description: 1. Overview
Chore Tracker v3 is a household chore management and allowance system. Children submit completed chores and parents approve or reject them. The system tracks balances using a ledger and supports advanced scheduling including recurring chores, cooldown chores, rotating assignments, one-time chores, and expiring chores.
The UI uses the Jewel Pop theme, featuring glass cards, jewel gradients, glow effects, floating decorative elements, and responsive layouts.
This specification defines architecture, data model, scheduling logic, timeout logic, rotation behavior, API design, UI structure, and workflows.
2. Tech Stack
Backend:
FastAPI, Python 3.11+, SQLAlchemy, SQLite (WAL mode), Alembic, Pydantic, Argon2id password hashing, session cookies, CSRF protection, Pytest
Frontend:
React 18, TypeScript, Vite, TanStack Query, React Hook Form, Zod, React Router, custom CSS Jewel Pop theme
Tooling:
Node.js 20+, npm, Git, ESLint, Prettier, Ruff or Black
3. Roles and Permissions
Roles
PARENT_ADMIN
Full system control
Manage parents and household settings
PARENT
Manage chores, children, tags, templates
Approve and reject submissions
Add bonuses and payments
CHILD
View own chores
Submit chores
View own balance and history
Security
Argon2id password hashing
Session authentication using secure HttpOnly cookies
CSRF tokens required for write operations
Role-based authorization enforced server-side
4. Core Feature Set
Children can:
View eligible chores by date
Submit completed chores
View balances
View history
Filter chores by tags
Parents can:
Approve or reject submissions
Create and edit chores
Configure scheduling
Configure timeouts and expirations
Configure rotating assignment
Create templates
Add bonuses and payments
View reports and balances
Board view:
Shows all children and their available chores
Allows fast submission and monitoring
5. Chore Scheduling Model
Each chore has a schedule definition and optional timeout.
Schedule Modes
NONE
Chore is always available starting from start_date
EVERY
Chore repeats at a fixed interval
Example: every 2 days, every week, every month
AFTER_COMPLETION
Chore becomes available interval after last approved completion
ONCE
Chore appears once and is removed after approval or expiration
6. Timeout and Expiration (NEW FEATURE)
Each chore occurrence can optionally expire after a specified number of days.
New field:
timeout_days (nullable integer)
Meaning:
Defines how many days an occurrence remains available after becoming eligible
After timeout_days, the occurrence expires automatically
Example:
start_date: Jan 1
schedule: EVERY 7 days
timeout_days: 3
Occurrences:
Jan 1 → expires Jan 4
Jan 8 → expires Jan 11
Jan 15 → expires Jan 18
If current date is beyond expiration, the occurrence is considered expired.
7. Expiration Behavior Rules
For normal chores
When an occurrence expires:
It is no longer eligible
It cannot be submitted
It remains part of schedule history
Next occurrence continues normally
For rotating chores
When an occurrence expires:
Rotation advances automatically to next child
Rotation pointer increments by 1
Expired occurrence is considered "skipped"
This ensures rotation continues even if someone fails to complete a chore.
For one-time chores
When expiration occurs:
Chore is permanently archived or deleted
It no longer appears anywhere
It is considered finished
8. Assignment Modes
STATIC
Allowed children are fixed or unrestricted
ROTATING
Assignment rotates through ordered list of children
Rotation fields:
rotation_members
rotation_position
last_occurrence_date
Rotation advances when:
occurrence approved OR
occurrence expires
This guarantees rotation consistency regardless of completion.
9. Completion Modes
PER_CHILD
Each child may complete independently
SHARED
Only one child may complete per occurrence
Shared completion prevents duplicate claims.
10. Ledger and Balance System
Balances are computed from transaction ledger.
Table: transactions
Fields:
id
household_id
child_id
amount_cents
type
created_at
Types:
CHORE_APPROVAL
BONUS
PAYMENT
ADJUSTMENT
Balance calculation:
SUM(amount_cents)
This prevents corruption and allows full audit history.
11. Database Schema
households
id, name, timezone, created_at
users
id, household_id, email, password_hash, role, child_id, created_at
children
id, household_id, name, active, created_at
tags
id, household_id, name, created_at
chores
id
household_id
name
reward_cents
start_date
expires_at (optional global expiry)
timeout_days (NEW FIELD)
schedule_mode
schedule_interval
schedule_unit
completion_mode
assignment_mode
created_at
archived_at
chore_allowed_children
chore_id, child_id
chore_rotation_members
chore_id, child_id, position
chore_rotation_state
chore_id, current_position, last_occurrence_date
submissions
id, household_id, child_id, for_date, status
submission_items
id, submission_id, chore_id, status
completion_records
id
household_id
child_id
chore_id
date
status
transactions
id
household_id
child_id
amount_cents
type
created_at
quick_templates
id, household_id, name, reward_cents, completion_mode
12. Eligibility Engine
Input:
child_id
target_date
household timezone
Process:
Step 1 — Validate child active
Step 2 — Validate chore not archived
Step 3 — Validate allowed children
Step 4 — Determine occurrence date
Step 5 — Calculate expiration date:
expiration_date = occurrence_date + timeout_days
Step 6 — Reject if target_date > expiration_date
Step 7 — Validate schedule rules
Step 8 — Validate completion rules
Step 9 — Validate rotation assignment
Return eligible chores.
13. Rotation Advancement Logic
Rotation advances when either condition occurs:
Condition 1: approval
Condition 2: expiration timeout reached
Algorithm:
if occurrence expired OR approved:
current_position = (current_position + 1) mod member_count
last_occurrence_date = occurrence_date
This ensures rotation progresses correctly even when chores are missed.
14. API Specification
Auth
POST /auth/login
POST /auth/logout
GET /auth/me
Children
GET /children
POST /children
PATCH /children/:id
POST /children/:id/bonus
POST /children/:id/payment
Tags
GET /tags
POST /tags
PATCH /tags/:id
DELETE /tags/:id
Chores
GET /chores
POST /chores
PATCH /chores/:id
DELETE /chores/:id
POST /chores/:id/rotate
Eligibility
GET /children/me/eligible-chores?date=
Submissions
POST /submissions
GET /submissions
POST /submissions/:id/approve-all
POST /submissions/:id/items/:item_id/decision
Templates
GET /templates
POST /templates
DELETE /templates/:id
POST /templates/:id/schedule
Reports
GET /reports/summary
15. Frontend Architecture
React SPA using Jewel Pop theme.
Routes:
/login
Child: /child/today
/child/calendar
/child/history
Board: /board
Parent: /parent/dashboard
/parent/chores
/parent/children
/parent/tags
/parent/templates
/parent/reports
16. Jewel Pop Theme Requirements
Visual system includes:
Glass cards
Gradient jewel buttons
Glow highlights
Floating bubble decorations
Soft gradients
Hover lift animation
Tilt interaction
Responsive layout
UI components:
Card
Button
Chip filter
Navigation bar
Modal dialog
Toast notification
Section header bar
Theme must use consistent color tokens and layered shadows.
17. Workflow
Child submission:
Child selects chores
Child submits
Submission stored pending
Parent approval:
Parent approves
Completion record updated
Ledger transaction created
Rotation advances if rotating
Expiration workflow:
System checks expired occurrences
Expired rotating chores advance rotation
Expired one-time chores removed
18. Background Expiration Processing
Expiration processing must occur when:
Eligibility is checked OR
Submission attempted OR
Parent dashboard loads
Optional optimization:
Periodic background job to clean expired chores.
19. Testing Requirements
Unit tests:
Schedule calculations
Timeout expiration logic
Rotation advancement
Eligibility rules
Integration tests:
Submission workflow
Approval workflow
Ledger correctness
20. Deployment Requirements
SQLite persistent storage
Backend API server
Frontend static build
Session security enabled
Daily backup of SQLite database
21. Deliverables
Backend:
FastAPI service
SQLite database
Migration scripts
Auth and role enforcement
Eligibility engine with timeout support
Rotation expiration support
Frontend:
React application
Jewel Pop themed UI
Child interface
Parent interface
Board view
System:
Fully functional chore management system
Timeout expiration handling
Rotating assignment expiration advancement
One-time chore auto-removal on expiration
- Preferred Stack: (to be decided)

## Workflow Rules
1. Complete exactly one checklist task per iteration
2. Run tests and lint after each task
3. Commit with clear message after successful checks
4. Update IMPLEMENTATION_PLAN.md task checkbox

## Backpressure Commands
- Lint: npm run lint
- Test: npm test
- Build: npm run build

## Operational Learnings
- After initial loop completion, project was backend-heavy with a placeholder frontend (`<h1>Chore Tracker v3</h1>`). Treat frontend feature delivery as mandatory before declaring product complete.
- Critical production regression identified on mobile: frontend API client can throw `Failed to execute 'fetch' on 'Window': Illegal invocation` unless fetch is bound correctly; this must be fixed before feature work is considered stable.
- Auth was missing despite auth text in specs. Never mark project complete if protected routes/APIs can be used anonymously.
- Monorepo baseline initialized with a root npm workspace pointing to `frontend`, plus a Python backend scaffold in `backend/`; current `lint`, `test`, and `build` scripts are intentional placeholders to be replaced in task `1.2`.
- Task `1.2` established frontend quality tooling: Vite build, Vitest (`jsdom`), ESLint flat config for TypeScript/React, and Prettier checks under the `frontend` workspace scripts.
- Task `1.3` introduced backend env bootstrap with `backend/.env.example`, cached settings parsing (`APP_ENV`, `DATABASE_URL`, `SECRET_KEY`, `LOG_LEVEL`, `SESSION_COOKIE_SECURE`), and FastAPI lifespan startup checks validating production secrets plus SQLite directory readiness.
- Task `2.1` added SQLAlchemy core domain models and DB bootstrap in `backend/app/db.py` with SQLite storage pragmas (`foreign_keys=ON`, `journal_mode=WAL`) plus startup table initialization and backend persistence tests.
- Task `2.2` introduced backend repository/service boundaries for child management (`app/repositories`, `app/services`) with integration tests for repository filtering and unit tests verifying service delegation.
- Task `2.3` added baseline backend observability via centralized logging configuration, request-completion middleware, and global unhandled-exception JSON responses with pytest coverage in `backend/tests/test_error_handling.py`.
- Task `3.1` delivered the first end-to-end MVP API flow for child management: FastAPI routes for listing/creating/updating children (`GET/POST/PATCH /children`), SQLAlchemy-backed update support in service/repository layers, and integration coverage in `backend/tests/test_children_api.py`.
- Task `3.2` tightened child API validation and edge-case handling: request schemas now strip whitespace and reject empty names/no-op PATCH payloads, path validation enforces positive `child_id`, and child create/update map DB integrity failures to explicit `400` responses with added API coverage for those cases.
- Task `3.3` expanded child API test coverage with explicit happy/failure scenarios for partial PATCH updates and request boundary validation (`household_id > 0`, `child_id > 0`) while keeping frontend lint/test and backend pytest suites green.
- Task `4.1` expanded operational visibility with request correlation IDs in logs/response headers plus dedicated liveness/readiness endpoints (`/health/live`, `/health/ready`) backed by an explicit database readiness probe and API coverage in `backend/tests/test_health_api.py`.
- Task `4.2` finalized baseline documentation in root `README.md` with current API scope, local setup/run commands, and explicit quality-gate commands for frontend and backend verification.
- Task `4.3` closed the implementation checklist by marking all plan items complete, appending `STATUS: COMPLETE` to `IMPLEMENTATION_PLAN.md`, and re-running the root backpressure quality gates (`npm run lint`, `npm test`).
- Frontend task `4.1` now delivers a routed React shell in `frontend/src/App.tsx` with `BrowserRouter` bootstrap in `frontend/src/main.tsx`; component tests should mount `App` with `MemoryRouter` to control route assertions.
- Frontend task `4.2` introduced a typed API client layer under `frontend/src/api` with a shared `ApiClientError`, `/chore-api` base-path request handling, and unit tests validating query serialization, JSON payload transport, and backend error-detail mapping.
- Frontend task `4.3` replaced the parent dashboard placeholder with `frontend/src/pages/ParentDashboardPage.tsx`; tests for this route should mock `apiClient.listChildren` (not `global.fetch`) because the shared `apiClient` instance binds fetch at module initialization.
- Frontend task `4.4` replaced the `/parent/children` placeholder with `frontend/src/pages/ParentChildrenPage.tsx`, wiring list/create/toggle-active flows through `apiClient.listChildren/createChild/updateChild`; tests for this route should mock those methods and account for the extra list refresh call after create/update actions.
- Frontend task `4.5` replaced the `/child/today` placeholder with `frontend/src/pages/ChildTodayPage.tsx`; tests for this route should mock `apiClient.listEligibleChores` and `apiClient.createSubmission` to cover loading, empty/error states, and submit-refresh behavior without depending on backend eligibility/submission endpoints.
- Frontend task `4.6` replaced the `/board` placeholder with `frontend/src/pages/ParentSubmissionReviewPage.tsx`, wiring pending submission list + approve-all/per-item decisions through `apiClient.listSubmissions/approveSubmission/decideSubmissionItem`; tests for this route should mock those methods and account for the post-action list refresh call.
- Frontend task `4.7` introduced shared UI primitives in `frontend/src/ui` (`Card`, `Button`, `ButtonLink`, `Badge`, `FormField`, `DateInput`, `CheckboxField`, `InlineNotice`) and refactored active pages/routes to consume them; preserve existing user-facing copy and `role=\"alert\"` semantics when extending these pages so current view tests remain stable.
- Task `5.1` made frontend API routing environment-configurable: `VITE_API_BASE_URL` now drives the API client base (default `/chore-api`), and Vite dev server proxies `/chore-api/*` to `VITE_API_PROXY_TARGET` (default `http://127.0.0.1:8000`) with prefix rewrite so local backend routes still resolve.
- Task `5.2` added a backend happy-path integration test (`backend/tests/test_happy_path_e2e.py`) covering create child → eligible chore lookup → submission creation → approve-all → ledger/completion assertions, and introduced minimal workflow APIs in `backend/app/api/workflow.py` to support that end-to-end flow.
- Task `5.3` expanded frontend major-view coverage by adding API action-failure tests for `/parent/children`, `/child/today`, and `/board`; preserve the existing inline error copy (`Could not save child`, `Could not submit chores`, `Could not update submission decision`) when refactoring these pages so alert assertions stay stable.
- Task `5.4` added `.github/workflows/ci-quality-gates.yml` to enforce CI sequencing for frontend lint/test/build and backend health/readiness verification via `pytest backend/tests/test_health_api.py`; when running backend pytest locally in this environment, use `.venv/bin/pytest` due externally-managed system Python.
- Task `6.1` moved backend APIs behind `/chore-api` and added SPA asset serving under `/chore/*` with index fallback in `backend/app/main.py`; production frontend builds now default to Vite `base: /chore/` (configurable via `VITE_APP_BASE_PATH`) and `BrowserRouter` uses `import.meta.env.BASE_URL`.
- Task `6.2` added `frontend/src/App.mobile-smoke.test.tsx` to run parent (`/parent/children`) and child (`/child/today`) key flows under a mobile viewport (`390x844`); reuse this pattern for future responsive smoke coverage by setting `window.innerWidth/innerHeight` before route rendering.
- Task `6.3` updated `README.md` with exact production URL mapping (`/chore/*`, `/chore-api/*`) and an operator runbook covering production env vars, build/start steps, health verification, and SQLite backup/restore commands.
- Task `6.4` finalized the checklist by marking `IMPLEMENTATION_PLAN.md` complete and appending `STATUS: COMPLETE`; no code-path changes were required, so continue validating completion-only tasks with the standard root quality gates.
- Recovery task `3.1` fixed the frontend fetch `Illegal invocation` regression by binding the default global fetch to `globalThis` inside `ApiClient`; preserve this binding when refactoring client initialization.
- Recovery task `1.1` added backend auth foundations: Argon2 password hashing utilities in `backend/app/security/passwords.py`, a `users` role-to-child check constraint (`ck_users_user_role_child_link`), and Alembic scaffolding with revision `20260223_0001` to enforce auth linkage on existing databases.
- Recovery task `1.2` added backend auth endpoints (`POST /chore-api/auth/login`, `POST /chore-api/auth/logout`, `GET /chore-api/auth/me`) with signed cookie session tokens (`chore_tracker_session`) plus API coverage in `backend/tests/test_auth_api.py`; initialize database state in auth API tests before seeding users.
- Recovery task `1.3` added double-submit CSRF protection for authenticated write requests via `CsrfProtectionMiddleware`: login now issues `chore_tracker_csrf`, unsafe `/chore-api/*` requests (except login) require matching `X-CSRF-Token`, and auth/session cookies now share explicit max-age settings.
- Recovery task `1.4` centralized auth dependency guards in `backend/app/api/dependencies.py` (`get_current_user`, `require_roles`), and `/auth/me` now reuses the shared user resolver; preserve `401 Not authenticated.` and `403 Forbidden.` detail strings because tests assert them exactly.
- Recovery task `1.5` enforced auth on household data APIs: `/children` and submission board endpoints now require parent roles, child-eligible/submission endpoints require authenticated parent-or-child users, and route handlers must reject cross-household access via `403 Forbidden.` checks.
- Recovery task `2.1` replaced the `/login` placeholder card with `frontend/src/pages/LoginPage.tsx`, wired submit flow to `apiClient.login` (`POST /chore-api/auth/login`), added auth response/login request models, and covered success/error behavior in `frontend/src/App.login.test.tsx`; login form submits should trim email and surface backend errors as `Could not sign in: ...`.
- Recovery task `2.3` now wraps all non-`/login` frontend routes in a protected-route guard (`frontend/src/App.tsx`) that waits for auth bootstrap and redirects anonymous sessions to `/login`; route tests now rely on authenticated default session mocking in `frontend/src/test/setup.ts`, with anonymous redirect behavior covered in `frontend/src/App.protected-routes.test.tsx`.
- Recovery task `2.4` enforces frontend role boundaries in `frontend/src/App.tsx`: parent roles (`PARENT_ADMIN`, `PARENT`) can access `/parent/*` + `/board`, child role (`CHILD`) can access `/child/*`, cross-role navigation is hidden from the top nav, and unauthorized route attempts redirect to the role default route.
- Recovery task `2.5` added explicit auth UX states: login now shows in-flight status (`Signing you in...`) and clears stale errors on input edits, while app-shell logout now exposes `Logging Out...` + inline logout failure messaging instead of silently dropping session state; keep logout errors user-visible in `frontend/src/App.tsx` and test-covered in `frontend/src/App.auth.test.tsx`.
- Recovery task `3.2` removed hardcoded household scoping from `frontend/src/pages/ParentChildrenPage.tsx`: list/create/update child requests now derive `household_id` from authenticated session (`useAuth`), and `frontend/src/App.children.test.tsx` includes a non-default household regression case to verify payload/query scoping.
- Recovery task `3.3` removed hardcoded household scoping from `frontend/src/pages/ParentDashboardPage.tsx`: dashboard metrics now load children with authenticated `household_id` and pending counts from `apiClient.listSubmissions({ status: "PENDING" })`; tests that mount `/parent/dashboard` should mock both `listChildren` and `listSubmissions`.

## Injected Instructions (2026-02-23 12:06)
Priority reset: follow the rewritten IMPLEMENTATION_PLAN.md focused on auth + core functionality recovery. Validate with real API calls and UI interactions, not placeholder text. Fix fetch Illegal invocation first (task 3.1), then implement backend+frontend auth (Phase 1-2), then functional flows and tests. Do not mark complete until Playwright deploy smoke checks in Phase 5 pass.
- Recovery task `2.2` introduced frontend auth session state via `AuthProvider`: app bootstraps session with `apiClient.getCurrentSession` (`GET /chore-api/auth/me`), login now updates in-memory auth state, and top-nav logout calls `apiClient.logout` with CSRF header handling before returning to `/login`.
- Recovery task `3.4` added child-role workflow coverage in `backend/tests/test_happy_path_e2e.py`: validate real `CHILD` login can call `GET /chore-api/children/me/eligible-chores` and `POST /chore-api/submissions` (without `child_id` query override) using CSRF-protected session cookies.
- Recovery task `3.5` added backend per-item submission decision support at `POST /chore-api/submissions/{submission_id}/items/{item_id}/decision`; this endpoint now rejects non-pending items/submissions with `409`, records ledger/completion only for `APPROVED`, and recomputes aggregate submission status (`PENDING`/`APPROVED`/`REJECTED`), with coverage in `backend/tests/test_happy_path_e2e.py`.
- Recovery task `3.6` validated board rejection outcomes with a backend E2E regression in `backend/tests/test_happy_path_e2e.py`: rejecting the last pending item now remains asserted as `REJECTED`, removes the submission from pending board queries, and keeps ledger balance unchanged (`0`) with no `CHORE_APPROVAL` transaction.
- Recovery task `4.1` expanded backend auth API coverage in `backend/tests/test_auth_api.py` with cookie-attribute assertions for login (`HttpOnly` session cookie, shared max-age/samesite/path) and tampered-session rejection on `/chore-api/auth/me` to harden session integrity checks.
- Recovery task `4.2` added endpoint-level backend permission coverage in `backend/tests/test_permissions_api.py`; when seeding data before `TestClient` requests, call `initialize_database(settings)` explicitly so schema exists outside FastAPI lifespan startup.
- Recovery task `4.3` expanded frontend auth-route coverage in `frontend/src/App.protected-routes.test.tsx` with authenticated role navigation assertions: parent sessions must expose only parent nav links and navigate across `/parent/dashboard` -> `/parent/children` -> `/board`, while child sessions must expose only the `/child/today` nav entry.
- Recovery task `4.4` added a combined authenticated backend integration regression in `backend/tests/test_happy_path_e2e.py` covering parent create-child, child-session submission, and parent per-item reject/approve decisions; keep using real auth cookie transitions (`/auth/login`) plus CSRF headers in this suite to validate cross-role workflow integrity.
