# Family Manager Modularization and Reuse Plan

**Date:** 2026-09-02  
**Scope:** Planning only; implementation must be delivered as small, independently reversible slices.  
**Baseline:** `master` at `9fd4615`.

## Progress Checklist

- [x] Inventory current structure and hotspots.
- [x] Separate completed refactor work from remaining work.
- [x] Define target boundaries, dependency direction, and measurable acceptance criteria.
- [ ] Phase 0: add architecture characterization and size/duplication reporting.
- [ ] Phase 1: split backend domain models without schema changes.
- [ ] Phase 2: decompose chore workflow and notification services.
- [ ] Phase 3: thin remaining backend routers.
- [ ] Phase 4: split the shared TypeScript contract by domain.
- [ ] Phase 5: decompose web feature pages.
- [ ] Phase 6: decompose mobile feature screens and styles.
- [ ] Phase 7: simplify module onboarding and remove compatibility shims.
- [ ] Run all release gates and update durable architecture documentation.

## Outcome

Increase cohesion and reuse without turning a family application into a framework project. Features should own their domain logic, route/screen files should orchestrate rather than implement whole features, and web/mobile should share contracts and pure domain helpers while retaining platform-specific transport, session, navigation, and presentation code.

### Measurable goals

- No production page, screen, router, or service should normally exceed 500 lines.
- Files above 350 lines require one clear responsibility and a documented reason not to split.
- Route and screen orchestrators should generally remain below 250-300 lines.
- Remove imports of private helpers across module boundaries.
- Keep dependency direction explicit and acyclic:
  - backend: `api -> services -> repositories/models`; never `services -> api`;
  - clients: `app/screen -> feature -> shared family-api`; never shared code importing app code;
  - UI primitives and pure domain helpers must not import route/screen modules.
- Each business rule has one authoritative implementation per runtime. Do not duplicate schedule, rotation, payload mapping, module metadata, or error parsing between peer consumers.
- Reduce obvious web/mobile pure-logic duplication by at least 50%, measured by the Phase 0 report and reviewed manually.
- Preserve API shapes, database schema, routes, `/chore/` and `/chore-api/` deployment paths, and user-visible behavior unless a separate behavior change is approved.

### Non-goals

- No microservices, plugin runtime, event bus, generic repository for every table, or dependency-injection framework.
- No shared web/mobile visual component library; React DOM and React Native have different presentation needs.
- No database normalization or endpoint redesign merely to make folders prettier.
- No conversion of server authorization into client module checks.
- No simultaneous rewrite of a whole feature.

## Security and Behavior Invariants

- Backend role, household ownership, child scoping, module access, CSRF/session rules, last-admin protection, recipe import SSRF controls, and billing/support authorization remain authoritative and explicit.
- Protected lookups must be scoped by household or owner; generic unscoped `get_by_id` helpers are prohibited for protected resources.
- Refactors preserve transaction boundaries, commit timing, status codes, error shapes, ordering, and serialization.
- Characterization tests must cover authorization failures as well as successful flows before logic moves.
- Client registries and navigation remain UX metadata, never security boundaries.

## Current State

### Completed foundation to preserve

- Backend already has `api`, `services`, `repositories`, `schemas`, `models`, and `security` layers.
- `packages/family-api` is used by both web and mobile for contracts, endpoint mechanics, and module metadata.
- Web/mobile platform adapters retain their own session and CSRF behavior.
- Recipe logic is already separated into importer, ownership, feedback, scaling, serialization, and service modules.
- Web has shared UI primitives, error formatting, chore components/helpers, and recipe payload mapping.
- Mobile has shared components, session/module hooks, navigation builders, theme support, and feature-local pure helpers.

### Remaining hotspots

