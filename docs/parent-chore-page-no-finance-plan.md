# Parent Chore Page Without Finance - Implementation Plan

Branch: `feature/parent-chore-page-plan`

## Goal

Build a parent-facing chore page that gives parents the same operational chore workflow the kids have: choose a date, see eligible chores, select or tap completed chores, submit them for review, and refresh current availability. The parent page should also preserve the parent-only chore management tools already present in the app.

The finance side should be absent from this parent experience. No dollars, balances, earned totals, reward inputs, potential totals, bonus/payment language, ledger/report prompts, or allowance copy should appear on the parent chore page.

## Current State

### Live repo

The active project is `/var/ralph-projects/chore_tracking`, GitHub `fantasticsquirrel/Chores`. The default branch is `master`, not `main`, and the current work branch is `feature/parent-chore-page-plan`.

### Current child chore flow

Source: `frontend/src/pages/ChildTodayPage.tsx`

Implemented features:

- Defaults to today's date and reloads eligible chores when the date changes.
- Calls `apiClient.listEligibleChores({ date })`.
- Shows loading, empty, and API error states.
- Lets the child select one or more eligible chores.
- Calls `apiClient.createSubmission({ for_date, chore_ids })`.
- Clears selection, refreshes eligibility, and shows success or failure messages.

Finance currently leaks into this flow through `reward_cents` and the `toUsd(...) reward` display.

### Current parent chore page

Source: `frontend/src/pages/ParentChoresPage.tsx`

Implemented parent-only management features:

- Loads all chores with `apiClient.listChores({ household_id, active_only: false })`.
- Loads children for assignment controls.
- Creates chores.
- Edits chores.
- Archives active chores.
- Supports schedule mode, recurring interval, completion mode, static child eligibility, and rotating assignment.

Finance currently appears as:

- `FormState.reward_dollars`.
- `Reward ($)` form field.
- `reward_cents` create/update payload values.
- Dollar amount in the chore list metadata.

Missing from this page:

- Parent can not operate the kid-style daily submission workflow from the page.
- Parent can not view all active children's eligible chores together.
- Parent can not quickly submit chores for a specific child from this page.
- The page is a large single component with inline styles; homeschool has a better split-component pattern.

### Current backend support

Source: `backend/app/api/workflow.py`

Useful existing behavior:

- `GET /children/me/eligible-chores?date=YYYY-MM-DD&child_id=...` already accepts `child_id` for parent users.
- `POST /submissions?child_id=...` already accepts `child_id` for parent users.
- `_resolve_active_child(...)` enforces that child users can only act as themselves and parent users can target active children in their household.
- Eligibility already handles active children, archived chores, schedule rules, expiration, rotation, approved completions, and pending submissions.

Finance currently appears as:

- `EligibleChoreResponse.reward_cents`.
- `SubmissionReviewItemResponse.chore_reward_cents`.
- Approval creates `Transaction(type=CHORE_APPROVAL, amount_cents=chore.reward_cents)`.

### Homeschool tracker patterns to reuse

Source: `frontend/src/pages/HomeschoolPage.tsx` and `frontend/src/pages/homeschool/*`

Useful patterns:

- A dedicated data hook (`useHomeschoolData`) loads all child/module data with `Promise.all`.
- Child/date selection is centralized, with sensible defaults once data arrives.
- Larger pages are split into focused child components instead of one giant route component.
- Calendar/progress sections separate "review" from "daily tools".
- Mutations set action error/message state, refresh data, and keep the user on the same page.

### Legacy chore tracker patterns to mine, not copy

Source: `/tmp/homeschool-rpg-audit/Chore_Tracker/static/index.html`

Useful old ideas:

- `FamilyBoard` shows multiple active kids at once.
- Each child card shows eligible chores for the selected date.
- Parent can tap one chore, confirm, submit for that child, then refresh just that child's eligibility.
- Child panel supports child picker, date picker, eligible chore list, multi-select, submit, and status messages.

Finance to drop from these ideas:

- Kid owed/earned totals.
- Reward display on each chore.
- Reward display in confirmation.
- Potential totals in submission review.

## Product Decision

Use `/parent/chores` as the combined parent chore page:

1. Top section: parent daily chore board.
2. Middle section: focused selected-child workflow, matching the kid page's multi-select submit flow.
3. Lower section: chore setup and management, preserving the current create/edit/archive capabilities.

Keep `/board` as the approval queue route for now, but remove finance totals from any cross-link or shared component touched by this work.

Do not delete finance database schema in this page task. The safe scope is:

- Hide and stop collecting finance values in the new parent UI.
- Create new chores from this UI with `reward_cents: 0`.
- Do not display existing nonzero rewards in this UI.
- Add a backend guard to skip creating zero-dollar `Transaction` rows when approving zero-reward chores.
- Leave broader ledger/table removal for a separate migration because existing child flow, tests, and historical data still reference it.

