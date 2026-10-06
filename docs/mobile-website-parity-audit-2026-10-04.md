# Website → mobile parity audit — 2026-10-04

## Scope and release boundary

Compared the deployed household website with the React Native/Expo app source. Household workflows are in scope; the separate platform-operator console is not a household mobile destination. Implementation is on `feature/mobile-website-parity-20261004`, starting from `4bcdf455a809c6642d208a0a496332bb953cb20b`.

This is **source parity work**, not a published release. Production household data, the live service, main/master, stores and EAS build submissions were not changed. The current installed/distributed app does not acquire these features until an approved release is built and installed.

## Workflow inventory

| Household workflow | Existing app at audit start | Candidate |
| --- | --- | --- |
| Parent/child sign-in; recovery | Present; registration entry absent | Parent registration opens the canonical website; passwords are cleared after attempts |
| Password change/logout | Password change retained a revoked UI session | Password success returns to sign-in; logout clears local session/module/CSRF state even on failure |
| Parent daily dashboard | Summary totals without website task shortcuts | Pending review, children needing attention, Homeschool and cookbook shortcuts |
| Chore definitions, schedules, assignments | Native screens present | Retained; write controls require explicit module manage authority |
| Children and child credentials | Native management present | Retained; Children remains reachable from Homeschool when Chores is disabled |
| Submission review and money | Native workflows present | Retained; read-only grants do not offer household writes |
| Child today/week/money | Native workflows present | Retained; recipe management is never exposed to children |
| Homeschool calendar/setup/records | Native workflows present | Retained; management actions obey authoritative grants |
| Household/account/subscription controls | Native destinations present | Retained; platform ownership/payment enforcement remains server-owned |
| Notification inbox | Missing | All/unread filtering, personal mark-read/read-all with readback, gated related-page navigation and retry |
| Personal reminders | Missing | In-app/email and digest/overdue preferences, save/readback; children can manage their own preferences |
| Recipe discovery | No native screen/API surface | Module-gated cookbook, search and server-side category/tag/favorite/rating/ingredient filters |
| Recipe create/import/edit | Missing | Full manual forms and URL import; serving/yield, metadata, categories/tags, components and step bindings retained |
| Recipe detail/cooking/scaling | Missing | Standalone detail, ingredient checks, linked step quantities, step navigation, server-authoritative servings/multiplier scaling |
| Variants/duplicates/feedback | Missing | Separate duplicate and variant endpoints; parent/child feedback and linked component/core/variant navigation |
| Delete/backup/restore/output | Missing | Exact-title destructive confirmation; version-1 JSON export/file sharing and pasted restore; print/PDF via Expo Print |

### Native adaptations

- Registration and parent recovery remain browser-based workflows, as recovery already was. No token or password is embedded in the outgoing URL.
- Restore accepts pasted version-1 JSON instead of a desktop file chooser. JSON export creates an actual file/share action, not merely a text share.
- Portable restore strips owner/database/category/tag/component/core IDs. Internal ingredient→step bindings are converted to local positions before old IDs are removed. It does not recreate foreign account relationships.
- Native print/share dialogs require an installed-device check. Expo Web download/print and mocked SDK-boundary tests are **not** native OS handoff evidence.
- New Expo Print/Sharing/FileSystem runtime dependencies are justified by real document/file outputs. Expo and Expo Modules Core patch levels and the single root lockfile were aligned to the SDK compatibility checker.

## Safety and state invariants

