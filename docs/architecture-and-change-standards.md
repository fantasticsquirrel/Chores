# Family Manager Architecture and Change Standards

This document is the standing reference for future Family Manager / Chore Tracker changes. Use it with `docs/standard-module-creation-guide.md` and the focused implementation plans in `docs/plans/`.

## Non-Negotiable Change Standards

- Preserve existing behavior unless the task explicitly calls for a behavior change.
- Keep backend authorization authoritative. Frontend and mobile gating are user-experience aids only.
- Do not move household ownership, role checks, module access checks, child scoping, CSRF/session policy, or last-admin protection into client-only code.
- Use test-first development for behavior changes and bug fixes. Add a failing regression/characterization test, watch it fail, implement the smallest change, then verify it passes.
- Prefer small cohesive extractions over broad rewrites. Extract one service, component, hook, or pure helper at a time and run targeted tests immediately after.
- Keep API response shapes stable. If a contract changes, update shared models, frontend/mobile consumers, and tests in the same slice.
- Preserve deployment route stability: the SPA is currently served under `/chore/` and the API under `/chore-api/`.

## Repository Structure

- `backend/`: FastAPI backend, SQLAlchemy models, Alembic migrations, backend tests.
- `frontend/`: React + TypeScript web SPA.
- `mobile/`: Expo / React Native TypeScript mobile app.
- `packages/family-api/`: shared TypeScript API contracts, endpoint base classes, module metadata, and API-client mechanics.
- `docs/`: durable project documentation and change standards.
- `docs/plans/`: dated implementation/refactor plans. Plans are useful history, but this document is the durable standard reference.

## Backend Structure Standards

Backend routers should stay thin and explicit:

- Routers live under `backend/app/api/`.
- Domain services live under `backend/app/services/<domain>/`.
- Route dependencies, request/response models, path/query validation, commits, and authorization dependencies should remain visible at the route layer.
- Domain services should receive scoped context such as current user, household ID, owner ID, or session as arguments. Avoid generic unscoped `get_by_id` helpers for protected resources.
- Serialization helpers should be pure-ish where practical and live near their domain service.
- External import/fetch logic must be isolated in service modules and tested for SSRF protections.

Security boundaries to preserve:

- `require_module_access(...)` and role dependencies remain backend enforcement points.
- Owner/household lookups must return inaccessible resources as the established safe error shape, not leak cross-household existence.
- Recipe URL importers must allow only `http`/`https`, reject loopback/private/link-local/reserved/metadata targets, resolve DNS before fetch when applicable, and keep timeout/size limits.

## Shared TypeScript Contract Standards

Use `packages/family-api/` for cross-platform contracts and mechanics that are safe to share:

- API models and literal unions.
- Module metadata and platform support metadata.
- URL building, query serialization, API error formatting, and endpoint method base classes.
- Shared endpoint base classes may depend on protected transport primitives such as `get`, `post`, `put`, `patch`, `delete`, `postNoContent`, and `postNoContentWithBody`.

Do not centralize platform-specific security policy in the shared package:

- Web keeps browser cookie/session behavior, `credentials: "include"`, and cookie CSRF-token handling.
- Mobile keeps its native base URL behavior and explicit session/CSRF assumptions.
- Backend authorization remains authoritative even when frontend/mobile module metadata is shared.

When shared contracts change, verify all consumers: shared package tests, frontend tests/build, mobile tests/typecheck, and backend contract tests when backend-facing metadata is mirrored.

## Frontend Structure Standards

Web feature code should be organized by feature area:

- Route/page orchestrators: `frontend/src/pages/`.
- Reusable UI primitives: `frontend/src/ui/`.
- Shared non-feature helpers: `frontend/src/lib/`.
- Feature components/hooks/libs: `frontend/src/features/<feature>/components`, `frontend/src/features/<feature>/hooks`, and `frontend/src/features/<feature>/lib`.
- Shared API adapter: `frontend/src/api/`, backed by `packages/family-api/` where practical.
- Module registry UX metadata: `frontend/src/modules/`, backed by shared module contracts.
- Styling tokens: `frontend/src/styles/tokens.css`; app-level and feature selectors should import/use tokens instead of redefining core values.

Page components should generally orchestrate data loading, route state, and high-level user flows. Move repeated or bulky presentation into feature components. Move deterministic formatting, parsing, and payload mapping into tested feature libs.

Frontend tests should mock `apiClient` methods for route/page behavior unless the test is specifically for API transport mechanics.

## Mobile Structure Standards

Mobile feature code should follow the same feature-owned split:

- Screen orchestrators: `mobile/src/screens/`.
- Shared components: `mobile/src/components/`.
- Feature components/libs: `mobile/src/features/<feature>/components` and `mobile/src/features/<feature>/lib`.
- Shared styles/tokens/layout helpers: `mobile/src/styles/`.
- Shared API adapter: `mobile/src/api/`, backed by `packages/family-api/` where practical.
- Module registry UX metadata: `mobile/src/modules/`, backed by shared module contracts.

Screens should orchestrate state, navigation, and API calls. Pure label/format/parse/default-state helpers should live under `mobile/src/features/<feature>/lib` with unit tests.

Compatibility re-export shims are acceptable during gradual moves, but new code should import from the feature location directly.

## Module Metadata Standards

Module metadata must be explicit and drift-tested:

- Backend module definitions are authoritative for backend-owned fields such as key, name, description, and role/default grants.
- Shared/frontend/mobile metadata may include display and platform support fields, but must not replace server authorization.
- Unsupported platform modules should be expressed explicitly with platform support metadata rather than accidental omission.
- See `docs/standard-module-creation-guide.md` for new module requirements.

## Testing and Verification Standards

Use the narrowest test first, then run the relevant adjacent/full gates.

Backend:

```bash
cd backend && pytest
```

Frontend:

```bash
npm run lint --workspace frontend
npm run test --workspace frontend
npm run build --workspace frontend
```

Mobile:

```bash
npm run typecheck --workspace mobile
npm run test --workspace mobile
```

Shared package:

```bash
npx vitest run packages/family-api/src/*.test.ts --environment node
```

Always run:

```bash
git diff --check
```

Run Playwright/browser smoke tests when user-facing routing, responsive layout, deployed behavior, or gameplay-like flows are affected.

## Refactor Completion Checklist

Before declaring any future refactor complete:

- Targeted tests for touched units pass.
- Adjacent page/screen/API tests pass.
- Full backend/frontend/mobile/shared gates relevant to the change pass.
- `git diff --check` passes.
- Large files are reduced only by moving cohesive logic/components; no hidden behavior deletion.
- Backend security checks remain backend-side and explicit.
- Frontend/mobile route visibility is not treated as security.
- Shared contract changes are reflected in all consumers.
- User-facing behavior is verified by tests and, when appropriate, screenshots or Playwright smoke flows.