## Proposed UX

### Header

- Title: `Chores`
- Badge: active child count or selected date.
- Short copy: parent workflow focused on what needs doing today.
- Primary actions:
  - `Refresh`
  - `Manage Chores` anchor or tab
  - `Review Submissions` link to `/board`

No `Balance`, `Rewards`, `Allowance`, `Reports`, or dollar language.

### Daily Board

Inputs:

- Date picker, default today.
- Optional "Today" shortcut.
- Child view mode:
  - `All active children`
  - Specific child

All-child view:

- Load active children from `apiClient.listChildren({ household_id, active_only: true })`.
- For each active child, call eligible chores using `child_id`.
- Render a child card with:
  - Child name.
  - Count of available chores.
  - Chore buttons.
  - Loading/empty/error state scoped to that child.
  - Inline status after submit.

Single-child view:

- Same selection behavior as `ChildTodayPage`.
- Multi-select checkboxes.
- Submit selected chores for the selected child.
- Refresh list after successful submit.

Confirmation:

- Quick tap submit should show a small confirmation state before posting.
- Confirmation copy should mention only child, chore, and date.
- Do not include reward amount.

### Chore Management

Preserve:

- Create chore.
- Edit chore.
- Archive chore.
- Start date.
- Global expiry (`expires_at`) if surfaced.
- Timeout days if surfaced.
- Schedule mode.
- Interval/unit.
- Completion mode.
- Static assignment.
- Rotating assignment and order.

Remove:

- Reward field.
- Dollar amount display.
- Any "earned" or "balance" text.

Payload behavior:

- Create sends `reward_cents: 0`.
- Update should omit `reward_cents` so hidden historical values are not accidentally changed while editing unrelated fields.
- Optional cleanup task: if Jon wants this page to be strictly no-finance for old chores too, add a one-time migration or admin action to set all existing chore rewards to `0`.

## Implementation Steps

### Phase 1 - API client support

Files:

- `frontend/src/api/models.ts`
- `frontend/src/api/client.ts`
- `frontend/src/api/client.test.ts`

Tasks:

- Extend `ListEligibleChoresParams` with `child_id?: number`.
- Extend `SubmissionRequest` or add a new parent submit method so `child_id` can be sent as a query param instead of in the JSON body.
- Recommended client methods:
  - `listEligibleChores({ date, child_id })`
  - `createSubmission(payload, { child_id?: number })`
- Keep child usage backwards compatible: child route calls without `child_id`.
- Add API client tests proving query strings include `child_id` only when supplied.

### Phase 2 - Extract shared chore submission pieces

Files:

- `frontend/src/pages/ChildTodayPage.tsx`
- `frontend/src/pages/ParentChoresPage.tsx`
- New folder: `frontend/src/pages/parent-chores/`

Tasks:

- Create a reusable `formatApiError(...)` helper if needed.
- Create `EligibleChoreList` component:
  - Props: chores, selected IDs, submitting, onToggle.
  - Support `showFinance?: false`, default false for the new parent page.
  - For the child page, either keep current behavior or pass `showFinance=true` if child finance remains in scope.
- Create `ChoreDateControls` component:
  - Date input.
  - Today shortcut.
  - Refresh button.
- Create a small local hook for parent board data:
  - `useParentChoreBoardData(householdId, targetDate)`.
  - Loads children.
  - Loads eligible chores per active child.
  - Exposes per-child loading/error/chores states.
  - Provides `refreshChild(childId)` and `refreshAll()`.

### Phase 3 - Parent daily board

Files:

- `frontend/src/pages/ParentChoresPage.tsx`
- New: `frontend/src/pages/parent-chores/ParentDailyBoard.tsx`
- New: `frontend/src/pages/parent-chores/ParentChildChoreCard.tsx`

Tasks:

- Add all-child board section above management.
- For each active child:
  - Render child's eligible chores for selected date.
  - Allow tap-to-submit one chore.
  - Confirm before submit.
  - Call `apiClient.createSubmission({ for_date, chore_ids: [id] }, { child_id })`.
  - Refresh that child's chores after submit.
  - Show scoped success/error message.
- Hide all reward fields from each child card.
- Add empty state when there are no active children.
- Add empty state per child when no chores are available for the date.
- Do not cap to four children unless layout becomes unusable; the old legacy app capped at four, but the current app should handle all active children with responsive cards.

### Phase 4 - Focused selected-child workflow

Files:

- New: `frontend/src/pages/parent-chores/ParentSelectedChildChores.tsx`

Tasks:

- Add child selector and date controls.
- Default to the first active child once children load.
- Load eligible chores for selected child/date.
- Match `ChildTodayPage` behavior:
  - Loading state.
  - Error state.
  - Empty state.
  - Select multiple chores.
  - Submit selected.
  - Refresh after submit.
  - Clear selected chores after success.
