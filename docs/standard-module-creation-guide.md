# Standard Module Creation Guide

Use this guide whenever adding a new module to OpenClaw Family Hub or any Hub-style app that supports account-scoped module access.

The goal is simple: every module should be discoverable, permissioned, testable, and controllable by admins without one-off wiring or hidden assumptions.

## Definition of a Module

A module is a self-contained feature area that may include:

- backend API routes
- database tables or migrations
- frontend pages/components
- navigation entries
- dashboard widgets/cards
- account-level enable/disable controls
- role or permission rules
- admin configuration screens
- background jobs or integrations

Examples:

- Todos
- Calendar
- Bookmarks
- Research Vault
- Weather
- Space Weather
- Chores
- Budgeting
- Meal Planning

## Required Module Metadata

Every module must have a single canonical metadata definition.

Recommended fields:

```json
{
  "key": "chores",
  "name": "Chores",
  "description": "Family chore tracking, rewards, and assignments.",
  "category": "family",
  "version": "1.0.0",
  "enabledByDefault": false,
  "adminOnly": false,
  "requiresAdminSetup": true,
  "nav": true,
  "dashboardCard": true,
  "defaultDashboardOrder": 40,
  "requiredPermissions": ["chores.read"],
  "adminPermissions": ["chores.admin"],
  "routes": {
    "frontend": "/chores",
    "api": "/api/chores"
  }
}
```

### Metadata Rules

- `key` must be stable, lowercase, and URL-safe.
- Never rename a module key after release without a migration.
- `enabledByDefault` controls newly-created accounts only.
- Existing accounts must be handled by migration or admin action.
- `adminOnly` means only admins can use the module even if it is enabled.
- `requiresAdminSetup` means the module should surface setup status in admin UI.
- `nav` controls whether the module appears in the main menu.
- `dashboardCard` controls whether a dashboard card is available.

## Required Backend Pieces

Every module must include backend integration, even if the first version is mostly frontend.

### 1. Module Registry Entry

Add the module to the backend module registry.

The registry should be the source of truth for:

- module key
- display name
- description
- default enabled state
- required permissions
- admin permissions
- frontend route
- API route prefix
- dashboard card availability

Do not duplicate this metadata across unrelated files unless generated from the registry.

### 2. Database Support

At minimum, the system needs account/module state.

Recommended table shape:

```sql
CREATE TABLE account_modules (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  configured BOOLEAN NOT NULL DEFAULT false,
  settings JSONB NOT NULL DEFAULT '{}',
  enabled_by INTEGER REFERENCES users(id),
  enabled_at TIMESTAMPTZ,
  disabled_by INTEGER REFERENCES users(id),
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, module_key)
);
```

If the app does not yet have account-level scoping, use the closest equivalent tenant/family/org table. Avoid user-only module toggles unless the feature is genuinely personal rather than account-wide.

### 3. Migration

Every new module should include a migration that does one of the following:

- inserts default module state for all existing accounts, or
- leaves it disabled for all existing accounts and lets admins enable it manually

Be explicit. Never rely on missing rows meaning enabled.

Recommended migration behavior:

- safe modules: disabled by default unless Jon explicitly wants rollout
- admin/system modules: enabled only for admin accounts
- family-facing modules: disabled by default until reviewed

### 4. API Route Wiring

Add backend routes under a predictable prefix:

```text
/api/modules
/api/modules/{module_key}
/api/admin/modules
/api/admin/accounts/{account_id}/modules
/api/<module_key>/...
```

Recommended admin endpoints:

```text
GET    /api/admin/modules
GET    /api/admin/accounts/{account_id}/modules
PUT    /api/admin/accounts/{account_id}/modules/{module_key}
PATCH  /api/admin/accounts/{account_id}/modules/{module_key}/settings
POST   /api/admin/accounts/{account_id}/modules/{module_key}/enable
POST   /api/admin/accounts/{account_id}/modules/{module_key}/disable
```

Recommended user endpoint:

```text
GET /api/me/modules
```

This lets the frontend render only enabled modules for the current account/user.

### 5. Permission Enforcement

Backend permissions are mandatory. Frontend hiding is not security.

Every module API route must check:

1. authenticated user
2. current account/tenant
3. module enabled for that account
4. user has required role/permission
5. admin-only restrictions, if applicable

Recommended helper:

