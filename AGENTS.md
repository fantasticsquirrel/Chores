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