- Payload uses parent-targeted `child_id`.
- No reward display.

### Phase 5 - No-finance chore management

Files:

- `frontend/src/pages/ParentChoresPage.tsx`
- Potential new components under `frontend/src/pages/parent-chores/`

Tasks:

- Remove `reward_dollars` from `FormState`.
- Remove the `Reward ($)` field.
- On create, send `reward_cents: 0`.
- On update, do not include `reward_cents`.
- Remove dollar display from chore list metadata.
- Rename any CSS or labels only if user-visible language currently says balance/reward.
- Keep backend `reward_cents` schema unchanged for now because `CreateChoreRequest` requires it and other code paths still use it.

### Phase 6 - Backend zero-finance guard

Files:

- `backend/app/api/workflow.py`
- `backend/tests/test_happy_path_e2e.py` or new backend workflow test file

Tasks:

- When approving a submission item, create a `Transaction` only if `chore.reward_cents != 0`.
- Add tests:
  - Zero-reward chore approval creates a completion record.
  - Zero-reward chore approval does not create a transaction row.
  - Existing nonzero reward behavior remains unchanged.
- Do not remove `Transaction` model/table in this task.

### Phase 7 - Submission review cleanup

Files:

- `frontend/src/pages/ParentSubmissionReviewPage.tsx`
- `frontend/src/App.submission-review.test.tsx`

Tasks:

- Remove potential total display if this page is linked as part of the new parent chore workflow.
- Remove per-item reward display.
- Keep approve/reject behavior intact.
- Keep `chore_reward_cents` in the API type for now, but ignore it in UI.

### Phase 8 - Tests

Frontend test files:

- `frontend/src/App.parent-chores.test.tsx`
- `frontend/src/App.child-today.test.tsx`
- `frontend/src/App.submission-review.test.tsx`
- `frontend/src/App.mobile-smoke.test.tsx`

Add or update tests for:

- Parent page loads active children and eligible chores for date.
- Parent all-child board submits one chore for one child using `child_id` query param.
- Parent selected-child workflow submits multiple selected chores.
- Parent board refreshes only the affected child after quick submit.
- Parent page shows no reward, dollar, balance, earned, allowance, bonus, or payment text.
- Parent chore create sends `reward_cents: 0`.
- Parent chore update does not send `reward_cents`.
- Existing child page still submits chores as before.
- Mobile smoke covers parent board layout with at least two children.

Backend tests:

- Parent can list eligible chores for a selected child.
- Parent can create a submission for a selected child.
- Child cannot submit for another child.
- Zero-reward approval does not create a transaction.
- Nonzero reward approval still creates a transaction until global finance removal is requested.

### Phase 9 - Visual QA

Use the repo or global screenshot workflow after implementation.

Capture:

- Before screenshot of `/chore/parent/chores`.
- After screenshot of `/chore/parent/chores` desktop.
- After screenshot of `/chore/parent/chores` mobile.
- Focused screenshot of one child card with available chores.
- Focused screenshot of the chore management form.

Verify:

- No finance language appears on the parent chore page.
- Text fits in child cards and buttons on mobile.
- Empty/error/loading states are visible and not overlapping.
- The parent page still exposes chore create/edit/archive.

### Phase 10 - Gates

Run:

- `npm run lint`
- `npm run test`
- `npm run build`
- `.venv/bin/pytest backend/tests` or the repo's active backend pytest command

If available in this repo, also run:

- `npm run gate`
- `bash scripts/check-owasp`

## Security And Permission Checks

- Keep parent routes under `RoleProtectedRoute` for `PARENT_ADMIN` and `PARENT`.
- Keep chore routes under `ModuleProtectedRoute moduleKey="chores"`.
- Rely on backend `_resolve_active_child(...)` for household scoping, not frontend-only filtering.
- Confirm child users cannot pass arbitrary `child_id`.
- Confirm parent users cannot target inactive children or children in another household.
- Keep CSRF behavior unchanged through `apiClient`.
- No destructive data migration in this task unless explicitly approved.

## Acceptance Criteria

- `/parent/chores` lets a parent see eligible chores by child and date.
- Parent can submit one chore from a child card.
- Parent can submit multiple chores from a selected-child workflow.
- Parent chore create/edit/archive features still work.
- Parent chore page contains no finance UI or copy.
- New chores created from the parent page have `reward_cents: 0`.
- Zero-reward approvals create completion records but no transaction rows.
- Existing child chore workflow remains functional.
- Tests and build pass.
- Screenshots confirm desktop and mobile layout.

## Open Questions

1. Should existing nonzero chore rewards be zeroed in a migration, or should this plan only stop showing/creating finance values going forward?
2. Should the child page also lose reward display, or is finance removal scoped strictly to the parent chore page?
3. Should `/board` be visually folded into `/parent/chores`, or should it remain a separate approval queue route linked from the page?
