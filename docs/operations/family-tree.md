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

## Worker admission, time and memory budgets

The current implementation is synchronous request work (FastAPI's sync/threadpool
paths), **not a background job queue or a dedicated two-thread executor**.
`FamilyTreeBodyLimitMiddleware` admits **two heavy requests per ASGI process**
using a non-blocking semaphore. Media upload, import staging, import commit and
export paths (including downloads) share those slots. A third heavy request
receives retryable **503 / `server_busy`**, without joining a module-owned queue.
An admitted request retains its slot through response execution and releases it
on failure. Other web-server/threadpool/network queues still exist; this limit
is not a global server concurrency or authenticated-user limit. With `W` ASGI
processes and `R` replicas the deployment may admit **2 × W × R** simultaneous
heavy requests; there is no cross-process semaphore. The operator CLI runs in
its own process and does not consume these API slots. Approve non-overlapping
operator schedules/capacity separately, rather than assuming it shares the cap.

Distinct constraints, not interchangeable memory guarantees:

- Manifest parsing is bounded to **16 MiB**, with the finite row counts above.
  Request body caps include bounded multipart overhead (64 KiB for image/import).
- The **120-second import staging processing budget** is checked at bounded
  phase/media boundaries; it is cooperative, **not a hard deadline interrupting
  one JSON/Pydantic or image decode call**, and does not include upload/network
  time or promise every export/commit/request completes within 120 seconds.
  SQLite online backup separately checks a 120-second budget in progress callbacks.
  Storage locking and DB contention can produce retryable 503 rather than success.
- 100 MiB input, 250 MiB expanded content, 10 MiB encoded image, 25 million pixels,
  retained-media quota and 20 pending ready jobs per household/actor constrain
  different resources. **250 MiB expanded bytes is not a peak RSS ceiling**.
  Python objects, validation copies, decoded pixels, baseline application memory,
  allocator retention and simultaneous requests require additional headroom.
- An HTTP timeout/disconnect is not proof a sync decode stopped or a command
  rolled back. Check authoritative job/revision state and retry ambiguous writes
  with the existing idempotency key, not a newly invented command key.

### Reproducible bounded reference measurement (not capacity approval)

Run one disposable probe at a time with the candidate's verified backend
interpreter, after checking host/cgroup available memory; do not run it alongside
other heavy benchmarks. No application database/private store is opened. The
script needs only existing backend dependencies and Python stdlib:

```bash
PYTHONPATH=backend "$PYTHON_BIN" backend/scripts/family_tree_memory_probe.py
```

The script creates a fixed synthetic fixture in a **single controlled subprocess**,
then calls real `portable.decode` (JSON + strict Pydantic), `portable.validate`,
and `media.sanitize` (Pillow verify/decode/resize/re-encode). The child has a
**768 MiB address-space** safety ceiling, 30-second CPU ceiling and 90-second
parent wall timeout; these are **probe guards, not approved production budgets**.
It emits JSON including platform/interpreter, limits, counts, elapsed time,
`/proc/self/status` baseline RSS and Linux `resource.getrusage` peak RSS. Failed
probes exit nonzero without publishing a successful measurement. Generation
and one over-count validation check are included in the reported process peak.

Actual source-reference run on **October 13, 2026**, CPython **3.12.3**,
`Linux-6.8.0-136-generic-x86_64-with-glibc2.39`:

| Fixture / result | Measured value |
|---|---:|
| Manifest | 5,000 people, 1,024 synthetic note bytes each; 5,464,064 encoded bytes |
| Other manifest groups | 0 relationships, 0 story/residence records, 0 media entries |
| Image | one RGB 4,096 × 4,096 PNG; 16,777,216 pixels; 58,637 input bytes |
| Sanitized output | 2,048 × 2,048 PNG; 21,243 bytes |
| Baseline imported-process RSS | 78,651,392 bytes (75.01 MiB) |
| RSS after parser/whole-package validation | 115,879,936 bytes (110.51 MiB) |
| Process peak RSS | **300,109,824 bytes (286.21 MiB)** |
| JSON/Pydantic + package validation elapsed | 0.446405 seconds |
| Image sanitize elapsed | 1.048945 seconds |
| Fixture workload elapsed | 2.298731 seconds (after imports, including generation/checks) |
| 5,001-person count boundary | production parser rejected with 413 `resource_limit` |

Live host memory was checked before this run (7,941 MiB total, 3,032 MiB available);
those values describe that host at measurement time, not deployment capacity.
The solid-color PNG is highly compressible, RGB-only and below 25 million pixels.
**This does not cover a 16 MiB maximum manifest, all maximum row groups together,
1,000 media, 25-million-pixel/worst-codec input, a full API process, or two
concurrent heavy requests.** No fabricated maximum-case RSS is extrapolated.
The full limits are reported by the probe; only the fixture above was measured.

