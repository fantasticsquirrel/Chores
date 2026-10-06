# Native push subscription API and schema

This bounded slice adds session-bound Expo device registration. It does not
change browser push subscriptions, perform network delivery, configure a
provider, or enable native delivery in production.

## Configuration

- `NATIVE_PUSH_ENABLED` defaults to `false`. With this flag disabled, registration
  returns `503`; authenticated config, list, and disable remain available.
- `NATIVE_PUSH_ACCESS_TOKEN` is an optional environment-only provider credential.
  It is excluded from settings representations and all native API responses.
  This registration slice does not use it to make provider requests.
- Browser VAPID settings and browser push behavior are independent.

## Contract

All routes use the established `/chore-api` prefix and require a valid household
user session. Writes also require the existing `X-CSRF-Token` header.

| Method | Route | Result |
| --- | --- | --- |
| GET | `/push/native/config` | `{ "enabled": boolean }` |
| POST | `/push/native/subscriptions` | `201` with `{ "id": number, "platform": "android" or "ios", "enabled": boolean }` |
| GET | `/push/native/subscriptions` | `{ "items": [...] }`, limited to the caller's user, household, and exact session |
| DELETE | `/push/native/subscriptions/{id}` | `204`, disables the caller's session-bound subscription |

Registration accepts only `token` and `platform`. Tokens must be bounded
`ExpoPushToken[...]` or `ExponentPushToken[...]` values with an ASCII
alphanumeric/underscore/hyphen payload of 1–200 characters. Caller-provided
identity fields, URLs, unsupported platforms, and extra fields are rejected.
Validation responses are generic and do not echo tokens or other request data.
No list or registration response exposes tokens or provider credentials.

A token is globally unique. Registration in the same session re-enables and
refreshes its binding. A different still-valid session cannot claim the token
(`409`); a revoked, expired, or stale-generation former session permits rebinding.
A compare-and-swap condition protects rebinding on SQLite, where `FOR UPDATE`
does not lock rows. Database conflicts are returned without bind parameters.
Cross-user, cross-household, and cross-session disables return `404`.

## Migration and rollback

`20261005_0021` follows `20260830_0020` and explicitly creates
`native_push_subscriptions`. Its schema matches the ORM columns, primary key,
platform check, unique token constraint, identity foreign keys with cascading
deletes, and user/session indexes. It neither imports current model metadata
nor backfills or fabricates device tokens, users, sessions, or households.

Sparse SQLite historical fixtures may lack referenced identity tables. SQLite
allows the empty new table's foreign-key declarations in that situation;
foreign-key-enforced registrations still require real identity rows. This is a
fixture compatibility property, not permission to run production with missing
identity tables.

Apply migrations before enabling registration. Back up before rollback:
downgrading to `20260830_0020` removes only this new table and therefore discards
native registrations, while preserving browser push and other data. Re-upgrade
creates an empty native table; clients must register again. No production
migration, configuration change, or provider access was performed in this slice.

## Focused verification

From the repository root, with the project's Python environment active:

```bash
PYTHONPATH=backend python -m pytest backend/tests/test_native_push_api.py -q
PYTHONPATH=backend python -m pytest backend/tests/test_native_push_migrations.py backend/tests/test_alembic_migrations.py -q
```

The migration regression tests were first run without the forward revision:
all seven failed because the explicit migration/table was absent. After adding
it, all seven pass, including fresh install ORM parity, sparse upgrade →
downgrade → re-upgrade with preserved unrelated rows and no synthesized tokens,
uniqueness/platform/identity enforcement, and all three identity delete cascades.
The combined focused migration run passes 17 tests; the API run passes 22 tests.
The API run reports an upstream Starlette/httpx deprecation warning. No full
backend suite or live provider/device delivery is claimed here.
