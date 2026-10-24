# Independent rich packages: all 26 Explorations

> Implementation follow-through: all 26 independent author packages now exist.
> The final measured budgets and compatibility behavior are documented in
> `../discovery-rich-packages.md`; this document preserves the original plan.
> In particular rich archives use 8 MiB compressed / 12 MiB expanded limits
> to retain the complete local Solar textures; legacy limits are unchanged.
> See `../verification/2026-10-24-all-exploration-packages.md` for acceptance evidence.

## Scope and baseline

Implement a one-time application runtime upgrade, then convert all 26 current
Explorations into independently publishable packages. This is a source-code and
verification project, not authorization to push, merge, deploy, import production
content, change child grants, or release Android. Dig Through Time is not included.
Master was verified at `0af1f2cc15b91691eeb30c7ec65b9ae07ee137f1` on 24 October
2026. Reuse the tested Castle proof `2d4c753` intact. The separate Android 1.0.14
release is untouched. Local working branch: `feat/all-exploration-packages`.

The Castle proof establishes genuine package-owned geometry, procedural textures,
controls and teaching, with 18 matched desktop/mobile 3D renders pixel-identical
to the original. It does not establish parity for the other 25. Every item below
requires its own implementation and evidence; copying metadata or selecting a
bundled scene ID is not conversion.

## Runtime architecture and ownership

- Retain `worker-v1` and `worker-3d-v1` compatibility. Introduce an explicit
  `worker-rich-v1` capability for the larger contract so older clients do not
  interpret unsupported features as an empty or degraded successful scene.
- Author packages contain private copies of their complete scene construction,
  deterministic scientific models, state transitions, controls, investigations,
  feedback and necessary local assets. Build-time reuse of a generic serializer
  and established Three constructors is permitted. Runtime imports of app topic
  implementations are not. Produce self-contained worker entrypoints.
- Use a bounded author-side Three serializer to preserve exact indexed geometry,
  transforms and materials. The trusted app constructs only allowlisted objects
  from validated data. Never use ObjectLoader, arbitrary shaders, HTML injection,
  downloaded main-thread code, dynamic dependency installation or network assets.
- Extend generic geometry to indexed buffers, normals, UVs and vertex colors;
  lines/segments/point clouds; quaternions; physical, transparent and emissive
  material properties; orthographic/perspective cameras; ambient and point lights.
- Resolve image references solely against verified package bytes and MIME/checksum
  declarations. Preserve NASA Moon/Earth maps and their credits. Procedural artwork
  becomes package-owned raster assets or bounded texture drawing data.
- Preserve animation using validated reusable resources and bounded frame updates,
  not full GPU scene allocation every frame. Pause/reset/end-state semantics,
  reduced motion, page visibility and teardown must be explicit.
- Add bounded structured 2D path/gradient artwork and mixed 2D/3D views where the
  original uses them. Pointer picks and drags map only to named numeric actions;
  equivalent keyboard controls remain available. Sound needs trusted user-gesture
  audio with strict frequency/gain/duration limits and a visible non-audio result.
- Existing controls/sections carry package-authored teaching and evidence. Raise
  finite button/control budgets only where inspected original interaction needs
  require it; do not erase shortcuts merely to fit an arbitrary old limit.

## Security and resource gates

Retain opaque-origin worker isolation, restrictive CSP, no child-session or
household identifiers in the worker, independent heartbeat, response deadline,
fail-closed online authorization, memory-only content caching, immutable versions,
household scope and exact-version parent approval. Rich workers target a 1 MiB
source cap and a 4 MiB serialized scene cap; old contracts retain their lower
limits. Archive limits initially remain 2 MiB compressed / 4 MiB expanded / 32
files, subject to measured asset requirements, not silent disabling. All limits
must be enforced before expensive allocation and covered by adversarial tests.

Geometry requires aggregate vertex/index/triangle/node/material/texture budgets,
finite numbers, index bounds, bounded recursion, valid attribute lengths and
safe resource IDs. Image validation includes decoded dimensions and aggregate
pixel budgets. Reject external asset URLs, unknown executable fields, traversal,
duplicate files/keys, MIME mismatch and oversized/compression-bomb content.
Frame queues must be bounded/coalesced without dropping deliberate learner
actions. Revoke and dispose geometry, textures, audio and workers on logout,
identity change, disabled grants, update, offline state and unmount.

There is no browser-enforceable hard worker heap quota. These caps and watchdogs
reduce risk but cannot promise immunity from memory pressure. That limitation
remains explicit, including in release notes.

## Catalog, permissions and compatibility rollout

1. Preserve every original bundled ID, URL and native implementation. Each package
   initially uses `<original-id>-package`; no package may overwrite a bundled ID.
   Existing parent overrides continue governing their original records.
2. Do not seed, publish or approve packages automatically. Deliver importable ZIPs
   and source first. A parent explicitly imports, previews and publishes each
   immutable package version, then grants that exact version to selected children.
   A previously enabled bundled lesson is not approval for new downloaded code.
