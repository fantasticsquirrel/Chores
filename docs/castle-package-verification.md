# Castle package conversion verification

Date: 2026-10-24. Baseline: master `0af1f2cc15b91691eeb30c7ec65b9ae07ee137f1`.
Scope: local proof only; no remote push, merge, deployment or production publication.

## What changed

A generic `worker-3d-v1` renderer accepts bounded declarative geometry, materials,
procedural textures, lights, orbit cameras, labels and teaching controls from an
isolated worker. Castle-specific construction and behavior live in independent
package authoring sources and its ZIP, not a hidden call into the bundled Castle.
The original bundled Castle and all existing native implementations are untouched.

The application upgrade is required once. Subsequent packages within this contract
are uploaded/published without rebuilding the main application. The proof publishes
fixture versions 1.0.0 and 1.1.0 with different masonry color and initial gate state;
that changes visible geometry/appearance and reset/control behavior. Those fixture
versions do not change the shipped 1.0.0 example.

## Visual acceptance

Nine matched states on desktop and mobile: courtyard, entrance, north wall, above,
sight overlay, towers removed, gate raised, north route, and added inner wall.
All 18 raw WebGL image pairs have exactly zero changed pixels. Desktop buffers are
1164 × 544 and mobile buffers 394 × 356 in the tested browser. Actual screenshot
pixels were also inspected, not only DOM or descriptors.

Retained: masonry texture and bump detail, projecting towers, merlons, wall walks,
gatehouse arch/voussoirs, portcullis, bridge/planks/structural supports, keep and roof,
hall, well, human scale figures, terrain, trees, water and route endpoints. Cyan
dashed sight rays remain explicitly nonstructural, off by default and after reset.

This is exact 3D-render parity in those tested states, not a claim that the entire
page chrome is pixel-identical. Package controls and Predict/Compare/Explain blocks
use generic responsive presentation; route label emphasis, mobile zoom-glyph size and some spacing differ.
The original WebGL-unavailable plan fallback is not ported: the package shows an
explicit unavailable notice and textual evidence. Native dynamic packages remain
unsupported, clearly labeled web-only; bundled native Castle remains available.

## Automated verification

- Backend: 819 tests passed.
- Frontend: 655 tests passed; lint and build passed.
- Existing vector-package browser regression: desktop and mobile both passed
  (2 tests, 41.7 seconds) after the heartbeat and input-queue changes.
- Shared API: 468 tests passed with the existing backend virtualenv on PATH.
- Native: typecheck passed, 291 unit + 466 UI tests passed (757 total).
- Package-focused frontend: 38 tests passed, including independent malicious-input
  review and queued control/reset regressions.
- CLI: 5 tests passed. Example/author worker: 7 tests passed, including all 128
  boundary-state combinations and exact source geometry preservation.
- Independent authoring TypeScript check and `git diff --check` passed.
- Online Expo dependency check reports pre-existing patch lag: expo 56.0.23 vs
  ~56.0.24, expo-sharing 56.0.26 vs ~56.0.27, jest-expo 56.0.5 vs ~56.0.6.
  No dependencies or Android versions were changed. Offline check succeeds but is
  not substituted for that online warning.

Use `PATH="$PWD/.venv/bin:$PATH"` for shared/frontend producer tests. The default
system Python lacks the backend dependencies. Expo checks use a writable temporary
HOME and `EXPO_NO_TELEMETRY=1`; otherwise this environment's absent normal HOME
causes a setup error, not a product failure.

## Security review

Independent review found and verified corrections for explicit capability gating,
finite-but-degenerate camera values, composed transform overflow, repeated 3D
reconstruction, worker loops after successful output, and queued button/control
state races. Strict allowlists reject unknown loaders, URLs, shaders and arbitrary
properties. Aggregate triangle/node/texture/shadow/depth/output limits are enforced
before trusted renderer allocation. Worker response and independent heartbeat
watchdogs terminate failures. No session/household secrets are supplied to workers.

These limits bound accepted output and render work. They are not a hard JavaScript
worker heap quota; browser/process memory protections still apply.

## Reproduce the local browser proof

Use the repository's disposable fixture harness, not a live database:

```
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/tmp/chromium \
PLAYWRIGHT_CHROMIUM_SANDBOX=1 \
PLAYWRIGHT_SMOKE_KEEP_ARTIFACTS=1 \
npm run test:smoke --workspace frontend -- e2e/discovery-castle-package.spec.ts
```

The executable must be an available supported Chromium binary. This run used
Chromium 153 with sandbox enabled; no `--no-sandbox` or unsafe bundled flags.
The test stores synthetic fixture screenshots and per-viewport evidence in its
retained temporary `castle-parity` directory. Do not publish fixture databases,
credentials, or runtime logs as deliverables.

Browser acceptance: both Castle tests passed (desktop 42.8 s, mobile 33.4 s).
The same app boot marker and asset hash persisted across both published versions:
`efbf78dc91cadd2d4fcaeb5a49ff43f7be4e7996ee4ef3c220c4df9000d8812e`.

Verified parent ZIP upload/preview/publish; new child version disabled until explicit
approval; running old child version removed on refresh; cross-household request 404;
offline canvas and iframe removed; reconnect reauthorizes. Keyboard orbit, zoom,
drag and Home reset were exercised. Normal Castle emitted no external requests.
A deliberate hostile dynamic-import attempt emitted a browser request event but
failed with exact reason `csp`, with zero external responses. Worker capability
probe showed document/fetch/Worker/storage unavailable and prototype-fetch blocked.
Valid-output-then-infinite-loop and invalid-scene workers both lost iframe/canvas
and displayed errors. Page error arrays were empty.

Initial browser runs exposed an inherited 32 px padding difference, corrected before
final matching. Two initial assertions incorrectly counted CSP-blocked request
telemetry as successful network and required a worker console event not exposed by
Playwright. Final tests instead require actual CSP failure, no response, and exact
raw canvas hashes. No failed assertion was silently reported as passed.

Importable example ZIP SHA-256:
`fdf3d712f0bd987d86a73dadbe2fba767435b43910deb2028f759543c6afa4e4`.
The package is 1.0.0, ID `castle-defenses-package`, runtime `worker-3d-v1`.
