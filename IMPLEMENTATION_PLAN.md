# Implementation Plan

## Phase 1: Foundation (already done)
- [x] 1.1 — Initialize project structure and dependencies
- [x] 1.2 — Configure linting, formatting, and test runner
- [x] 1.3 — Add environment configuration and startup checks

## Phase 2: Core Backend Architecture (already done)
- [x] 2.1 — Define core data models and storage strategy
- [x] 2.2 — Implement repository/service boundaries
- [x] 2.3 — Add baseline error handling and logging

## Phase 3: Backend MVP APIs (already done)
- [x] 3.1 — Implement child management MVP API flow
- [x] 3.2 — Add input validation and edge-case handling
- [x] 3.3 — Add tests for happy path and failure modes

## Phase 4: Frontend Product UI (required)
- [x] 4.1 — Replace placeholder `frontend/src/App.tsx` with routed application shell and top-level layout
- [x] 4.2 — Add API client layer in frontend for `/chore-api/*` endpoints with typed request/response models
- [ ] 4.3 — Build Parent Dashboard view showing child balances, pending submissions count, and quick actions
- [ ] 4.4 — Build Children management page (list/create/edit active status) wired to backend `/children` APIs
- [ ] 4.5 — Build Child Today page (eligible chores list, submission flow) with loading/error/empty states
- [ ] 4.6 — Build Submission review page for parents (approve/reject per item)
- [ ] 4.7 — Implement shared UI system (cards, buttons, badges, forms, toast/errors) with Jewel Pop styling

## Phase 5: Integration & Reliability
- [ ] 5.1 — Ensure frontend uses configurable API base for production (`/chore-api`) and local dev
- [ ] 5.2 — Add end-to-end happy-path test: create child → child submits chore → parent approves → balance updates
- [ ] 5.3 — Add frontend tests for major views and API error handling
- [ ] 5.4 — Verify backend health/readiness + frontend build in CI-quality gate sequence

## Phase 6: Deployment Finish
- [ ] 6.1 — Verify `/chore/` serves built frontend assets and all API calls resolve to `/chore-api/`
- [ ] 6.2 — Smoke test on mobile browser for parent and child key flows
- [ ] 6.3 — Update README with exact production URLs and operator runbook
- [ ] 6.4 — Mark plan complete when all tasks are done
