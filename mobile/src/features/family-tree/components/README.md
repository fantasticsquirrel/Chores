# Native Family Tree presentation integration

Named exports (no default export):

```ts
import { FamilyTreeGraph, type FamilyTreeGraphProps } from "./FamilyTreeGraph";
import { FamilyTreeDialog, type FamilyTreeDialogProps } from "./FamilyTreeDialog";
```

## Graph props

```ts
interface FamilyTreeGraphProps {
  graph: GraphInput;
  focusPersonId: number | null;
  graphRevision: number;
  onSelectPerson: (id: number) => void;
  onPersonTrigger?: (ref: RefObject<View | null>) => void;
  onFocusPerson: (id: number) => void;
  options?: LayoutOptions;
  onOptionsChange?: (options: LayoutOptions) => void;
  expansionToken?: string | null;
  onLoadMore?: () => void;
  loading?: boolean;
  maxDepth?: number;
  expansionCounts?: Readonly<Record<number, { parents: number; children: number }>>;
}
```

`GraphInput` and `LayoutOptions` are imported from
`@family-manager/family-tree-core`. The owning screen adapts authorized DTOs;
these components do not perform authorization, DTO adaptation, requests,
navigation, uploads or persistence. The mobile workspace must declare the core
package dependency at integration time; this presentation slice does not edit
manifests. An installed root workspace link resolves the focused tests.

- `onSelectPerson` opens/selects detail; `onFocusPerson` changes the graph focus.
  The visible check mark and selected accessibility state identify graph focus,
  not an independently selected detail pane.
- Defaults: two ancestor and descendant levels; explicit partnerships included;
  historical partnerships hidden; care hidden. Supplied `LayoutOptions` override
  these decisions. Care is labeled as care, never ancestry/genetics. Recorded
  co-parents never create a partnership. Unknown birth years remain unknown.
- **Supply `onOptionsChange` in the real workflow.** History, care, partnership,
  collapse and loaded-depth expansion actions publish complete effective options
  including `focusId`, typed context flags and directional collapse arrays.
  Replace the owning screen's graph query lens, clear its old continuation token,
  cancel/supersede obsolete reads and fetch the requested projection. Local
  optimistic display changes apply only to already-loaded data; they do not
  claim missing server history was loaded. Without the callback, controls are a
  local-only presentation fallback suitable for fixtures, not complete server
  lens integration.
- A lens action immediately hides the previous continuation token. A new token,
  or a clear-then-replace token lifecycle, enables continuation again.
  `onLoadMore` takes no arguments: the caller binds it to the current authorized
  projection/token. Tokens are never displayed or persisted. No continuation
  button is rendered without both token and callback. Loading disables it.
- Layout and relationship indexes come from the bounded pure core. Default
  limits are 250 nodes / 500 edges / 20,000 iterations; valid supplied limits
  cannot exceed 500 / 1,000 / 100,000. Invalid roots, malformed records, missing
  focus, cycles and truncation expose safe diagnostics and a bounded relationship
  list. Archived and merged aliases are omitted by the core.
- Presentation is a **native generation-row graph**, not an SVG canvas: core
  ranks/order, native cards and textual typed relationship routes, with an
  explicit relationship-list alternative and non-color pattern legend. The
  viewport owns horizontal/vertical scrolling; text/card height is not fixed.
  No gesture, pinch, zoom or desktop embed dependency is added.
- **Fit returns the focused person to view at readable card size.** It does not
  scale an entire dense tree into the handset. It calls native `scrollTo` using
  fresh measured row/card positions. Initial focus/lens changes and explicit Fit
  request fitting; fresh graph arrays and revision-only updates do not reset
  scrolling. No animation is used. View controls and all graph actions have
  labeled 44-point minimum touch targets.
- Keep the graph mounted across incidental query refreshes. The surrounding
  screen owns vertical page scrolling, access/loading/error/stale-state policy,
  authorized focus and lifetime boundaries. Unmount/clear presentation on the
  appropriate session/household/access boundary; there is no persistent cache.

## Production workflow integration

- The native screen supplies `maxDepth={10}`, matching the live server query
  validator rather than the pure-core depth limit of 32. Expansion is explicitly
  disabled at that cap; focus a frontier person to explore further.
- Pass server `expansion_counts` through `expansionCounts`. A frontier with
  unprojected parents/children gets a real Expand control even when no matching
  edge is loaded. Current continuation pages are requested first when available;
  otherwise the owning screen receives a deeper lens. Same-revision pages are
  unioned by IDs, bounded to server hard limits, and old query tokens are cleared.
- `onPersonTrigger` passes the actual graph selection button ref to the screen
  before `onSelectPerson`. The screen passes this surviving trigger, or the actual
  directory/Add trigger, to the dialog with a safe header fallback.
- `FamilyTreeButton` also accepts optional `buttonRef?: Ref<View>` for this
  integration. No native gesture, pinch or zoom behavior was added.

## Dialog props and lifecycle

```ts
interface FamilyTreeDialogProps {
  visible: boolean;
  title: string;
  children: ReactNode;
  onRequestClose: () => void;
  returnFocusRef?: RefObject<View | Text | null>;
  fallbackFocusRef?: RefObject<View | Text | null>;
}
```

