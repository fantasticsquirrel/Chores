# Family Tree — candidate operator runbook

**Status: implementation candidate, not a deployment or activation record.**
The global catalog and household opt-in remain disabled. Independent review,
full schema/CI gates and complete platform journeys are still required. These
instructions do not authorize a production change, scheduled job or release.
The full product contract remains `docs/specifications/family-tree-module.md`.

## Authority and activation boundary

- Genealogy is household-owned and shared only with authorized adult viewers.
  Manage access is separate; bulk export, transfer previews and identity
  candidates also require manage. Child and platform-support sessions are not
  household content roles.
- The initial migration seeds disabled access, including existing households;
  registration initializes disabled household access. Missing household rows
  are not an opt-in. Disabling access does not delete genealogy.
- Apply and verify the actual candidate's Alembic head before exposing new
  application code. Do not let catalog initialization substitute for migration.
- Global activation is a separately authorized release action after gates pass.
  A household admin with Admin manage then opts that household in through the
  existing module controls. Ordinary genealogy manage does not grant Admin.
- Never use real households or public/static files for fixtures, rehearsal or
  temporary permission elevation. The isolated browser harness requires a
  private managed directory, marker and `PLAYWRIGHT_ISOLATED_DB=1`.

## Private storage configuration

`FAMILY_TREE_STORAGE_ROOT` is required for media and transfers. Set it to an
explicit absolute persistent directory outside web roots and source/build
output. The service account needs access; root, managed subdirectories and
files are private (0700 directories, 0600 files). Symlinked roots/ancestors are
rejected. There is no cwd, public-assets or client-selected server-path fallback.

The store has `objects`, `artifacts` and `staging` directories. Object keys are
opaque and immutable. Application copies are decoded/sanitized; EXIF/location
metadata is stripped and display dimensions are reduced. User originals stay
on their device. Remote citations are not fetched or used as remote images.

Current audited ceilings may be reduced, not silently increased:

- `FAMILY_TREE_IMAGE_MAX_BYTES`: 10 MiB per image; JPEG, PNG or WebP only.
- `FAMILY_TREE_IMAGE_MAX_PIXELS`: 25 million decoded pixels.
- `FAMILY_TREE_HOUSEHOLD_MEDIA_MAX_BYTES`: 1 GiB of retained managed images.
- `FAMILY_TREE_IMPORT_MAX_BYTES`: 100 MiB compressed/uploaded input.
- `FAMILY_TREE_IMPORT_MAX_EXPANDED_BYTES`: 250 MiB expanded archive content.
- `FAMILY_TREE_TRANSFER_SECONDS`: 120-second processing budget.
- Portable manifests: at most 5,000 people, 20,000 combined relationship facts,
  40,000 combined story/residence records and 1,000 media files. Validation
  rejects an entire over-limit append rather than partially installing it.

The module APIs serve bytes through current authorization with private/no-store
responses. Download/job IDs are scoped references, not public bearer links.
Do not add a public nginx/static mapping to any store or backup directory.

## Two different backup products

**Household logical export** is a versioned Family Tree JSON or ZIP. It excludes
live account/security/grant/billing IDs and unrelated modules. Metadata-only
JSON explicitly omits image bytes. ZIP is the self-contained form for referenced
validated images. Import is staged, reviewed, revision-bound append with new
local IDs; it never installs a SQLite file or reconnects identities by itself.

**Operator recovery backup** includes the application database and a checksum
inventory of immutable Family Tree objects/staging artifacts. It contains
protected application data, not just genealogy. Keep packages private and
outside downloadable web assets. SQLite's online backup API is used; copying a
live WAL-backed database file or merely checkpointing it is not a recovery proof.

Before the first Family Tree schema migration, use the application's approved
existing online-backup procedure. The new CLI below expects its media/transfer
tables to exist and must not be presented as a pre-schema backup tool.

## Operator commands after compatible schema exists

Run from the actual candidate checkout using its verified backend interpreter.
Set the real service database/storage paths first; do not substitute an implicit
or default database. `PYTHON_BIN`, `APP_SQLITE_FILE`, `NEW_PRIVATE_BACKUP_DIR`,
`BACKUP_PACKAGE` and `NEW_REHEARSAL_DIR` below are operator-selected values, not
provided defaults. Destinations must be new directories; parent directories
must already exist. Never target the live database as a restore destination.

```bash
PYTHONPATH=backend "$PYTHON_BIN" backend/scripts/family_tree_ops.py \
  --database "$APP_SQLITE_FILE" backup \
  --destination "$NEW_PRIVATE_BACKUP_DIR" --retention-days 30

PYTHONPATH=backend "$PYTHON_BIN" backend/scripts/family_tree_ops.py \
  rehearse --backup "$BACKUP_PACKAGE" \
  --destination "$NEW_REHEARSAL_DIR" --scratch-root "${TMPDIR:?}"

PYTHONPATH=backend "$PYTHON_BIN" backend/scripts/family_tree_ops.py \
  --database "$APP_SQLITE_FILE" cleanup --batch-size 100
```

Backup creation verifies DB integrity/FKs, copies and verifies each immutable
object and writes a manifest with snapshot identity, collection revisions and
checksums. Rehearsal is restricted to a fresh disposable scratch directory;
read back the restored DB, references and bytes, including unrelated modules.
A command exiting successfully is not a substitute for this readback.

`--retention-days` bounds live media retention pins (1–366 days). It does **not**
automatically delete old backup packages. The deployment operator must approve
and configure package retention, a bounded cleanup/backup schedule and failure
alerts. None is claimed installed by this source change. A permanent purge does
not promise immediate removal from historical backups; tell users when those
packages actually expire under the approved policy.

Cleanup uses DB deletion claims and rechecks references/pins, including upload,
export and backup retention. Active storage operations coordinate with orphan
sweeping. Expired claims and interrupted staging are recoverable; do not replace
this with an unprotected filesystem delete or a check-then-delete script.

## Required verification and rollback

- Run fresh and previous-head upgrade against disposable databases, unfiltered
  `alembic check`, FK/integrity checks and preservation tests. Do not suppress
  baseline drift, weaken ownership or rewrite historical migrations for green.
- Run backend/shared/web/native/security/architecture/dependency gates and
  exact-revision independent review. Record CI for the actual PR head and,
  after an authorized merge, for the resulting integration commit.
- Exercise media/reference/cleanup races, preview staleness, idempotent replay,
  flat merged aliases and canonical purge blockers, scoped downloads and
  append rollback. Preserve content and other modules on denial/disable.
- Use disposable desktop/mobile-web fixtures for browser journeys. Native
  screen/Jest or mobile-width browser evidence is not handset/device proof.
- Initial rollback disables the global module and hides access while retaining
  compatible schema, data and private objects. Do not destructively downgrade
  newly populated genealogy or install a raw database through an application
  upload endpoint. A full disaster restore stays an authorized operator task.

Operational output and alerts should contain IDs/counts/outcomes, never names,
story bodies, birth details, photos, credentials, bundles or complete requests.
Review concrete failures rather than treating a timeout as approval.
