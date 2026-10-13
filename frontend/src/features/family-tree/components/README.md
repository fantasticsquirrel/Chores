# Family Tree presentation integration

Import named `FamilyTreeGraph` / `FamilyTreeGraphProps` from `./FamilyTreeGraph` and named `FamilyTreeDialog` / `FamilyTreeDialogProps` / `FamilyTreeDialogCloseReason` from `./FamilyTreeDialog`.

## Graph

- `graph: GraphInput`: immutable, already-authorized pure-core projection. The component never fetches, stores, seeds, or decides module access.
- `focusPersonId: number | null`: authoritative tree focus; takes precedence over `options.focusId`. Missing focus uses the bounded relationship list with directory-focus buttons.
- `graphRevision: number`: presentation/readback marker only, **not** a fit/reset key.
- `onSelectPerson(id)`: open caller-owned detail. `onFocusPerson(id)`: caller updates focus / fetches the requested directory component. These are distinct actions.
- `options?: LayoutOptions`: default depths 2/2, partnerships enabled, historical partnerships and care disabled. Web card spacing defaults/minimums are 280px horizontally and 320px vertically; invalid spacing retains core diagnostics instead of being silently repaired.
- `onOptionsChange?(nextOptions)`: when supplied, lens controls are **controlled**: care/history/partnership, directional collapse/expand, and depth expansion emit a complete next lens but do not optimistically claim omitted server facts. Update `options`, fetch the authorized server lens, cancel stale reads and invalidate continuation in the caller. When absent, controls only filter/expand already-loaded projected facts in ephemeral local state.
- `expansionToken?: string | null` + `onLoadMore?()`: show continuation only if both exist. Caller consumes token / merges revision-safe data. `loading` disables continuation and marks the section busy; existing supplied data remains visible during refresh.

Fit runs once when a graph first becomes available for its focus/lens context, after focus/depth/filter/spacing context changes, or via explicit Fit / keyboard Home. Graph revision, new array identity, changed projection bounds and collapse do not reset manual pan/zoom. Viewport resizing does not silently refit. Use graph navigation buttons, arrow keys, +/−, or single-pointer drag; use the unscaled relationship-list alternative for dense or narrow layouts. Fit is an overview and can scale card targets below 44px; unscaled toolbar/list actions remain at least 44px. No native gesture/device claim is made.

Core errors/cycles/resource bounds use diagnosed bounded list fallback. Archived and merged aliases follow core exclusion rules. There is no route/module-unavailable handling, edit form, network call, or persistent cache in this layer.

## Controlled dialog

Required props: `open`, `title`, `children`, `onRequestClose(reason)`. Optional `description` and `initialFocusRef` (an enabled visible tabbable descendant).

Every Escape, Close button and backdrop dismissal calls `onRequestClose` with `"escape"`, `"close-button"`, or `"backdrop"`. The dialog never changes `open`: caller-owned draft policy must explicitly approve closure. Keep `open` true to retain drafts on dismissal rejection. A caller may open a second `FamilyTreeDialog` for confirmation; only the top portal owns focus/Escape, and nested close restores parent focus without releasing the scroll lock. The component portals directly to `document.body`, contains Tab/focus, makes background body siblings inert, restores their prior inert/overflow state and restores the surviving trigger on committed close/unmount. No confirmation/mutation action is synthesized.

## Verification scope

Colocated component tests execute the actual `@family-manager/family-tree-core`, not a mocked layout. Focused component/ESLint commands and isolated Chromium screenshots are reported with the delivery summary. Scratch browser fixtures are synthetic and never installed in source, API, storage, or production households. Full application routes, backend workflows, native devices and deployment acceptance remain caller-owned gates.