| File | Approx. lines | Mixed responsibilities / coupling |
|---|---:|---|
| `mobile/src/screens/homeschool/HomeschoolScreen.tsx` | 1,017 | loading, mutations, five forms, overview, calendar navigation, validation, rendering |
| `mobile/src/screens/parent/ChoresScreen.tsx` | 1,014 | queries, form state, eligibility, CRUD, labels, rendering |
| `frontend/src/pages/ParentChoresPage.tsx` | 786 | orchestration plus several feature panels and mutation flows |
| `backend/app/models/core.py` | 719 | auth, registration, modules, chores, finance, homeschool, recipes, notifications |
| `packages/family-api/src/models.ts` | 706 | every public client contract in one barrel |
| `mobile/src/styles/layout.ts` | 634 | unrelated feature and shell styles |
| `frontend/src/pages/ParentChildrenPage.tsx` | 565 | child CRUD, account linking, finance actions, rendering |
| `backend/app/services/notifications.py` | 528 | preferences, creation, push delivery, scheduling, subscriptions |
| `mobile/src/screens/parent/ChildrenScreen.tsx` | 506 | child CRUD, account linking, financial actions, presentation |
| `backend/app/services/chores/workflow.py` | 389 | eligibility, scheduling, rotation, approvals, serialization |
| `backend/app/api/recipes.py` | 384 | improved but still owns many route orchestration paths |
| `backend/app/api/homeschool.py` | 384 | protected lookup policy, CRUD logic, serialization |
| `backend/app/api/chores.py` | 349 | validation, assignment synchronization, schedule logic, CRUD |

Concrete boundary leak: `services/notifications.py` imports the private `_eligible_chores_for_child` helper from `services/chores/workflow.py`.

## Target Structure

```text
backend/app/
  models/
    auth.py registration.py modules.py chores.py finance.py
    homeschool.py recipes.py notifications.py
  domains/chores/
    eligibility.py scheduling.py rotation.py submissions.py serialization.py
  services/notifications/
    preferences.py creation.py push.py reminders.py subscriptions.py
  services/homeschool/
    access.py semesters.py subjects.py attendance.py grades.py

packages/family-api/src/
  models/
    auth.ts modules.ts chores.ts finance.ts homeschool.ts
    notifications.ts recipes.ts account.ts support.ts index.ts
  endpoints/
    core.ts recipes.ts notifications.ts support.ts index.ts
  client-core.ts modules.ts index.ts

frontend/src/features/<feature>/
  components/ hooks/ lib/ api.ts

mobile/src/features/<feature>/
  components/ hooks/ lib/ styles.ts
```

This is a target boundary map, not a requirement to create empty folders or one-file abstractions.

## Phase 0 — Guardrails and Characterization

### Slice 0.1: architecture and hotspot reporting

Create:

- `scripts/architecture-report.py`
- `backend/tests/test_architecture_boundaries.py`

Modify:

- `package.json` to add a non-blocking `architecture:report` command.
- `.github/workflows/ci-quality-gates.yml` to upload/report results without imposing arbitrary hard failures initially.

The report lists production files above 350/500 lines, private cross-module imports, forbidden dependency directions, and duplicated exported contract names. Check in a baseline allowlist with an owner and removal phase for each exception.

Verification:

```bash
python3 scripts/architecture-report.py
cd backend && pytest -q tests/test_architecture_boundaries.py
```

Rollback: remove the reporting step; no runtime code changes.

### Slice 0.2: behavior characterization

Add focused tests before moving code:

- chore eligibility, cooldown, timeout, shared completion, rotation, approval, and child scoping;
- notification preferences, quiet hours, retry/backoff, gone subscriptions, and daily reminders;
- homeschool cross-household access and CRUD status/error shapes;
- web/mobile current screen flows and payloads.

Modify existing feature test files where coverage naturally belongs; avoid a single refactor mega-test.

## Phase 1 — Split Backend Models by Domain

Move SQLAlchemy declarations from `backend/app/models/core.py` into domain files listed in the target structure. Preserve table names, columns, relationships, metadata registration, and Alembic output exactly.

Compatibility strategy:

- Keep `models/core.py` as a temporary re-export shim.
- Update production imports domain-by-domain, then tests and scripts.
- Delete the shim only when `rg 'app.models.core'` returns no production, test, migration, or script imports.
- `alembic check` must report no schema operations.

Tests/verification:

```bash
cd backend
pytest -q tests/test_models.py tests/test_alembic_migrations.py tests/test_db.py
alembic check
python -c "from app.models import ALL_MODELS; print(len(ALL_MODELS))"
```

