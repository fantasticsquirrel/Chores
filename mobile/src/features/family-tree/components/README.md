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
  onFocusPerson: (id: number) => void;
  options?: LayoutOptions;
  onOptionsChange?: (options: LayoutOptions) => void;
  expansionToken?: string | null;
  onLoadMore?: () => void;
  loading?: boolean;
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

## Verified evidence and limits

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