```python
require_module_access(
    user=current_user,
    account_id=account_id,
    module_key="chores",
    permission="chores.read"
)
```

Admin mutation endpoints must require admin permission regardless of module enabled state.

### 6. Disabled Module Behavior

If a module is disabled:

- API reads should return `403 Forbidden` or a consistent `module_disabled` error.
- API writes should be blocked.
- frontend nav link should disappear.
- dashboard card should disappear.
- direct URL visits should show a friendly disabled/access page.
- background jobs for that module should not process that account unless explicitly allowed.

Do not delete module data just because a module is disabled. Disabling means inaccessible, not destroyed.

## Required Admin Features

Every module must be manageable from the admin area.

### 1. Global Module Catalog

Admin should have a page listing all registered modules.

For each module, show:

- name
- key
- description
- version
- category
- default enabled state
- dashboard card availability
- setup requirement
- route/path
- number of accounts enabled
- status: active, experimental, deprecated, hidden

### 2. Account-Level Module Controls

Admin must be able to view and edit modules for each account.

For each account/module pair, show:

- enabled/disabled toggle
- configured/not configured state
- last enabled/disabled timestamp
- who enabled/disabled it
- module-specific settings summary
- warning if the module requires setup

Required actions:

- enable module for account
- disable module for account
- edit module settings
- reset module settings to default
- view audit history

### 3. Bulk Enable/Disable

Admin should be able to apply module changes to multiple accounts.

Required safeguards:

- preview affected accounts before applying
- confirm before disabling a module with existing data
- never delete data during bulk disable
- write audit log entries for every affected account

Recommended actions:

```text
Enable module for selected accounts
Disable module for selected accounts
Enable module for all admin accounts
Enable module for all active accounts
Disable module for all accounts
```

### 4. Module Settings

Each module can define account-scoped settings.

Examples:

```json
{
  "chores": {
    "allowChildSelfComplete": false,
    "requireParentApproval": true,
    "defaultRewardCurrency": "points",
    "weeklyResetDay": "sunday"
  }
}
```

Rules:

- settings belong in the `account_modules.settings` field or a module-specific settings table
- settings must be validated server-side
- settings must have safe defaults
- settings changes must be audited
- sensitive values must not be stored in plain JSON settings

### 5. Audit Logging

Every admin module change must be logged.

Log fields:

- actor user ID
- account ID
- module key
- action: enable, disable, settings_update, reset, migrate
- previous value
- new value
- timestamp
- request IP/user agent if available

Example actions:

```text
module.enabled
module.disabled
module.settings.updated
module.settings.reset
module.default_applied
```

### 6. Admin Dashboard Integration

Admin dashboard should surface module issues:

- modules requiring setup
- modules enabled but misconfigured
- deprecated modules still enabled
- modules with failed background jobs
- modules with permission mismatch

## Required Frontend Pieces

### 1. Frontend Module Registry

Add the module to the frontend registry.

Recommended shape:

```js
export const modules = {
  chores: {
    key: 'chores',
    name: 'Chores',
    description: 'Track chores, rewards, and assignments.',
    path: '/chores',
    nav: true,
    dashboardCard: true,
    icon: ChoresIcon,
    requiredPermissions: ['chores.read'],
  },
}
```

The frontend registry should not decide access by itself. It should combine local display metadata with `/api/me/modules` access data from the backend.

### 2. Navigation Entry

If `nav: true`, add the module to the main navigation.

Rules:

- only show if backend says module is enabled for current account
- only show if user has permission
- keep ordering predictable
- avoid hard-coded one-off nav checks

### 3. Dashboard Card

If `dashboardCard: true`, add a dashboard card.

Dashboard cards should:

- respect account module enabled state
- respect permissions
- degrade cleanly if module data is empty
- include a useful call-to-action
- not make noisy failing requests when disabled

### 4. Direct Route Handling

If a user manually opens a disabled module URL:

- do not crash
- do not show unauthorized data
- show one of:
  - `This module is not enabled for your account.`
  - `Ask an admin to enable this module.`
  - admin shortcut: `Enable module` if current user is admin

### 5. Admin UI

Add admin screens/components for:

- module catalog
- account module toggles
- module settings editor
- audit trail display

The admin UI should call backend admin endpoints, not mutate local frontend state only.

## Required Security Checks

