# Discovery Lab rollout and rollback

No production changes are made by adding this source module.

1. Back up the existing SQLite database using the normal operator procedure.
2. Install dependencies and run all release gates in `docs/discovery-lab.md`.
3. Apply Alembic revision `20261024_0030` (and any later revisions) normally.
   The migration creates child Exploration access storage and explicit disabled
   Discovery Lab rows for existing households. Missing rows also default deny.
4. Build/deploy the normal web/backend assets. Build native apps through their
   existing release workflow if native delivery is desired. Merely installing
   an app or migration does not enable the module for a household.
5. A household administrator enables Discovery Lab in existing Admin module
   settings. Review user module grants, then adjust individual child pages with
   the new parent controls before inviting children to explore.
6. Verify both catalog and direct detail access for an allowed child and a
   disabled Exploration. Check scoped parent controls and CSRF enforcement.

For immediate rollback, disable Discovery Lab in the household/global module
settings. This stops API access and preserves page overrides. Prefer this to a
schema downgrade. The migration downgrade deliberately preserves the access
table and saved overrides, while disabling the catalog and household grants.
This is a data-preserving rollback rather than a destructive schema reversal.
Take a backup first; a later re-upgrade preserves the disabled state, so an
operator must explicitly re-enable the module through existing controls.

The module makes no external data calls and adds no secrets. Source references
are ordinary user-activated links. API responses are private authenticated data;
keep existing deployment cache and session-security settings intact.