- Missing or false `can_manage` fails closed for household mutation controls. Server authorization and owner/household scoping were not relaxed.
- Recipe action authority matches the backend: creators and household admins may edit/delete with a manage grant; other managed parents may duplicate, add variants and write feedback without editing the original.
- The app shell actually mounts the access provider and registered destinations; typed navigation alone is not accepted as integration proof.
- Removing Recipes or changing the actor/grant remounts/discards recipe-owned state. A recipe-only account does not request the Chores-protected child roster.
- Personal notification read-state/preferences are not household-admin writes. Their backend routes authenticate the current user, so view-only children keep those controls.
- The real backend serializer emits persisted step `ingredient_ids` with empty `ingredient_position_refs`. Editing, displaying and restoring convert IDs through that exact recipe's ingredient rows. Tests mirror the actual serializer rather than invented positional response fields.
- Cookie-changing authentication requests, including password change, are serialized. Matching password-change success clears CSRF before subsequent auth dispatch and clears the revoked controller session even after navigation unmounts the form; its UI completion cannot tear down a replacement actor's session. Controller generations discard stale bootstrap/logout responses; module-cache generations discard grants after clearing or a newer refresh. Local teardown prevents delayed bootstrap CSRF from being republished.
- The web More-menu focus path uses DOM refs rather than unsupported native `findNodeHandle`; native iOS/Android focus behavior remains covered separately.
- Recipe and notification form labels, entered values, placeholders, selection text and focus borders use runtime theme colors. Automated contrast checks cover all three themes; recipe checkboxes publish checked state to both native and web accessibility consumers. Expo Web browser evidence is not a native rendering verdict.
- Numeric recipe drafts retain incremental decimal entry, including `1.5`, `0.5` and `.5`. Save deliberately converts valid drafts into the API payload; invalid drafts block submission instead of saving an obsolete value. Browser QA types a fractional quantity character by character and verifies its persisted and scaled values.
- Recipe workflow transitions reset the shell's real scroll owner. The cookbook no longer nests an independent vertical scroller inside the shell.
- Live verification was read-only. Mutating UI/API checks use a disposable, guarded temporary SQLite database and loopback preview/API.

## Evidence and pending gates

- Deployed website: authenticated desktop and 390px checks on ten routes; no page errors or horizontal overflow in the recorded audit.
- Source: focused RED→GREEN tests cover API/CSRF transport, actual screen mounting, permissions, registration, password teardown, recipes, inbox and Home.
- Revision-fresh quality gates are required after review corrections. Exact identities, counts and verdicts are recorded in the external delivery evidence; older passes do not approve later changes.
- A web calendar test assumed September after its child fixture disappeared. It now asserts all rendered date controls are disabled, preserving the intended rule without wall-clock month dependence; the focused test passed.
- Local evidence lives outside Git. Final counts, immutable candidate identity, review verdicts and browser readbacks belong in the delivery evidence, not a self-referential commit claim here.

### Source blocker remediation — 2026-10-05

- Native Expo push now has authenticated session-bound registration, a durable
  generic-message outbox, retry/receipt processing, explicit device opt-in and
  verified readbacks, token/response listeners owned by the authenticated shell,
  safe retry and authenticated route validation. It defaults off. See
  [setup and provider gates](native-push-setup.md).
- No patched compatible npm releases were available for braces/node-forge.
  Exact package sources are now locally backported and integrity-checked on
  every install and before mobile audit admission; exploit regressions must
  pass. The raw npm report and version-based advisories remain visible. Only
  the exact verified repaired advisories/nodes can be normalized before the
  unchanged strict image-size validator runs. Unknown source, advisory,
  version, severity or graph drift fails closed. See
  [backport provenance](dependency-security-backports.md).
- A separate SDK56 diagnostic Android APK compiled, including notification
  modules, and its debug signature was verified. This is not the final
  distributed app or real-device delivery proof.

### Not yet a release verdict

Final full quality gates, exports/browser QA and independent source reviews must
name the frozen follow-up candidate; older results do not approve it. Remote CI
must name the pushed exact revision if a PR is published. Evidence and verdicts
are recorded outside source, not as a self-referential release claim here.

Release remains held on:

- Approved canonical merge/deployment and a new signed release artifact.
- FCM v1/APNs credentials and Android Firebase client configuration (absent on
  current provider/local readback), approved backend activation, real remote
  push receipt and lifecycle checks.
- Installed Android/iOS keyboard, Back, print/file sharing, lifecycle and
  accessibility tests. No connected device was available for this audit.

Do not mark shipped-app parity complete from source, exports, or debug-build
success alone.