Compose beneath the existing `SafeAreaProvider`. The platform `Modal` owns
accessibility isolation; its heading receives accessibility focus from native
`onShow`, not a visibility render effect. Its inset-aware sheet is bounded to
the viewport and 640-point maximum width; title, Close and content are all inside
a scroll view so long content does not consume a fixed header/footer budget.

Both Close and Android hardware Back call **only** the caller's `onRequestClose`.
The caller runs its dirty-draft guard and decides whether to commit
`visible=false`; the component never closes itself, clears a draft or navigates.
Swipe dismissal is disabled. Keep the dialog component mounted while changing
`visible` so dismissal/restoration can complete; keep draft state in the owning
workflow rather than using this component as a data authority.

Pass the surviving trigger ref for exact focus restoration. Clear it when that
trigger becomes invalid/removed and provide a surviving safe fallback ref.
No animation is used: Android restoration follows committed `visible=false`;
iOS restoration waits for native `onDismiss`. Focus is never restored while the
app is background/inactive; a pending restoration resolves the then-surviving
ref on active return. Unmount removes the AppState subscription and does not
attempt restoration into an abandoned screen.

## Native FT3 composition

`FamilyTreeScreen` composes `useTreeTools`, `PersonAdvanced` and `TransferTools`
with the existing authoritative FT2 workflow; these graph/dialog components
remain presentation-only. Feature-owned controllers live in `lib/advanced`.

- Media uses installed Expo ImagePicker (photos only), File/Directory, document
  picker and sharing APIs. Native multipart uses real URI/name/MIME parts, not
  editable URI text. Photo upload stages a sanitized server copy, then attaches
  a revisioned primary/gallery/story reference. Removal and private binary view
  use the real reference/content endpoints. Display bytes become a bounded
  in-memory data URI; photographs are never saved to a download cache.
- Picker copies are copied into an opaque module-owned cache directory and
  deleted on upload, discard, failure cleanup or scope invalidation. Only SDK
  ImagePicker copies (including its installed iOS direct-cache UUID form) are
  removed; selected library/document originals are never deleted. Imports
  disable the SDK's implicit document-picker cache copy. User-requested exports
  write exact authorized ArrayBuffer bytes to a temporary File, invoke native
  share/save and delete the module-owned file on completion/error/interruption
  or scope invalidation. The recipient's explicitly saved copy is outside the
  module's cleanup boundary.
- Duplicate suggestions are bounded advisory name/alias matches from the
  available authorized directory. Merge requires an explicit canonical target,
  actual retained scalar values, a resolved server preview, separate episode
  review and target-specific confirmation. Preview shows retained records,
  relationship changes and flat-alias retargeting. Cancellation never unmerges.
- Purge is gated by affirmative collection `can_purge` plus module manage, not
  by administrator/owner labels. Fresh password is body-only and cleared from
  the input after each call. Unknown-outcome retry retains only immutable
  revision/token/key/person facts, never the password. Each explicit attempt
  reads newly entered authentication and releases it immediately after the API
  attempt; password is outside the backend receipt digest. Original receipt
  retry can pass a now-stale preview, but a new stale intent cannot. No password
  enters DraftMemory/storage/logs/URLs. Blocking alias IDs are shown
  only from the actual scoped structured error. Alias purge never implies
  canonical purge; a new target preview is required after explicit alias removal.
- Logical ZIP/metadata-only JSON export has create/status/download controls and
  explicit media omissions. Staged JSON/ZIP import has picker/upload, counts,
  warnings, missing media, unsupported fields, duplicate suggestions/provenance,
  explicit reviewed append confirmation, status refresh and confirmed cancel.
  No Replace/GEDCOM/raw database or account-reconnection controls exist.
- The core owns coarse loading/write/revision state, including reservation of
  uncertain advanced commands. Different writes cannot replace a pending key.
  Immutable command bodies/keys and uploaded asset IDs survive timeout/abort
  for explicit retry. Changed decisions require an explicitly discarded intent
  and fresh preview/key; revision, expiry, kind/state, target and current
  capabilities are checked independently of display-summary readers. No stale
  revision is clamped and no request is automatically replayed.
- Every owned API call forwards a per-request AbortSignal. Module discovery
  itself now forwards its feature-owned signal to `/modules/me`; the global
  auth/module hooks and transport mechanisms are unchanged. Scope/permission
  invalidation synchronously aborts work and clears private data, decisions,
  temporary files and drafts. Commits supersede old reads and refresh the
  affected collection/directory/graph/person before allowing another write.

Feature limits: 10 MiB JPEG/PNG/WebP photographs, 25 megapixels, 100 MiB input
packages, bounded 250 MiB exported bytes; server decoding/archive/domain quotas
remain authoritative. No new dependency, persistent genealogy cache, token URL,
remote image fetch, activation or device installation is introduced.

