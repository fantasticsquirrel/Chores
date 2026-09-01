# Zammad Support Integration

This checklist is the execution record for adding Zammad to Family Manager. Zammad is the ticket system of record; Family Manager remains the customer-facing portal and authentication boundary.

## Architecture and safety

- [x] Keep customer authentication in Family Manager; do not expose the Zammad API token to browsers.
- [x] Scope every ticket operation to the authenticated parent and household.
- [x] Preserve the existing local `SupportCase` authorization gate used by privileged billing reconciliation.
- [x] Add a feature flag and graceful disabled/unavailable responses.
- [x] Add request correlation/idempotency, webhook HMAC verification, timestamp validation, and receipt deduplication.
- [x] Keep database, Redis, and Elasticsearch ports private in the deployment runbook.

## Family Manager backend

- [x] Add Zammad configuration with production validation.
- [x] Add ticket-link and webhook-receipt models plus Alembic migration.
- [x] Add a bounded, timeout-controlled Zammad REST client.
- [x] Add parent-only create/list/detail/reply routes.
- [x] Add authenticated webhook ingestion and cached-state reconciliation.
- [x] Add manual reconciliation endpoint for household administrators.
- [x] Add focused backend security/integration tests.
- [ ] Clear the pre-existing Python environment audit findings (Starlette, python-multipart, aiohttp, cryptography, idna, msgpack, click, and pip) in a separately tested dependency-hardening change.
- [ ] Add attachment uploads after a malware-scanning/quarantine service is selected.

## Family Manager frontend

- [x] Register the Support module for parent roles and navigation.
- [x] Add ticket list/create/detail/reply experience.
- [x] Add disabled and degraded states.
- [x] Add dashboard quick action.
- [x] Add frontend route/UI tests.
- [ ] Run authenticated production visual QA after a live Zammad endpoint is available.

## Infrastructure and operations

- [x] Document deployment, backup, restore, monitoring, and rollback procedures.
- [x] Provide non-secret example environment configuration.
- [ ] Provision a dedicated VPS (recommended: 4 vCPU, 8 GiB RAM, 80–100 GiB SSD).
- [ ] Create `support.multihost.ing` DNS and TLS.
- [ ] Deploy a pinned upstream `zammad-docker-compose` release.
- [ ] Configure Zammad groups, roles, MFA, custom fields, integration account/token, and webhook trigger.
- [ ] Configure encrypted off-host nightly backups and complete a clean restore drill.
- [ ] Run staging end-to-end acceptance tests against live Zammad.
- [ ] Enable `ZAMMAD_ENABLED=true` behind the Family Manager feature flag.
- [ ] Observe for 7 days, then remove the old local-only support-case creation path.

## Acceptance criteria

- [x] Automated tests prove parents cannot access another household's ticket links.
- [x] Duplicate create requests and webhook deliveries are idempotent.
- [x] Forged or stale webhooks are rejected.
- [x] Zammad failure does not break unrelated Family Manager modules.
- [ ] Agent changes appear in Family Manager within 60 seconds in staging/production.
- [ ] Backup restores into a clean Zammad stack.
- [ ] Desktop and mobile before/after evidence passes on the live integrated UI.
