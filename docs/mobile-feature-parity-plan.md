# Family Manager Mobile Feature Parity Plan

Created: 2026-06-06
Branch: `feature/mobile-family-app`

## Current State

The repository already has a clean top-level separation:

- `backend/`: FastAPI API, persistence, auth, module permissions, tests
- `frontend/`: React/Vite web app served under `/chore/`
- `mobile/`: Expo/React Native app built as installable APK

No generated mobile artifacts are tracked. `mobile/.expo/`, `mobile/dist/`, and
`mobile/node_modules/` are ignored. The biggest cleanup need is not a top-level
move; it is the mobile app internals. `mobile/App.tsx` is currently a large
single-file first pass and should be split before feature expansion.

## Web/API Surface

Implemented on the website/API:

- Auth: login, logout, session bootstrap, password change
- Role/module gates: parent, parent admin, child, per-user module access
- Parent dashboard: child count, pending submissions, quick links
- Children management: create child, activate/deactivate child, create child
  login, reset child login email
- Chores: parent daily board, child eligible chores, submit on behalf of child,
  create/edit/archive chores, scheduling, completion windows, static/rotating
  assignment
- Submission review: approve all, approve/reject individual items
- Homeschool: semesters, subjects, attendance calendar, day comments, grades,
  summary/status panels, create/update/delete flows
- Admin: create parent users, module access matrix, last-admin protection
- Account security: change own password

Partially implemented or still missing from the website/API compared with the
original spec:

- Real balance/report pages backed by ledger endpoints
- Bonus/payment/adjustment endpoints and UI
- Tags CRUD and tag filtering
- Quick templates CRUD and template scheduling
- Child calendar/history views
- More complete reports for approvals, balances, chores, homeschool progress

## Mobile Surface

Implemented in the APK:

- Auth bootstrap, login, logout, module loading
- Parent home summary: active children, pending reviews, enabled modules
- Child today: choose eligible chores by date and submit
- Parent review: pending submissions, approve all, approve/reject item
- Homeschool read-only summary: counts, active semesters, recent comments
- Account read-only profile/modules/logout

Missing from mobile compared with the current website:

- Account password change
- Parent children management
- Child login creation and email reset
- Full parent chores page: daily board by child, submit on behalf, create/edit/
  archive chores, scheduling, assignment, rotation
- Full homeschool CRUD: semester/subject creation, attendance logging, day
  comments, grade entry, delete/edit actions, calendar detail workflow
- Admin dashboard: create parent user, module access matrix
- Parent dashboard quick-action flow and richer child list
- Role/module-aware tab visibility for admin-only screens beyond the current
  coarse parent/child split
- Mobile tests for screens/API behavior

Missing from mobile and still missing or partial on web/API:

- Reports/balances
- Bonus/payment/adjustment flows
- Tags
- Templates
- Child calendar/history

## Target Mobile Folder Structure

Keep `mobile/` as a standalone Expo application inside the monorepo, but split
source code like this before adding major features:

```text
mobile/
  App.tsx
  app.json
  eas.json
  package.json
  src/
    api/
      client.ts
      models.ts
    components/
      ActionButton.tsx
      FieldLabel.tsx
      InlineNotice.tsx
      ScreenHeader.tsx
      SectionCard.tsx
      StatCard.tsx
    hooks/
      useAsyncAction.ts
      useSessionBootstrap.ts
      useModules.ts
    navigation/
      tabs.ts
      types.ts
    screens/
      auth/LoginScreen.tsx
      account/AccountScreen.tsx
      account/ChangePasswordScreen.tsx
      parent/ParentHomeScreen.tsx
      parent/ChildrenScreen.tsx
      parent/ChoresScreen.tsx
      parent/ReviewScreen.tsx
      admin/AdminScreen.tsx
      child/ChildTodayScreen.tsx
      child/ChildHistoryScreen.tsx
      homeschool/HomeschoolScreen.tsx
      homeschool/HomeschoolCalendarScreen.tsx
      homeschool/HomeschoolForms.tsx
    styles/
      colors.ts
      layout.ts
      typography.ts
```

Do not add generated native `android/` or `ios/` folders unless the project
intentionally leaves Expo managed workflow.

## Implementation Plan

### Phase 0 - Repo Hygiene and Guardrails

1. Split `mobile/App.tsx` into screens/components/hooks without behavior
   changes.
2. Copy frontend API parity into mobile API client:
   - `changePassword`
   - `listUserModuleAccess`
   - `createParentUser`
   - `setUserModuleAccess`
   - `createChild`
   - `updateChild`
   - `createChildAccount`
   - `resetChildAccountEmail`
   - `listChores`
   - `createChore`
   - `updateChore`
   - `archiveChore`
   - homeschool create/update/delete/upsert methods
