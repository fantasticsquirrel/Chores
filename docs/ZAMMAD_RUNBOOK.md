# Zammad Deployment Runbook

Deploy Zammad on a dedicated host using a pinned release of the upstream `zammad-docker-compose` repository. Do not expose PostgreSQL, Redis, or Elasticsearch. Bind Zammad HTTP to loopback and publish only through HTTPS at `support.multihost.ing`.

## Zammad setup

1. Create the `Family Manager Support` group.
2. Create custom ticket fields: `fm_household_id`, `fm_user_id`, `fm_category`, `fm_environment`, `fm_app_version`, and `fm_correlation_id`.
3. Create an integration agent restricted to the support group and issue an access token.
4. Require MFA for human agents; disable public signup and unused channels.
5. Create an action trigger for ticket/article/state changes. POST to `https://family.multihost.ing/chore-api/integrations/zammad/webhook` with `X-Zammad-Timestamp` and `X-Zammad-Signature: sha256=<hex HMAC>` calculated over `<timestamp>.<raw-body>`.
6. Set the Family Manager variables listed in `.env.zammad.example`, restart, verify readiness, then enable the feature flag.

## Backups and restore

- Run the upstream Zammad backup container nightly and copy archives encrypted to off-host storage.
- Back up Compose overrides and secret configuration separately; application backups do not include environment settings.
- Restore into a clean test stack weekly during rollout, then monthly. Rebuild the Elasticsearch index after restore.
- Initial objectives: RPO 24 hours, RTO 4 hours.

## Monitoring and rollback

Monitor container health, disk, API latency, webhook failures, backup age, and TLS expiry. Alert before disk reaches 80%. To roll back, set `ZAMMAD_ENABLED=false`; Family Manager will keep all other modules operational while retaining ticket links for later recovery.

