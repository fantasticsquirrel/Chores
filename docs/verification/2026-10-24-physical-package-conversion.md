# Physical-world package conversion verification — 2026-10-24

## Scope

Nine independent worker-rich-v1 packages: Machine Workshop, Heat House, Pressure Tank, Moving Plates, Cloud and Rain Lab, Magnetic Fields, Cell Explorer, Shape Slicer, Adaptation Island. Every worker bundles its own copied scene construction, deterministic model, lessons and interaction transitions. Shared author utilities serialize data and orchestrate prediction/baseline/comparison; no topic dispatcher or app simulation import executes in the host. Native bundled originals remain unchanged; downloaded rich packages are web-only.

## Automated author verification

- `node --test scripts/exploration-packages/physical-packages.test.mjs`: thirteen tests passed after final formatting, including all nine control ranges/enums, both guided investigations, prediction/baseline gating, reset, custom actions, physical edge relationships, exact serialized original-versus-package default geometry/material/camera/label equality, and mechanics ray-selection/orbit-miss behavior. The thirteenth regression verifies the independent educational-review fix: manual changes invalidate comparison evidence and require a new baseline.
- Explicit `tsc --noEmit --target es2020 --module esnext --moduleResolution bundler --skipLibCheck --strict` across the helper and all nine worker entrypoints passed after final formatting.
- Worker builds were approximately 351–389 KiB, within the explicit 1 MiB rich source ceiling. Initial full frames were approximately 71 KiB–1.46 MiB. All states exercised by the tests parse under the rich frame/resource limits. Subsequent unchanged geometry/material/texture arrays use the resource-patch transport, which is merged and fully revalidated by the host.
- Separate package-local teaching models preserve ideal work conservation, signed heat transfer/area accounting, hydrostatic head and jet speed, invented plate loading indices, separate cloud/rain conditions, exterior magnetic cancellation, equal-volume concentration conservation, exact cross-section areas and deterministic inherited proportions.

## Browser visual review

Reproducible harness:

```
node scripts/exploration-packages/physical-browser-build.mjs
CHROMIUM_EXECUTABLE_PATH=/tmp/chromium \
PHYSICAL_PROOF_OUTPUT=/tmp/physical-package-proof \
node scripts/exploration-packages/physical-browser-review.mjs
```

The executable is an available Chromium 153 headless shell with sandbox enabled. No unsafe Chromium flags, live account, production database or app deployment is used. The harness bundles the actual original ExpansionCanvas/scene builders and actual trusted RichSceneView/vector renderer. Package frames come from the independently bundled worker, including resource-patch reconstruction. It intercepts a local test URL instead of depending on a server in another process namespace.

Captured and inspected nine topics × default/meaningful alternate × desktop 1100 px/mobile 390 px = 36 matched visual comparisons (72 visual screenshots), plus 18 full evidence/lesson proof frames. Browser page errors: zero. Horizontal overflow: zero. Alternate states: gear winch at ratio four; thick insulation/large windows; wide tank with dry outlet; convergent plate diagram at 80%; cloud with rain; like-facing magnets with midpoint cancellation; animal cell/glucose carrier; diagonal hexagonal cube slice; pale habitat without predation.

Geometry richness, transparent shells/water, terrain colors, organelles, field curves, ropes/gears, jet/no-jet distinction and cutaway sections remain intact. Generic label/control styling differs deliberately from original per-topic UI. Original canvas aspect-dependent framing was corrected in the shared serializer. Package background was restored to the exact original dark color. Low-contrast camera instructions on dark backgrounds were fixed by the renderer owner, then Cell mobile and Moving Plates desktop were recaptured and inspected. Shape Slicer retains the filled, equal-scale straight-on vector section; Heat House and Adaptation Island retain graphical magnitude/proportion comparisons, not just text substitutes.

The proof harness checks render fidelity, not authenticated upload/publish/approval or full React control-to-sandbox UI lifecycle; those require the coordinating application's integration smoke. Harness control/evidence scaffolding is not presented as that end-to-end proof. Screenshot output contains no user account data.

## Educational review and fixes

Each package presents an answerable relationship, prediction before a controlled baseline, an observable changed state and an explanation question. Investigation metadata overrides use the actual package button names. All nine preserve necessary limitations and units. Zero/edge cases include zero work at nonzero balancing force, reversed/zero heat transfer, dry outlet, transform slip threshold, cloud without rain, zero magnetic direction, passive transport conservation, tangent/empty sections, absent variants and generation cap.