Each domain move is its own commit and rollback point: auth/registration, modules, chores/finance, homeschool, recipes, notifications.

## Phase 2 — Chore Workflow and Notifications

### Slice 2.1: public chore eligibility boundary

Create `backend/app/domains/chores/eligibility.py` with a public, scoped `eligible_chores_for_child(...)`. Move schedule calculations to `scheduling.py` and rotation decisions to `rotation.py`. Keep persistence-changing approval/submission operations in `submissions.py`.

Modify:

- `backend/app/services/chores/workflow.py` as a temporary facade.
- `backend/app/api/workflow.py`.
- `backend/app/services/notifications.py` to use the public eligibility interface.

Never have notifications import a private chore helper again.

### Slice 2.2: split notification capabilities

Create the `services/notifications/` package shown above. Preserve a temporary `services/notifications.py` facade only if required for safe incremental imports; because a file and package cannot coexist cleanly under all tooling, perform the rename and facade conversion in one tested commit.

Dependency rules:

- `creation` may enqueue through a narrow delivery interface.
- `reminders` may call public chore eligibility.
- `push` owns sender/retry mechanics but not preference policy.
- `subscriptions` owns endpoint lifecycle.
- No notification submodule imports API routers.

Tests:

```bash
cd backend
pytest -q tests/test_notifications_api.py tests/test_notification_hardening.py tests/test_schedule_matrix.py tests/test_happy_path_e2e.py
```

## Phase 3 — Thin Backend Routers

Work one router per slice:

1. `api/chores.py`: move assignment synchronization, schedule validation, serialization, and protected lookups into chore domain services.
2. `api/homeschool.py`: create scoped access and domain CRUD services.
3. `api/recipes.py`: finish moving backup/import orchestration and serialization branches.
4. `api/ops.py`: separate support case, billing reconciliation, audit, and platform-user services without weakening privileged checks.

Routers retain FastAPI dependencies, request/response schemas, status codes, explicit authorization dependencies, transaction ownership, and obvious commit points. Services receive scoped IDs/current principals rather than discovering global context.

Acceptance per router:

- below 300 lines where practical;
- route handlers read as validate/authorize -> call service -> commit -> respond;
- existing API tests plus new service tests pass;
- no response-contract diff.

## Phase 4 — Split Shared TypeScript Contracts

Keep one package, `@family-manager/family-api`; do not create a package per feature.

### Slice 4.1: domain model files

Split `models.ts` into `models/*.ts`, retaining `models.ts` temporarily as a re-export compatibility barrel. Each domain file may import only foundational IDs/enums or an explicitly lower-level domain. Resolve cycles by extracting a small `common.ts`, not by using `any` or duplicating types.

### Slice 4.2: endpoint groups

Split `api-endpoints.ts` into `endpoints/core.ts`, `recipes.ts`, `notifications.ts`, and `support.ts`. Keep transport primitives in `client-core.ts`; web/mobile adapters retain cookies, CSRF, and base-URL policy.

Verification:

```bash
npx vitest run packages/family-api/src/**/*.test.ts --environment node
npm run lint --workspace frontend
npm run test --workspace frontend
npm run build --workspace frontend
npm run typecheck --workspace mobile
npm run test --workspace mobile
```

Delete old barrels only after `rg` shows no deep consumer dependency requiring them and both clients compile against the new public exports.

## Phase 5 — Web Feature Decomposition

### Slice 5.1: parent chores

Keep `ParentChoresPage.tsx` as the route orchestrator. Add:

- `features/chores/hooks/useChores.ts`
- `features/chores/hooks/useEligibleChores.ts`
- `features/chores/hooks/useChoreMutations.ts`
- focused components for filters, assignment/rotation fields, and status panels only where existing components remain too broad.

Do not create a hook that merely renames one `useState`. Extract cohesive state plus effects/mutations.

### Slice 5.2: children and finance actions

Create feature components/hooks for child CRUD, child account linking, and bonus/payment actions. Share pure validation/payload mapping with mobile through `family-api` only when it is genuinely platform-neutral; otherwise mirror presentation but reuse the contract.