`FamilyTreeScreen.ft3.test.tsx` invokes actual API-method seams and installed
platform adapters with only external OS seams controlled. `nativeFiles.test.tsx`
also executes the installed RN FormData and actual production ApiClient binary/
multipart transport with fetch controlled. `workflows.test.ts` exercises all 16
new method seams and scoped retry/denial/stale/cleanup behavior;
`discoveryTransport.test.ts` exercises actual feature-owned module HTTP abort.
These are source/host proofs, not backend durability, handset or live API proof.

### Native frontier safeguards and final host gate

Editors and destructive confirmations retain the authoritative target snapshot
revision used to open them; photo drafts/ref removals and complete story order
use their own source revisions. Incidental collection/access refresh does not
promote those baselines. A first stale submission conflicts; only explicit
latest-fact review/reapply creates a new revision/key. Identity-unlink review
shows original and latest association ID, kind, user/child IDs, label and active
state, not merely the person's biography.

Normal saves, conflict reapply, chronology confirmation and advanced commits
record the known mutation envelope before dependent reads. A collection/affected-record readback failure
retains that receipt and exposes GET-only refresh; it never resubmits an already
acknowledged mutation. Chronology confirmation changes facts and rotates the
key. Network module discovery failure hides in-memory drafts/unknown receipts
until successful authoritative discovery; affirmative denial, scope change or
capability loss clears them and aborts owned work.

Initial lane checkpoint on the pinned runtime passed whole-project TypeScript,
235 Vitest tests / 26 files, 334 Jest tests / 40 files and the actual Expo
alignment check. The coordinator then added ten regressions and independently
passed the complete canonical mobile gate: **245 Vitest / 26 files**, **334
Jest / 40 files**, TypeScript and **Dependencies are up to date**. Existing FT2
characterization tests remain unchanged.

The post-ACK module-discovery outage was reproduced and corrected: the receipt
is retained but hidden until authoritative rediscovery, while affirmative denial,
authentication invalidation and disposal still clear it. Media, merge, purge and
import retire their immutable mutation intents immediately at ACK, before any
readback; a discovery outage cannot leave an acknowledged POST retry pending.
Conflict review also records its reviewed revision and is invalidated when a
subsequent read advances the collection. Reapplication cannot silently adopt a
later unreviewed revision. Focused fault tests use actual controllers and API
method seams, not live backend or handset behavior.

All scoped production files remain below the 500-line ceiling, without
exceptions, minification or trailing whitespace. Exact current source bounds,
hashes and gate evidence are retained in the private coordinator artifacts.
These checks do not admit the canonical unsupported mobile platform or replace
independent review, CI, signed binaries, authorized live journeys or handset
proof. Global/household/support flags are unchanged.

## Verified presentation evidence and limits (historical slice)

Pinned Node 20.19.4 / npm 10.8.2, installed Expo 56 / RN 0.85.3,
React 19.2.3, Jest Expo and React Native Testing Library. No production core or
component mocks: only native scroll/focus/AppState seams are controlled.

- `FamilyTreeGraph.test.tsx`: **16 passed**.
- `FamilyTreeDialog.test.tsx`: **8 passed**.
- `lib/presentation/graphPresentation.test.ts`: **8 passed**.
- Adjacent native `BottomNavigation.test.tsx`: **8 passed**;
  `SafeAreaScreen.test.tsx`: **2 passed**.
- Actual core adjacent tests: dates **24**, defenses **11**, graph **25**, all
  passed.
- Focused strict TypeScript checks include the actual components, helpers and
  tests (plus imported dependencies); scoped whitespace checks passed.

RED was observed against executable native scaffolds: 17 missing-behavior
assertions failed; one existing modal-hidden-child behavior passed. The added
server-lens/continuation and stale-focus-coordinate regressions failed before
implementation, then passed. Background restoration and malformed-scalar memo
key regressions also failed before their fixes. Additional boundary cases
characterize already-working behavior; they are not fabricated RED evidence.

Reproduce from repository root (native command switches to the mobile workspace):

```sh
npx --yes --package=node@20.19.4 --package=npm@10.8.2 -c 'cd mobile && node ../node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/features/family-tree/components/FamilyTreeGraph.test.tsx src/features/family-tree/components/FamilyTreeDialog.test.tsx src/components/SafeAreaScreen.test.tsx src/navigation/BottomNavigation.test.tsx'
npx --yes --package=node@20.19.4 --package=npm@10.8.2 -c 'node node_modules/vitest/vitest.mjs run mobile/src/features/family-tree/lib/presentation/graphPresentation.test.ts packages/family-tree-core/src/graph.test.ts packages/family-tree-core/src/defenses.test.ts packages/family-tree-core/src/dates.test.ts --environment node'
```

These are native test-renderer/style/interaction contracts, **not installed-device
proof**. No Android/iOS handset/emulator, TalkBack/VoiceOver, native pixel/overflow
screenshots, physical drag scrolling, keyboard-resize journey, signed app or
live API journey was exercised. No named-device 100-node interaction or 500-node
performance budget is claimed; host test timings are not native performance
measurements. Full screen/API/module integration, whole-mobile gates and device
acceptance remain with the workflow/release lanes. No web screenshot substitutes
for native evidence.
