# Family Manager Refactor and Modularization Implementation Plan

> **For Hermes:** Use subagent-driven-development skill for later phases if implementation is delegated task-by-task. Phase 1 may be implemented directly with strict TDD because it is a low-risk refactor-only slice.

**Goal:** Reduce code bloat, increase modularization, and standardize reusable code blocks while preserving all existing Family Manager / Chore Tracker functionality and server-side security boundaries.

**Architecture:** Refactor in layers from low-risk pure helpers to shared contracts, backend domain/service boundaries, and finally feature-level UI/mobile decomposition. Standardize mechanics such as formatting, query serialization, model definitions, and presentation helpers, but keep authorization, household ownership, CSRF/session handling, module access, and eligibility/approval policy explicit and test-covered.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, Pytest, React 18, TypeScript, Vite, Vitest, Testing Library, Expo/React Native, TypeScript compiler.

---

## Global Invariants for Every Phase

- No feature removal or behavioral weakening.
- Server-side role checks, household/owner checks, child account scoping, module access checks, CSRF requirements, last-admin protection, and recipe URL import protections must remain explicit and covered by tests.
- Frontend/mobile authorization and module gating remain UX aids only; backend policy remains authoritative.
- Each code-producing task follows RED-GREEN-REFACTOR where practical:
  1. Add a focused regression/characterization test.
  2. Run the test and verify it fails for the expected reason.
  3. Implement the smallest refactor to pass.
  4. Run targeted tests, then adjacent/full verification.
- Preferred verification commands:
  - Backend: `cd backend && pytest -q`
  - Frontend unit/lint/build: `npm run test --workspace frontend`, `npm run lint --workspace frontend`, `npm run build --workspace frontend`
  - Mobile: `npm run mobile:typecheck`, `npm run mobile:test`

---

## Phase 1 — Low-Risk Standardization and Pure Helper Extraction

**Goal:** Remove small repeated code blocks and extract pure display/form helpers without changing API behavior or page structure.

### Task 1.1: Add frontend shared error formatting

**Objective:** Replace repeated page-local `formatLoadError` / `formatError` / `formatAuthActionError` implementations with one tested helper.

**Files:**
- Create: `frontend/src/lib/errors.ts`
- Create: `frontend/src/lib/errors.test.ts`
- Modify: `frontend/src/pages/ParentDashboardPage.tsx`
- Modify: `frontend/src/pages/ParentChildrenPage.tsx`
- Modify: `frontend/src/pages/AdminDashboardPage.tsx`
- Modify: `frontend/src/pages/ParentChoresPage.tsx`
- Modify: `frontend/src/App.tsx`

**Test first:**
- Assert `formatApiError(new ApiClientError(503, "Service unavailable", {})) === "Service unavailable"`.
- Assert `formatApiError(new Error("Boom")) === "Boom"`.
- Assert `formatApiError({}) === "Request failed."`.
- Assert empty generic `Error("")` falls back to `Request failed.` if implemented that way.

**Verification:**
- `npm run test --workspace frontend -- --run src/lib/errors.test.ts`
- Existing page tests still pass.

**Security notes:**
- Do not convert 401/403 into redirects here. This helper only formats display text.
- Keep route protection and auth behavior in `App.tsx` / auth context unchanged.

### Task 1.2: Extract chore display labels and form parsing helpers

**Objective:** Move pure helpers out of the 1,227-line `ParentChoresPage.tsx` to feature-local library files.

**Files:**
- Create: `frontend/src/features/chores/lib/choreLabels.ts`
- Create: `frontend/src/features/chores/lib/choreLabels.test.ts`
- Create: `frontend/src/features/chores/lib/choreForm.ts`
- Create: `frontend/src/features/chores/lib/choreForm.test.ts`
- Modify: `frontend/src/pages/ParentChoresPage.tsx`

**Helpers to move:**
- `scheduleLabel`
- `completionLabel`
- `eligibilityLabel`
- `buildTimingLabel`
- `parseOptionalPositiveInteger`

**Test first:**
- Schedule labels for `NONE`, `ONCE`, `EVERY`, and `AFTER_COMPLETION`.
- Static assignment label for all children and named children.
- Rotating assignment label preserves order.
- Timing label covers `expires_at`, `timeout_days`, and both fields.
- Optional integer parser returns `null` for blank, parses positive integers, rejects zero/negative/non-numeric.

**Verification:**
- `npm run test --workspace frontend -- --run src/features/chores/lib/choreLabels.test.ts src/features/chores/lib/choreForm.test.ts src/App.parent-chores.test.tsx`

**Security notes:**
- These helpers are presentation/form UX only. Backend schemas remain authoritative.

### Task 1.3: Add module registry drift characterization tests

**Objective:** Make current registry drift explicit so later Phase 2 can change it safely.