Independent reviewer found stale static comparison evidence after changing a control. The shared author helper now clears comparison stage after manual controls, custom actions and successful scene picks; a fresh baseline is required. This prevents old 196.2 J machine evidence being shown with a changed 100 kg load. Existing source citations were carried forward; a fresh external-source reopening was not part of this port verification and is not claimed here.

## Independent security review

New tests: `frontend/src/features/discovery-lab/packages/rich/securityReview.test.ts` and `backend/tests/test_discovery_rich_security_review.py`.

Findings observed before correction:

1. A benign two-frame 4×4 APNG and animated WebP were accepted by ingestion while image pixel ceilings counted only one frame. This could move unbounded animation decode work outside the worker watchdog. Backend now rejects animated/multiframe raster images; frontend rejects PNG acTL before native decoding. Both backend regressions were observed red before the change, then passed.
2. Nested SVG scale transforms could exceed the intended safe composed-transform range. Vector validation now bounds local and inherited affine composition.
3. Self-referencing and cyclic pattern paint resources were accepted. Vector validation now rejects cycles in the resource dependency graph. Both vector regression tests were observed red, then passed after the vector owner's fixes.

Post-fix results: eight independent rich security tests plus cache/adversarial/runtime authorization coverage, 18 tests passed; backend animation regressions plus rich ingestion/resource-limit tests, nine passed. Checks include malformed index/attribute buffers, aggregate instanced triangle and texture ceilings, resource-patch first-frame/reset behavior, stale resource references, revalidation against the current asset allowlist, executable SVG/event/style/external URL rejection, and declared-user-button-only bounded audio. Renderer code cross-checks declared texture dimensions against verified decoded assets before texture allocation. Package cache requires fresh server authorization, identity/version changes retire old content, offline events remove playback, and periodic/focus rechecks stop revoked versions. These checks do not replace backend household/role/grant enforcement.

Browser-isolation reproduction is `node scripts/exploration-packages/physical-security-browser.mjs`, which tests the actual rich sandbox with capability forgery, CSP-blocked imports/eval/storage, a busy worker, a valid-output-then-idle-loop worker, oversized output and cyclic output. All browser probes passed with Chromium 153: denied APIs were unavailable, external/blob imports failed with exact CSP errors and zero external responses, forged capabilities did not start workers, and all four loop/oversized/cyclic cases terminated. An initial about:blank harness was invalid because it lacked the application secure context and crypto UUID support; the final probe uses intercepted localhost and explicitly asserts a secure context. This uses only small synthetic probes. Limits bound accepted output/render work; they are not a hard JavaScript heap quota before browser termination.

## Remaining coordinated gates

The parent change owner runs full frontend/backend/shared/mobile gates, integrated sandbox/application lifecycle smoke, final generated manifests/archives and release documentation. No push, publication or deployment was performed by this package conversion worker.

## Independent parametric contract follow-up

The bounded shape/extrude addition was independently reviewed after its implementation. Four new suites in `securityReview.test.ts` reject malformed command arity, unknown methods and callback options, holes/bevel/step overrides, nonfinite or out-of-range coordinates/radii/angles/depth, noninteger or excessive segments, command count and sampled-point overflow. They verify aggregate generated-resource budgets even for unused geometry, and instanced triangle ceilings for repeated shared geometry. Real Three allocations for dense ellipse, cubic and quadratic paths in both shape and extrusion modes remain below the conservative preallocation estimates. No additional security defect was found.

Authored stage layout accepts only bounded numeric height and four bounded numeric/percentage insets; CSS expressions, URLs and arbitrary style keys are rejected. Camera interactivity accepts only a boolean. The independent `fixedCameraReview.test.tsx` verifies keyboard and an actual captured pointer gesture cannot move a fixed camera, zoom controls are absent, and the authored stage remains clipped. A misleading default gesture hint on fixed cameras was reported to the renderer owner as a minor UX correction.

Results: the expanded independent security suite has 12 passing tests; together with fixed-camera, path geometry and renderer resource lifecycle tests, four files / 18 tests pass. These tests allocate only bounded synthetic geometry and do not run resource bombs.
