# Standard Module Creation Guide

Use this guide for module-gated Family Manager feature areas. The repository has
one checked manifest for module metadata; it does not have, and does not need, a
plugin runtime.

## Source of Truth

The canonical manifest is
`packages/family-api/module-contract.json`. One module entry owns:

- the stable module key, name, description, and platform labels;
- default grants for `PARENT_ADMIN`, `PARENT`, and `CHILD`;
- explicit web and mobile support;
- the primary destination for each supported platform;
- navigation visibility and dashboard-card availability.

`backend/app/modules.py` loads and validates that manifest, exposes the backend
catalog, and derives `DEFAULT_ROLE_MODULES`. `packages/family-api/src/modules.ts`
loads the same file for typed web/mobile metadata. Web and mobile registries
derive labels, roles, destinations, navigation, and dashboard flags from it.

The manifest is metadata, not authorization. Backend route dependencies,
household and user module rows, role checks, ownership checks, and CSRF/session
policy remain authoritative. A hidden client route never substitutes for a
backend `require_module_access(...)`, `require_module_view(...)`, or
`require_module_manage(...)` dependency.

## Manifest Shape

Each entry is keyed by the same value as its `key` field:

```json
{
  "chores": {
    "key": "chores",
    "name": "Chores",
    "description": "Chore assignments, submissions, approvals, and rewards.",
    "labels": {
      "web": "Chores",
      "mobile": "Chores"
    },
    "default_grants": {
      "PARENT_ADMIN": true,
      "PARENT": true,
      "CHILD": true
    },
    "platforms": {
      "web": {
        "supported": true,
        "destination": "/parent/chores",
        "roles": ["PARENT_ADMIN", "PARENT"],
        "navigation": true,
        "dashboard": true
      },
      "mobile": {
        "supported": true,
        "destination": "chores",
        "roles": ["PARENT_ADMIN", "PARENT"],
        "navigation": true,
        "dashboard": true
      }
    }
  }
}
```

Rules:

- Keys are stable lowercase URL-safe identifiers and must match the object key.
- All roles have an explicit boolean default grant. Missing rows never silently
  create a new grant policy.
- Both platforms are explicit. Unsupported platforms use `supported: false`, a
  `null` destination, empty roles, and disabled navigation/dashboard flags.
- Platform roles must have a default grant. Role-specific secondary routes may
  remain platform code, but the primary module destination belongs here.
- `navigation` requests a registered nav destination and module guard.
- `dashboard` requests a registered dashboard integration. The component must
  still check the effective module list returned by the backend.

## Reduced Onboarding Process

Normal onboarding has four small parts:

1. Build the domain slice. Add backend models/migrations/services/routes and the
   web/mobile page or screen only for platforms the feature actually supports.
2. Add one entry to the canonical manifest. Do not repeat labels, role defaults,
   or primary destinations in backend, web, and mobile metadata files.
3. Register actual integration code. Add the backend module guard to every API
   route, and register the supported platform route/navigation/guard/dashboard
   implementation in `frontend/src/modules/registry.ts` or
   `mobile/src/modules/registry.ts`. Registrations describe real code; they do
   not grant access.
4. Run the module validator and adjacent/full gates. A requested integration is
   incomplete until its route, navigation, guard, and dashboard registration
   agree with the manifest.

Database rollout is still deliberate. A new catalog entry does not decide how
existing household rows should change. Add an Alembic migration when persisted
catalog or household defaults change, state whether existing households receive
the module, and preserve module data when access is disabled.

## What the Validator Enforces

`validateModuleManifest(...)` in
`packages/family-api/src/module-manifest-validator.ts` reports:

- backend/shared key drift;
- a supported platform without its primary route or navigation registration;
- a navigation-enabled module without a module guard;
- a requested dashboard card without a platform registration;
- backend/shared role-default drift from the canonical manifest.

The validator has negative tests for every failure class plus an integration
test using the checked web and mobile registrations. Backend contract tests also
exercise the Python loader and derived defaults.

## Copyable Module Checklist

### Contract and rollout

- [ ] Choose a stable lowercase module key.
- [ ] Define roles, default grants, supported platforms, primary destinations,
      navigation visibility, and dashboard availability.
- [ ] Add exactly one metadata entry to
      `packages/family-api/module-contract.json`.
- [ ] Decide the migration behavior for existing and new households; never rely
      on an ambiguous missing-row default.

### Backend domain and security

- [ ] Add domain models/migrations/services and thin API routes as needed.
- [ ] Guard every module API route with backend role and module-access checks.
- [ ] Keep protected lookups scoped to the authenticated household/owner/child.
- [ ] Preserve CSRF/session rules, last-admin protection, and transaction timing.
- [ ] Add success plus disabled-module, wrong-role, and cross-household tests.
- [ ] Audit admin changes and validate module-specific settings server-side.

### Platform integration

- [ ] Add the web route/page if `platforms.web.supported` is true.
- [ ] Add the mobile tab/screen if `platforms.mobile.supported` is true.
- [ ] Register each supported platform route and requested navigation item.
- [ ] Register a module guard for every navigation-enabled module.
- [ ] Register requested dashboard UI and hide it when effective access is absent.
- [ ] Verify a direct disabled route is friendly and makes no protected data call.

### Verification and release

- [ ] Run `npm run modules:validate`.
- [ ] Run `.venv/bin/pytest backend/tests/test_module_contract.py` and relevant
      authorization/API tests.
- [ ] Run shared contract tests, frontend lint/test/build, and mobile
      typecheck/tests.
- [ ] Run `cd backend && alembic check` for schema-facing changes.
- [ ] Run dependency/security gates and relevant Playwright/mobile smoke flows.
- [ ] Run `python3 scripts/architecture-report.py --strict` and
      `git diff --check`.
- [ ] Document rollout, rollback, and any intentionally retained compatibility
      seam; commit and push on the feature branch without merging.

## Compatibility Cleanup

Compatibility facades and re-export files are temporary. Delete one only after:

- repository search finds no production, test, migration, or script old-path
  imports;
- targeted and full tests pass through the replacement path;
- generated build output contains no old-path reference;
- at least one independent slice has exercised the replacement when an external
  consumer may exist;
- the removal and any retained seam are recorded in the architecture docs and
  commit.

Do not delete a live migration bridge, credential fallback, public deployment
redirect, or fixture safety boundary merely to reduce file count.

## Anti-Patterns

- Do not add a plugin loader, dynamic code execution, or client-authoritative
  permission system.
- Do not copy module labels/default roles into three platform registries.
- Do not mark a platform supported before its route and navigation behavior exist.
- Do not register a dashboard card that makes requests while the module is disabled.
- Do not delete module data when a household disables access.
- Do not weaken backend authorization because the validator covers client wiring.