### Slice 5.3: admin and recipes

Separate admin household/module/user panels and finish recipe organizer hooks/components. Route pages keep navigation and high-level flow.

For each slice, run the focused `App.*.test.tsx`, feature unit tests, frontend lint, full tests, and production build. Capture before/after screenshots only if markup or styling changes; decomposition should normally be visually identical.

## Phase 6 — Mobile Feature Decomposition

### Slice 6.1: homeschool

Break `HomeschoolScreen.tsx` into:

- `features/homeschool/hooks/useHomeschoolData.ts`
- `features/homeschool/hooks/useHomeschoolMutations.ts`
- `components/HomeschoolOverview.tsx`
- feature-owned semester, subject, attendance, comment, and grade sections;
- pure defaults, ID parsing, date, and validation helpers in `lib/`.

Keep the screen responsible for session/module gating, selected section, and composition.

### Slice 6.2: chores

Extract data/mutation hooks, existing form, eligibility panel, list/card rendering, and pure presentation logic. Use the same shared API contracts as web, but do not force DOM/Native component sharing.

### Slice 6.3: children and styles

Separate child management, account linking, and financial action components. Split `styles/layout.ts` into shell, forms, cards, navigation, and feature-owned styles while keeping common tokens centralized.

Verification per slice:

```bash
npm run typecheck --workspace mobile
npm run test --workspace mobile
```

Run Expo/mobile smoke coverage for navigation or behavior changes.

## Phase 7 — Module Onboarding and Cleanup

### Canonical manifest

Extend the existing shared/backend module contract rather than inventing a plugin runtime. Define one checked manifest containing key, labels, roles/default grants, platform support, frontend/mobile destinations, nav visibility, and dashboard availability. Backend permission enforcement remains code and database state, not generated client metadata.

Add a validator that fails when:

- backend and shared keys differ;
- an enabled platform lacks a route/navigation mapping;
- a nav-enabled module lacks a module guard;
- a requested dashboard card is unregistered;
- role/default metadata drifts.

Update `docs/standard-module-creation-guide.md` with the reduced onboarding sequence and a copyable checklist. Target: a normal module should require domain code plus one canonical manifest edit, not parallel metadata edits across three clients.

### Compatibility-shim deletion criteria

Delete a shim only when:

- repository search shows no remaining old-path imports;
- targeted and full tests pass without it;
- generated build output does not reference it;
- it has survived at least one independent implementation slice if external consumers may exist;
- its removal is called out in the commit and architecture report allowlist.

## Risk Controls and Commit Strategy

- One checkbox/slice per branch or clearly isolated commit; never mix model moves with UI decomposition.
- Characterization tests land before or with the move.
- Prefer re-export/facade transitions, then remove them deliberately.
- Run `git diff --check` after every slice.
- A failing behavior test triggers revert of that slice, not compensating changes elsewhere.
- Database model moves require an empty Alembic diff before merge.
- Shared-contract moves require web and mobile gates in the same commit.
- Router/service moves require focused security tests for cross-household, wrong-role, disabled-module, and child-scope cases.
- Before any merge/release, run `bash scripts/dev-gate --strict` or the repository-equivalent gates, `bash scripts/check-skills`, and `bash scripts/check-owasp` where present.

## Definition of Done

- Architecture report has no unexplained files above 500 lines and no forbidden/private cross-boundary imports.
- Giant mobile homeschool and chores screens are composition-focused and below 300 lines where practical.
- Web route pages are below 350 lines unless a documented cohesive exception exists.
- `models/core.py`, `models.ts`, notifications, and chore workflow monoliths are replaced by domain-owned modules; compatibility shims are removed.
- Backend routers are thin, scoped, and security-explicit.
- Module metadata passes one drift validator and onboarding documentation matches reality.
- Duplicate pure scheduling/payload/module/error mechanics have one authoritative implementation per runtime/shared package.
- Backend, shared package, frontend, mobile, lint, typecheck, build, migration, security, and relevant Playwright/smoke gates pass.
- No API, database, route, permission, or visible behavior regression is introduced.

