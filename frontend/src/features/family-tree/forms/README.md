# Protected web workflows

The route is an adult-only, authoritative-discovery boundary. `ProtectedTree`
owns an ephemeral, per-session QueryClient and busy lease. Content is not loaded
on role fallback, failed discovery, logout, household/account switch or denial.
All Family Tree requests pass the transport's real AbortSignal; staging tasks and
commands abort on retirement. The existing `/modules/me` endpoint currently has
no RequestOptions parameter: discovery publication is logically cancellable,
but underlying discovery HTTP cancellation remains a shared-endpoint hold.

## Cohesive ownership

- `PersonDetails` composes overview, relationship, narrative and private-photo
  panels. Choosers are separate from recorded detail presentation.
- The route retains routing, directory/lens and draft orchestration;
  `TreeGraphPanel` and `useGraphContinuation` own bounded graph presentation and
  continuation ownership. Access notices cannot issue protected reads.
- `TreeAdvancedTools` hosts portalled, protected-session dialogs. Dirty dismissal
  asks first; discarding an import performs real cancellation/readback. There is
  no Replace, GEDCOM, public sharing, child or offline-edit placeholder.
- `useTreeTask` owns a preview/upload/download request, not an automatic retry
  queue. `useTreeCommand` owns frozen revision/idempotency intentions.
  `useTreeSavedReadback` retries only GET verification after a known save, never
  another mutation. `useTreeRefresh` explicitly reviews current records before
  new previews; failed review does not release a conflict intention.

## FT3 commands and checks

Photos upload actual File parts to private server validation. The UI explains
sanitized copies, EXIF/location stripping and preservation of device originals.
Primary, gallery and recorded-story references are explicit. Images use
API-authorized byte reads, checked MIME and temporary Blob URLs, revoked on
close/unmount. Removing a reference does not claim to erase shared assets or
retained backups.

Merge suggestions are advisory. The manager chooses a distinct canonical
person, reviews all conflicts, explicitly selects scalar values and re-previews
changed decisions. Similar partnership retention requires its own review.
Commit checks kind/state/revision/expiry/source/target and current manage access;
readback verifies the exact alias and canonical IDs. Aliases are never silently
resolved for writes.

Purge uses current `can_purge`, not an admin label. Passwords stay in request
bodies, preserve whitespace and clear after preview/commit or dialog retirement.
The final password is entered again. Blocking aliases are reported for explicit
one-at-a-time removal. Alias purge verifies canonical retention; every purge
requires an authorized 404 readback. Retained backup/export policy is displayed.

Logical export requires both manage and `can_export`, including job/download
GETs. JSON clearly omits media bytes; ZIP includes snapshot-referenced media.
Job identity/state/expiry and immutable snapshot revision are checked before
byte download. Filenames are fixed safe application filenames, not paths taken
from response headers. Download Blob URLs are revoked.

Append import stages a real JSON/ZIP File against the current revision and
requires exact job readback before confirmation. Counts, missing media,
warnings, unsupported fields and advisory duplicates are displayed. Previous
provenance needs separate acknowledgement. Commit and committed-job readback are
separate phases. Cancelled/expired jobs are released only after exact denied job
readback; file inputs are remounted so selecting the same file again works.

Network-unknown outcomes retry the identical frozen command/key. Revision
conflicts require explicit current-record review and a new preview, not stale
payload reapplication. Server chronology review sends only the literal
`chronology_review` token after explicit human review. Known saved outcomes with
interrupted readback expose GET-only retry. Offline data is session-only and
visibly stale/read-only; reconnect rechecks authority. No genealogy data or
preview/password/file draft is persisted in localStorage or a service worker.

## Verification boundary

Focused source tests and disposable real-API browser tests are separate evidence
from project typechecks, CI, native-device proof or release admission. Run
`frontend/scripts/run-family-tree-smoke.sh` with the verified backend Python and
configured scratch TMPDIR. Its default uses the canonical frontend build. The
explicit `FAMILY_TREE_SMOKE_DIAGNOSTIC_BUNDLE=1` mode creates a current Vite runtime
bundle only; it **does not pass or replace** the app TypeScript/build gate. Both
modes use the existing managed-directory/marker safety boundary and one isolated
backend/database/media root. The manifest remains unsupported until the parent
owner admits the completed platform after all required gates.