**Operator memory-budget approval remains HOLD.** Before deployment, measure the
actual full application's idle/high-water RSS and representative approved limit
cases in a disposable environment, including adversarial near-limit JSON/media
and expected process/replica concurrency. Budget per-process baseline once plus
concurrent workload increments, allocator retention and explicit safety headroom;
budget all processes/replicas plus separate operator tasks and other services.
Do not multiply this reference's entire peak and call it an approved memory limit.
Approve cgroup/container memory, worker/replica counts, OS reserve, overload policy
and alert thresholds together. If a maximum case cannot be safely exercised,
reduce source/deployment limits through review or retain the hold. Nothing here
sets production memory, schedules jobs, installs monitoring or approves release.

## Reduced production-policy candidate and executed ASGI evidence

This section supersedes the earlier **capacity measurement gap** for the exact
reduced synthetic case below; it does **not** approve deployment, full source
ceilings, production data distribution, or arbitrary concurrent application load.
The existing defaults/hard ceilings above remain unchanged. Install the reviewed
`ops/family-tree/app-capacity.env.example` values explicitly, rather than assuming
that a memory cgroup silently reduces logical collection limits:

| Setting suffix (`FAMILY_TREE_`) | Candidate value |
|---|---:|
| `MAX_PEOPLE` | 500 |
| `MAX_FACTS` (combined parent/care/partner) | 2,000 |
| `MAX_RECORDS` (combined story/residence) | 4,000 |
| `MAX_MEDIA` (distinct referenced portable assets) | 100 |
| `MAX_REFERENCES` | 4,000 |
| `MANIFEST_MAX_BYTES` | 2,097,152 (2 MiB) |
| `IMAGE_MAX_BYTES` | 8,388,608 (8 MiB) |
| `IMAGE_MAX_PIXELS` | 16,000,000 (allows ordinary 12 MP photos) |
| `IMPORT_MAX_BYTES` | 16,777,216 (16 MiB) |
| `IMPORT_MAX_EXPANDED_BYTES` | 33,554,432 (32 MiB) |
| `HOUSEHOLD_MEDIA_MAX_BYTES` | 268,435,456 (256 MiB) |
| `TRANSFER_WORKERS` | 1 per ASGI process |

All settings reject zero, negative, malformed or above-source-ceiling values.
The new count/manifest overrides default to the original 5,000 / 20,000 /
40,000 / 1,000 / 40,000 / 16 MiB ceilings; transfer admission defaults to two
and cannot be increased. Configure before starting the application. Ordinary
person/relative, combined relationship and combined record insertions share
these count caps with append import and snapshot export, inside the existing
serialized graph transaction. Attachment additions also enforce reference and
distinct referenced-asset caps; unattached uploads remain retained-byte-quota
bounded. Existing over-cap data is not deleted; lower policy can reject new
appends or logical export. Inventory before lowering a live household's policy.
Count bounds do not promise that arbitrary maximum-length text fits the manifest
byte bound: a large logical snapshot can still require operator recovery backup.

Reproduce serially, with no other heavy probes/suites on the shared host:

```bash
PYTHONPATH=backend "$PYTHON_BIN" backend/scripts/family_tree_rollout_probe.py --profile asgi
```

The default ASGI mode starts one guarded child and creates only a marked,
private disposable SQLite DB/object store under the Hermes scratch root. It
imports the **real application**, logs into a synthetic household with CSRF,
stages ZIP multipart bytes, commits the import through ASGI, reads the actual
SQL counts and every stored object's checksum, exports/downloads a ZIP and
verifies every exported byte inventory/checksum. No production configuration or
provider secrets are inherited. The fixture store is removed on normal exit.
Guard-killed fixtures may remain under the marked scratch directory for owned
cleanup; never sweep production roots.

Final executed candidate case on October 19, 2026:

- 500 people, **2,000 care facts**, 4,000 stories, 100 real media files and 4,000
  references; 2,014,595 normalized manifest bytes; 14,752,639 ZIP input bytes;
  33,471,795 actual expanded bytes (near the 32 MiB configured bound).
- **Each of the 100 PNGs decoded 4,000 × 4,000 RGBA pixels (16 MP)** during real
  import staging, sequentially with the parsed graph retained. Each input has a
  valid solid-color PNG plus random/zero trailing padding, exercising actual
  compressed/expanded archive accounting, not only declared lengths. Additional
  JPEG/RGB and WebP/RGBA 16 MP uploads went through the real media API and
  authorized content/checksum readback. This is synthetic compressible pixel
  content, **not worst-entropy codec or actual production workload distribution**.
- Actual initialized application baseline RSS **133,750,784 bytes**; child peak
  RSS **599,212,032 bytes**; sampled parent+child peak **613,556,224 bytes**;
  complete workload **159.470 seconds**, including DB/app/fixture initialization,
  archive staging, commit, export/readbacks and extra codec uploads. The reported
  `staging_seconds=119.957` includes setup/generation before staging, not only
  the import request. The application kept its existing cooperative 120-second
  import processing budget; the probe guard is not a request latency promise.
- Child RLIMIT_AS **1,536 MiB**, parent+child sampled RSS guard **1,280 MiB**, CPU
  guard 170 seconds, parent wall guard **180 seconds**, host available-memory
  preflight at least **2 GiB**. Child exit zero. Raw evidence is
  `asgi-capacity-final.json` in the rollout artifact directory, not a deployment
  approval. A previous source-ceiling 25 MP MemoryError under a 1 GiB guard was
  controlled failure; it is neither production OOM proof nor full-source approval.