3. Distinguish built-in and downloaded versions visibly in the catalog and detail
   screen. Group package alternatives with their original topic when safe, while
   retaining explicit links to both; do not silently redirect old bookmarks to
   changed content or hide a disabled original behind a package permission.
   The backend remains the authority for either record, regardless of grouping.
4. Published update and rollback both invalidate prior package grants under the
   existing policy. Reapproval is required even when rolling back to a formerly
   approved version. Preserve exact checksums and display version/source labels.
5. Native downloads remain unsupported. Native apps retain the full bundled
   Explorations and a clear web-only message for uploaded packages. Older clients
   must fail explicitly for unsupported runtime capabilities; they must not try
   a different bundled topic as a substitute.
6. Current Discovery persistence contains access overrides and package grants,
   not learner progress records. Simulation state is local and reset on remount.
   Do not fabricate progress migration. If durable progress is later introduced,
   separate stable learning identity from version-specific execution state and
   require explicit compatible state migrations.
7. Rollback is operationally reversible: keep built-in content available and
   preserve immutable ZIP versions. No destructive database/data migration is
   needed for the initial package collection. Production activation is separate.

## Dependency batches and effort

This is a substantial multi-family migration, not 26 manifest edits. Effort is
relative to the inspected implementation, not a promised calendar estimate.

- A: Runtime/serializer, schema and adversarial tests (very high, blocks fidelity).
  Establish image textures, geometry/resource reuse, animation, mixed vector
  views, pointer controls and optional safe audio before declaring topic parity.
- B: Castle already proved (low remaining integration; fallback still a gap).
  Port procedural physical-world family (9, high) and space/leaf family (5, very
  high for textured dual-view Solar/Moon) against the shared contract in parallel.
- C: Tactile/landscape family (10, very high for exact terrain, slice picking,
  chance statistics and audio) plus Optics (1, high for vector/touch fidelity).
- D: Per-topic package builds, independent update/rollback examples, math/content
  review and desktop/mobile browser parity (high; mandatory for every topic).
- E: Aggregate regression/build/type checks, independent security and education
  review, source recovery artifacts, draft PR description. Ask before publishing.

## Per-Exploration migration plans

The following family plans are part of this plan and will be incorporated into
the standalone deliverable. Each identifies original rendering, interactions,
models, instructional distinctions, conversion requirements and verification.

- [Space, Moon, leaf and optics (6)](2026-10-24-package-plan-space-life.md)
- [Tactile, engineering and landscape (10)](2026-10-24-package-plan-tactile-landscape.md)
- [Physical-world, biology and geometry (9)](2026-10-24-package-plan-physical-world.md)

### 7. Castle Design Lab — `castle-defenses`

Original: `castle/createCastleScene`, fortress/terrain/material authoring, Castle
learning and route/sight models. Package proof already owns masonry textures,
towers/walls/gatehouse, ditch/bridge/terrain, route endpoints, sight overlays,
camera presets, six controls and two prediction/comparison investigations.
Preserve the 13th-century English-inspired composite caveat, distinguish routes
from sight lines, and never imply simulated siege success. Test every toggle,
ditch extremes, north/bridge routes, tower restoration and reset; reuse the 18
matched desktop/mobile visual fixtures. Existing proof reports textual evidence
on WebGL failure but lacks the original 2D plan fallback: implement a bounded
package-owned fallback before claiming equivalent fallback behavior, or explicitly
record it as an unresolved fidelity gate. Native Castle remains unchanged.

## Acceptance matrix and stop conditions

For each of the 26, retain evidence of:

- A self-contained package build validated by the exact server parser, with no
  topic implementation references in the host and necessary license notices.
- Original-vs-package deterministic model and boundary equivalence; reset,
  repeated controls, interrupted animation, back/forward and rapid interactions.
- Both guided investigations actually executable. Prediction feedback must explain
  evidence and must not reward an incorrect answer as correct; retain assumptions,
  units, source attribution and conceptual distinctions from the content standard.
- Real matched-state browser screenshots and pixel review at desktop and mobile,
  including defaults, important extrema and alternate modes. Do not substitute
  scene counts or parser tests for rendered review. Explain intentional differences.
- Keyboard/touch parity, pointer cancellation, 320/390 px layout, nonvisual evidence,
  reduced motion, WebGL/assets unavailable behavior and explicit native limits.
- Upload/preview/publish/use of v1, update v2 and rollback without rebuilding app;
  exact-version reapproval, original override preservation, household isolation,
  offline/revocation shutdown and bounded malicious-resource rejection.

Run full backend, frontend, shared-contract and native tests; lint, frontend build,
native typecheck, module validation and diff checks on the final combined source.
Run browser suites for each renderer and all 26 topic smokes. Independent reviewers
check security and rendered educational quality. Preserve source/package/test
artifacts in Library at milestones. A topic remains incomplete if its visuals,
interaction, teaching, package independence or meaningful verification is missing.
Do not claim 26/26 until these gates actually pass. Report concrete remaining gaps
and do not publish the branch, merge or deploy without separate authorization.