**Files:**
- Create: `frontend/src/modules/registry.test.ts`
- Create or modify: `mobile/src/modules/registry.test.ts`
- Possibly modify: `mobile/src/navigation/tabs.test.ts` only if existing test helpers need updated module metadata.

**Test first:**
- Frontend registry contains `chores`, `homeschool`, `recipes`, `admin`.
- Frontend admin module remains PARENT_ADMIN-only.
- Mobile registry intentionally contains `chores`, `homeschool`, `admin` for the current release.
- Mobile tab builder does not show unsupported modules even if API returns them until Phase 2 formally adds platform metadata.

**Verification:**
- `npm run test --workspace frontend -- --run src/modules/registry.test.ts`
- `npm run mobile:test -- --run src/modules/registry.test.ts src/navigation/tabs.test.ts` if supported by workspace script, else `npm run mobile:test`.

**Security notes:**
- Registry tests must not imply client module lists are security controls.

### Task 1.4: Optional CSS token split with no selector changes

**Objective:** Prepare CSS modularization by moving theme custom properties into `frontend/src/styles/tokens.css` and importing it from app CSS.

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/app.css`
- Modify: `frontend/src/main.tsx` only if imports need to change.

**Test first:**
- No unit test needed for pure CSS movement if no selectors or declarations change.
- Verify by frontend build/lint.

**Verification:**
- `npm run lint --workspace frontend`
- `npm run build --workspace frontend`

**Security notes:**
- No UI permission state should depend solely on CSS. Do not hide/remove disabled controls as part of this task.

### Phase 1 Done Criteria

- Targeted tests pass.
- Full backend pytest still passes.
- Frontend lint/test/build pass.
- Mobile typecheck/test pass if touched.
- No route, API, auth, module access, or data model behavior changes.

---

## Phase 2 — Shared Contracts, API Client Core, and Canonical Module Metadata

**Goal:** Eliminate web/mobile API/model drift while keeping platform-specific auth/session behavior isolated.

### Task 2.1: Inventory API model drift

**Files:**
- Read: `frontend/src/api/models.ts`
- Read: `mobile/src/api/models.ts`
- Read: `backend/app/schemas/**/*.py`

**Output:**
- Add notes to this plan or a follow-up plan listing missing/extra fields and intentionally unsupported mobile modules.

### Task 2.2: Create shared TypeScript model package

**Files:**
- Create: `packages/family-api/package.json`
- Create: `packages/family-api/src/models.ts`
- Create: `packages/family-api/src/index.ts`
- Modify: root `package.json` workspaces to include `packages/*`
- Modify: frontend/mobile imports gradually.

**Tests:**
- Typecheck frontend and mobile after importing shared models.

**Security notes:**
- Shared type definitions do not enforce permissions; backend Pydantic schemas and dependencies remain authoritative.

### Task 2.3: Extract shared API mechanics without auth/session coupling

**Files:**
- Create: `packages/family-api/src/client-core.ts`
- Create: `packages/family-api/src/errors.ts`
- Create: `packages/family-api/src/query.ts`
- Modify: `frontend/src/api/client.ts`
- Modify: `mobile/src/api/client.ts`

**Shared mechanics:**
- URL building
- query serialization
- JSON content detection
- API error parsing
- endpoint method groups

**Platform adapters:**
- Web adapter keeps `credentials: "include"`, cookie CSRF read, and relative base URL support.
- Mobile adapter keeps explicit in-memory CSRF/session assumptions and native base URL defaults.

### Task 2.4: Canonical module registry with platform metadata

**Files:**
- Modify: `backend/app/modules.py`
- Add endpoint/model metadata if needed.
- Create generated/shared `packages/family-api/src/modules.ts` or `shared/modules.json`.
- Modify: `frontend/src/modules/registry.ts`
- Modify: `mobile/src/modules/registry.ts`

**Tests:**
- Backend module service tests.
- Frontend registry tests.
- Mobile tab tests including unsupported platform modules.

**Security notes:**
- Backend `require_module_access()` remains the real enforcement point.

### Phase 2 Done Criteria

- Web and mobile compile against shared models.
- Platform adapters preserve existing login/session/CSRF behavior.
- Registry drift is intentional and expressed as platform support metadata.
- Full backend/frontend/mobile gates pass.

---

## Phase 3 — Backend Service and Policy Decomposition

**Goal:** Split oversized routers into route, service, repository, serializer, and policy layers while preserving authorization and business-rule behavior.

### Task 3.1: Decompose recipe router

**Files:**
- Modify: `backend/app/api/recipes.py`
- Create: `backend/app/services/recipes/ownership.py`
- Create: `backend/app/services/recipes/serialization.py`
- Create: `backend/app/services/recipes/importer.py`
- Create: `backend/app/services/recipes/service.py`
- Create: `backend/app/services/recipes/backup.py`
- Create: `backend/app/services/recipes/feedback.py`
- Create/modify tests under `backend/tests/`

**Security-specific tests:**
- User cannot access another user’s recipe/category/tag.
- Backup import cannot attach another user’s categories/tags/components.
- Child feedback validates household membership.
- URL importer blocks SSRF-sensitive hosts before network calls.

### Task 3.2: Harden and isolate recipe URL import

**Files:**
- Create: `backend/app/services/recipes/importer.py`
- Test: `backend/tests/test_recipe_importer_security.py`

**Rules:**
- Allow only HTTP/HTTPS.
- Block localhost, loopback, private, link-local, and metadata IPs.
- Resolve DNS before fetch if possible.
- Enforce response size limit and timeout.
- Keep JSON-LD parser test-covered.

### Task 3.3: Extract chore workflow domain services

**Files:**
- Modify: `backend/app/api/workflow.py`
- Create: `backend/app/services/chores/scheduling.py`
- Create: `backend/app/services/chores/eligibility.py`
- Create: `backend/app/services/chores/rotation.py`
- Create: `backend/app/services/chores/submissions.py`
- Create: `backend/app/services/chores/serialization.py`

**Tests:**
- Existing scheduling matrix remains green.
- New service-level tests for stale submissions, shared completion, rotating assignment, timeout windows, and child scoping.

### Task 3.4: Add narrow backend helper utilities

**Files:**
- Create: `backend/app/api/errors.py`
- Create: `backend/app/services/policies.py`
- Modify: `backend/app/api/children.py`, `homeschool.py`, `recipes.py` as appropriate.

**Security notes:**
- Helpers must require household/owner arguments.
- No generic `get_by_id` helper should be used on protected resources without a scoped policy wrapper.

### Phase 3 Done Criteria

- Router files are route-only or route-thin.
- Security policy helpers are named and tested.
- Recipe importer risk is isolated and guarded.
- Backend `pytest -q` passes.
- Frontend/mobile builds still pass if response shapes changed; otherwise no UI changes required.

---

## Phase 4 — Feature-Level Frontend and Mobile Decomposition

**Goal:** Break large pages/screens into feature folders, hooks, pure libraries, and presentational components while preserving visible behavior.

### Task 4.1: Decompose web parent chores page

**Files:**
- Modify: `frontend/src/pages/ParentChoresPage.tsx`
- Create: `frontend/src/features/chores/components/ChoreForm.tsx`
- Create: `frontend/src/features/chores/components/ChoreList.tsx`
- Create: `frontend/src/features/chores/components/EligibleChorePanel.tsx`
- Create: `frontend/src/features/chores/hooks/useChores.ts`
- Create: `frontend/src/features/chores/hooks/useEligibleChores.ts`
- Create tests adjacent to extracted units where useful.

**Verification:**
- `src/App.parent-chores.test.tsx`
- Frontend lint/build.

### Task 4.2: Decompose recipe organizer

**Files:**
- Modify: `frontend/src/pages/RecipeOrganizerPage.tsx`
- Create: `frontend/src/features/recipes/components/RecipeEditor.tsx`
- Create: `frontend/src/features/recipes/components/IngredientEditor.tsx`
- Create: `frontend/src/features/recipes/components/StepEditor.tsx`
- Create: `frontend/src/features/recipes/components/RecipeBackupImportExport.tsx`
- Create: `frontend/src/features/recipes/hooks/useRecipes.ts`
- Create: `frontend/src/features/recipes/lib/payloadMapping.ts`

**Security notes:**
- Continue rendering notes/instructions as React text, not raw HTML.

### Task 4.3: Decompose mobile chores and homeschool screens

**Files:**
- Modify: `mobile/src/screens/parent/ChoresScreen.tsx`
- Modify: `mobile/src/screens/homeschool/HomeschoolScreen.tsx`
- Modify: `mobile/src/screens/homeschool/HomeschoolForms.tsx`
- Create feature folders under `mobile/src/features/chores` and `mobile/src/features/homeschool`.

**Verification:**
- `npm run mobile:typecheck`
- `npm run mobile:test`

### Task 4.4: Modularize styling

**Files:**
- Split `frontend/src/app.css` into `frontend/src/styles/*.css` and feature CSS files.
- Split `mobile/src/styles/layout.ts` into tokens/layout/forms/cards/typography.

**Verification:**
- Visual smoke via Playwright when UI routing is available.
- Frontend build/lint and mobile typecheck.

### Phase 4 Done Criteria

- Large page/screen files are reduced by extraction without route/behavior change.
- User-facing flows remain covered by existing tests and targeted additions.
- No authorization behavior moves from backend to client-only checks.