Before a module is considered complete, verify:

- disabled module APIs are blocked
- non-admin users cannot enable/disable modules
- users from another account cannot access module data
- direct route access is handled safely
- module settings validation rejects invalid data
- dashboard/nav hiding is not the only access control
- audit logs are written for admin changes
- no secrets are stored in module settings JSON
- background jobs respect account/module enabled state

Map the module against OWASP Top 10 before release.

## Required Testing

Minimum tests for every module:

### Backend

- registry contains module metadata
- default account module state is created correctly
- admin can enable module for account
- admin can disable module for account
- non-admin cannot enable/disable module
- disabled module blocks API access
- enabled module allows authorized access
- cross-account access is blocked
- settings validation works
- audit log is written

### Frontend

- nav link appears when enabled
- nav link disappears when disabled
- dashboard card appears when enabled
- dashboard card disappears when disabled
- direct disabled route shows friendly blocked state
- admin toggle updates UI after save
- settings form validates inputs

### End-to-End

Test at least this flow:

1. log in as admin
2. open admin module manager
3. enable module for test account
4. log in as account user
5. confirm nav link appears
6. confirm dashboard card appears
7. open module page successfully
8. log back in as admin
9. disable module
10. confirm user no longer sees nav/card
11. confirm direct route is blocked
12. confirm backend API returns forbidden/module disabled

## Required Documentation

Every module should include a short module README or docs page with:

- purpose
- module key
- routes
- API endpoints
- permissions
- default enabled state
- account settings
- admin controls
- migration notes
- test checklist
- rollback notes

## Standard Implementation Checklist

Use this checklist for every new module.

### Planning

- [ ] Choose stable module key
- [ ] Define module metadata
- [ ] Decide default enabled state
- [ ] Decide account settings schema
- [ ] Decide permissions
- [ ] Decide dashboard/nav behavior
- [ ] Decide whether background jobs are needed

### Backend

- [ ] Add backend registry entry
- [ ] Add database migration
- [ ] Add account module state records
- [ ] Add module API routes
- [ ] Add admin module endpoints
- [ ] Add permission checks
- [ ] Add module-enabled checks
- [ ] Add settings validation
- [ ] Add audit logging
- [ ] Add background job guardrails if needed

### Frontend

- [ ] Add frontend registry entry
- [ ] Add route/page
- [ ] Add nav entry
- [ ] Add dashboard card if applicable
- [ ] Add disabled/access-denied state
- [ ] Add admin catalog entry
- [ ] Add account toggle UI
- [ ] Add settings editor if needed

### Testing

- [ ] Backend access tests
- [ ] Backend admin mutation tests
- [ ] Settings validation tests
- [ ] Frontend nav/dashboard tests
- [ ] Direct disabled route test
- [ ] E2E enable/disable flow
- [ ] Screenshot proof for UI changes
- [ ] OWASP/security checklist complete

### Release

- [ ] Migration tested
- [ ] Existing accounts handled intentionally
- [ ] Admin can enable/disable module
- [ ] Module hidden when disabled
- [ ] Direct route blocked when disabled
- [ ] API blocked when disabled
- [ ] Audit logs verified
- [ ] Docs updated
- [ ] Changes committed and pushed on feature branch

## Recommended Rollout Policy

For new modules, default to:

```text
registered: yes
enabled for existing accounts: no
enabled for new accounts: no
visible to admins: yes
admin can enable per account: yes
data preserved on disable: yes
```

This avoids surprising users and lets admins roll features out intentionally.

## Anti-Patterns to Avoid

Do not:

- hide modules only in the frontend
- rely on missing database rows to mean enabled
- hard-code module access in scattered components
- let disabled modules continue background processing silently
- delete data when a module is disabled
- ship a module without admin enable/disable controls
- add a nav link without backend access checks
- add API routes without account scoping
- store secrets in generic module settings JSON
- skip audit logs for admin changes

## Suggested Future Improvement

Create a module generator command that scaffolds:

- backend registry entry
- migration
- permission constants
- API route shell
- frontend registry entry
- page shell
- dashboard card shell
- admin toggle wiring
- test stubs
- module README

Example command idea:

```bash
scripts/create-module chores --name "Chores" --category family --dashboard-card --nav --admin-settings
```

The generator should produce boring, consistent wiring so new modules do not depend on memory or guesswork.