Candidate application budget: **MemoryHigh=1280M, MemoryMax=1536M,
MemorySwapMax=0**, one uvicorn worker, one replica and admission one. Example
`app-memory.conf.example` is not installed. The measured case has headroom below
these budgets but does not prove total live service baseline/unrelated request
load or backup overlap fits. Parent must review final source, verify production
baseline and fresh production-clone schema/data preservation, install reviewed
private roots/config, run manual backup/restore and sandbox units, then decide
activation. Keep full-default-maximum capacity HOLD; do not rerun the prior
unbounded full-source workload on this shared host.

Maintenance candidates now require **both backup and cleanup success within
36 hours**, reject future timestamps/failure markers, and check the actual DB
parent, configured private storage, backup root and state filesystems. Health
returns nonzero below **256 MiB free or 10% free**, whichever reserve is larger,
or when a configured path cannot be checked. `FAMILY_TREE_OPS_BACKUP_ROOT` may
select an explicitly provisioned private backup root; default is
`/var/backups/chore-tracker/family-tree`. The unit sandbox's writable DB directory
is the discovered `/var/ralph-projects/chore_tracking/data`, not `backend`.
Health remains local journald/exit status only: no external alert transport is
configured, and timers must not be called monitored until the operator observes
failure and missing-heartbeat signals through an approved monitoring path.

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

## Content-free signals and approved monitor consumption

Existing generic request status/latency/request-ID logs and successful mutation
audit remain intact. Family Tree adds JSON **in the logging message itself** at
`app.services.family_tree.observability`, so existing plain-text handlers retain
the fields (not discarded `extra` metadata). Domain/graph/cleanup signals are
INFO; failure signals are ERROR. The allowlist contains finite events/codes,
operation enums, non-negative numeric IDs/counts and allowlisted exception types.
No exception message/traceback, input/body, genealogy name/story/date/photo,
credential, token, bundle or filesystem path is emitted. Warning codes are only
`chronology_review`, `similar_partner_episode`, `person_merged`,
`stored_ancestry_cycle` and `bounded_search`; unrecognized strings are omitted.

| Signal | Accounting / interpretation |
|---|---|
| `graph_truncated` | Returned projection/compare reached its finite bound, even with HTTP 200; node/edge/visited counts, revision and household ID where available. |
| `validation_warning` | One event per distinct known warning code at a validation/preview/mutation/read seam, not proof a transaction committed. |
| `domain_rejected` | Count by finite `code` to distinguish revision conflict, ancestry cycle rejection, validation, locks, expiry, quotas and other domain denials. |
| `staging_failed` | Failed POST import/export response or raw processing exception, with finite operation/status/classification; domain rejection may also occur. Unknown 4xx/5xx is `unexpected_error`, not inferred from private response text. |
| `staging_expired` | Job no longer ready at access (includes canceled/committed unavailability) or cleanup's count of TTL-expired ready jobs. Access and cleanup signals are not unique-job counts. |
| `quota_rejected` / `admission_rejected` | Finite resource rejection or two-slot admission rejection; limit/count where available. A domain resource rejection also has `domain_rejected`; do not sum categories as independent failed requests. |
| `cleanup_completed` | Aggregate expired-job/pin, deleted-asset and orphan-file counts; not filenames. |
| `cleanup_failed`, `backup_failed`, `rehearse_failed` | Safe classified operator-service failure, with exception TYPE only. |
| `operator_completed` / `operator_failed` | Actual CLI completion/failure and finite operation. Failure produces nonzero exit; no private traceback is printed. |

The existing request middleware publishes its generated request ID into request
scope before downstream work. Family Tree requests accept canonical UUID
correlation, normalize UUID casing and replace arbitrary header text with a fresh
opaque ID; adjacent modules retain their existing request-ID behavior. Domain
signals copy only the validated scope ID (or one valid UUID header for direct
middleware use), including synchronous threadpool work, without mutating scope.
Requests without a supplied ID therefore correlate generated domain events with
the response's `X-Request-ID` and generic logs. Direct operator invocations need
no HTTP correlation. No names, body fields or local actor credentials become
correlation IDs.

An **approved** scheduler/monitor can consume the CLI without changing source:
keep stdout for successful aggregate JSON, ingest newline JSON stderr events,
check the process exit code, and flag nonzero `operator_failed`/service failure.
Exit codes: 0 success, 1 classified runtime failure, 2 safe argument failure,
130 interruption. Missing command/malformed argument errors are classified without
echoing the arguments. `--help` retains normal argparse success. A failed backup
must never be catalogued as a usable recovery point. In application logs, extract
the JSON message after the existing timestamp/level/logger prefix and count by
finite event/code/operation; keep IDs for restricted correlation, **not metric
labels**. Do not count both an operator failure and its underlying service failure
as two incidents. Operator approval must still select secure sink/retention,
schedule, threshold, heartbeat/missing-run alert and RSS/cgroup monitoring. No
scheduler/alert transport/live threshold is installed or claimed verified here.

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