3. Add lightweight mobile tests for API URL building, CSRF/write headers, and
   screen reducer/helper logic.
4. Add a mobile quality command at root, for example
   `npm run mobile:gate`, that runs typecheck plus mobile-specific checks.
5. Decide whether to keep mobile in npm workspaces or isolate it. Current EAS
   builds pass, but `expo-doctor` warns about duplicate React/React DOM because
   frontend uses React 18 and mobile uses Expo SDK 56 React 19.

### Phase 1 - Account and Navigation Parity

1. Add mobile Account Security screen with password change.
2. Replace hardcoded parent tabs with role/module-derived navigation:
   - parent: Home, Chores, Review, Homeschool, Account
   - parent admin: add Admin
   - child: Today, Account, later History/Calendar
3. Add consistent loading/error/success states across all screens.

### Phase 2 - Parent Children Management

1. Add child list screen.
2. Add create child form.
3. Add active/inactive toggle.
4. Add child login creation.
5. Add child login email reset.
6. Match web validation and backend error handling.

### Phase 3 - Parent Chores Parity

1. Add parent daily board by child/date.
2. Add quick submit on behalf of child.
3. Add selected child multi-submit.
4. Add all-chores list.
5. Add chore create/edit/archive form:
   - name
   - start/end date
   - timeout days
   - schedule mode/interval/unit
   - completion mode
   - static child eligibility
   - rotating assignment order
   - reward cents once UI/API behavior is reviewed
6. Keep the existing child Today screen but share chore row components.

### Phase 4 - Homeschool Parity

1. Expand mobile homeschool from read-only summary to tabbed screens:
   - Overview
   - Calendar
   - Attendance
   - Comments
   - Grades
   - Setup
2. Add semester create/edit/delete.
3. Add subject create/edit/delete with color selection.
4. Add attendance upsert/delete.
5. Add day comment upsert/delete.
6. Add grade upsert/delete.
7. Keep forms compact and phone-first; avoid copying desktop layout literally.

### Phase 5 - Admin Parity

1. Add admin screen gated to `PARENT_ADMIN`.
2. Add parent user creation.
3. Add module access matrix.
4. Preserve last-admin protection UX.

### Phase 6 - Product Gaps Beyond Current Website

These need backend/API work before full mobile parity is possible:

1. Ledger balance API and parent dashboard balance cards.
2. Bonus/payment/adjustment API and parent UI.
3. Reports page/API.
4. Tags CRUD and tag filters.
5. Quick templates CRUD and template scheduling.
6. Child history/calendar views.

Build these in the API and website first, then expose equivalent mobile flows.

## Verification Gates

For each phase:

- `npm run mobile:typecheck`
- `npx expo install --check` from `mobile/`
- mobile API/client tests once added
- backend tests for any API changes
- frontend tests if shared API contracts change
- EAS APK build for installable milestones
- Static APK validation with `aapt2`, `apksigner`, and `zipalign`

Before shipping mobile feature milestones, install on a real Android device and
run through parent and child accounts. The current server cannot run a useful
Android emulator because KVM is unavailable.

## Progress - 2026-06-06 Mobile Parity Pass

Completed in this pass:

- Phase 0: Split `mobile/App.tsx` into a clean `mobile/src` structure with
  shared components, hooks, navigation helpers, screens, styles, and utilities.
- Phase 0: Expanded the mobile API client/model surface to match current
  website/API endpoints for password change, modules/admin access, children,
  child accounts, chores, submissions, and homeschool CRUD methods.
- Phase 0: Added mobile tests for API URL/CSRF behavior and role/module tab
  derivation.
- Phase 0: Added root `npm run mobile:gate` for typecheck, mobile tests, and
  Expo dependency checks.
- Phase 1: Added account security password change in the mobile Account screen.
- Phase 1: Replaced hardcoded tabs with role/module-aware mobile navigation,
  including admin-only tab visibility for parent admins with admin module
  access.
- Phase 2: Added parent children management for list, create, active toggle,
  child login creation, and child login email reset.
- Phase 3: Added parent chores mobile parity for daily board by child/date,
  quick submit on behalf, selected child multi-submit, all-chores list,
  create/edit/archive chore flow, scheduling, completion windows, static
  assignment, and rotating assignment order.
- Phase 5: Added a compact admin screen for parent user creation and module
  access toggles because the current API already supports those workflows.

Remaining after this pass:

- Phase 4: Homeschool remains read-only on mobile. CRUD methods exist in the
  client now, but phone-first semester/subject/attendance/comment/grade workflows
  still need dedicated screens.
- Phase 6 product gaps still require API/web work before mobile parity can be
  completed: ledger balances, bonus/payment/adjustment flows, reports, tags,
  quick templates, and child calendar/history.
