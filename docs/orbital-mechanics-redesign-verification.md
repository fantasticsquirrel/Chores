# Orbit Workshop redesign verification

Date: 2026-11-01

Branch: `feat/discovery-learning-overhaul`
Baseline: `946b71ede04c918f4f109f2fe1dd44f8c35884a3`

> **Superseded visual acceptance:** Parent review on 2026-11-01 rejected the
> flat central SVG documented below. Orbit Workshop is reopened and is not
> counted complete. The correction status and current verification limits are
> recorded at the end of this document.

## Scope and outcome

Only `orbital-mechanics` was redesigned. The web experience now uses a new
semantic SVG trajectory instrument and persistent, same-scale comparison plots
instead of the previous single 3D trace/control stack. Two gated investigations
require a prediction before action, preserve the controlled variables, show
observable evidence, respond to the selected prediction, and explain the
result. Reset clears both investigations and returns the open model to speed
1×, mass 1× and trace position 0.

The shared dimensionless model is consumed by web and native code. Native uses
the same two guided investigations and measurements. The isolated rich package
is version 1.0.1 and mirrors the guided flow while retaining its existing 3D
renderer and package-local physics copy, as required by the package isolation
boundary. Registry explanation, experiment and misconception text is suppressed
below the complete lesson; accessible Sources remains.

## Independent supervisor correction

The post-redesign review in `/tmp/orbit-independent-review.txt` identified four
real defects. This correction pass stayed within Orbit Workshop and resolved
each one:

- “Circular speed here” is now “Circular launch speed at start.” The value is
  `sqrt(mass)` at the fixed starting distance, not a circular speed recomputed
  at the probe's current radius.
- At the final sampled point, the web SVG, generated native/offline scene and
  worker-rich 3D scene now use the final incoming segment for motion direction.
  The arrow no longer collapses in either guided operated state.
- Escape copy no longer claims that an auto-fitted trace leaves the frame. It
  states that the displayed trace has not returned before the model cutoff.
- Every sampled closest/farthest interval is explicitly labeled as a finite
  “displayed trace,” rather than a complete analytic orbit range.

The old tiny SVG-unit starting-radius label remains absent. Its replacement is
an HTML diagram-key item, “starting radius reference,” tied to the dotted-ring
symbol. Chromium measured its actual computed font size at 12 px and rendered
height at 16 px at both 1440×1000 and 390×844. This is a screen-pixel
measurement, not an SVG user-unit assumption.

## Visual evidence

Raw, immutable before evidence and final after evidence:

- `/tmp/ui-captures/exploration-series-orbital-mechanics/2026-11-01/`
- `before-manifest.json` and `after-manifest.json`: initial and fully operated,
  full page and component, at 1440×1000 and 390×844.
- `focused/focused-manifest.json`: central art, speed evidence and mass evidence
  at both viewports. Each mobile target was measured clear of the fixed bottom
  navigation.
- The requested `capture-ui` helper produced both `before-skill-desktop-*` and
  `after-skill-desktop-*` pairs in the same directory.

Review-ready media:

- `/root/.openclaw/workspace/media/exploration-series/orbital-mechanics/comparisons/operated-desktop-before-after.png`
- `/root/.openclaw/workspace/media/exploration-series/orbital-mechanics/comparisons/operated-mobile-before-after.png`
- `/root/.openclaw/workspace/media/exploration-series/orbital-mechanics/finals/`

Visual inspection found no clipping or horizontal overflow. One iteration
removed a tiny in-canvas label and raised the remaining open-control labels to
12 px. The final browser audit found zero visible text samples below 12 px and
zero visible buttons below 44 px in the lesson at either viewport. Corrected
after captures and every staged final/comparison were refreshed; hashes of all
original `before-*` PNGs were unchanged.

The corrected central art was inspected at both widths. The incoming cyan
motion arrow remains visible at the operated endpoint, the dotted starting
radius is keyed below the scene, and the longer key wraps without collision on
mobile. Focused mobile evidence remains above the fixed navigation.

## Verification results

Correction-pass checks (affected scope only):

- Shared Orbit model regression: 1 file, 5/5 tests.
- Web diagram and Orbit flow regressions: 2 files, 8/8 tests.
- Native Orbit UI regression: 1 suite, 10/10 tests. Its existing npm wrapper
  also ran the mobile non-UI unit set, 32 files and 296/296.
- Worker education regressions: 1 file, 9/9, including a serialized-scene
  assertion that the cyan motion-arrow geometry is visible after a completed
  guided trace.
- Frontend ESLint passed; production build passed with only the existing Zod
  annotation and large-chunk warnings.
- Mobile typecheck and generated offline-scene freshness passed.
- Rich package 1.0.2 rebuilt and validated twice with identical ZIP SHA-256
  `533545882a787b8dd565472a3716c0b7b8726d473c376af478a207ebe1a6a582`.
- Corrected browser interaction/render audit passed at 1440×1000 and 390×844:
  keyboard flow, controlled evidence, reset and boundary controls; zero
  overflow, undersized targets, text below 12 px, console errors or failed
  responses; actual radius-key size 12 px/16 px; nonzero endpoint motion-vector
  length 0.25 at both widths.
- Registry content regression passed 1 file, 29/29; `git diff --check` passed.
  No unrelated frontend, shared, backend, security or full mobile UI gate was
  repeated.

The following broader results are preserved from the original Orbit redesign
checkpoint; they were not rerun after these corrective bytes:

- Red-first shared model test: failed before `orbit.ts` existed; final shared
  focused suite passed 41/41 across model, content and education regressions.
- Red-first web flow/reset test: failed before the guided controls existed;
  final focused web suite passed 37/37. Updated adjacent route/simulation tests
  passed 23/23.
- Full frontend: lint passed; Vitest passed 147 files and 831 tests; production
  build passed with only the repository's existing Zod annotation and large
  chunk warnings.
- Shared contracts: passed 30 files and 486 tests with
  `FAMILY_TREE_CONTRACT_PYTHON=.venv/bin/python`; module validation passed 10/10.
- Native: typecheck and generated-scene freshness passed; focused native lesson
  and detail suites passed 16/16; mobile unit tests passed 32 files and 296
  tests.
- Rich package: education/runtime regressions passed 20/20; the deterministic
  v1.0.1 ZIP validated twice at the original checkpoint with SHA-256
  `05b5dedf1791ac031b5efaf060b88ba63209cefd3c966c7030e82e06e6ce22ec`.
- Backend Discovery/security suites: passed 50 tests with two known library/test
  fixture warnings.
- Browser interaction audit: passed at 1440×1000 and 390×844. It exercised
  keyboard prediction/action flows, correct and incorrect feedback, the
  0-speed/2×-mass collision boundary, the 1.8×-speed/0.5×-mass escape boundary,
  reset, overflow, minimum target/text sizes, console errors and failed
  responses.
- Architecture strict report: zero boundary violations. Existing unplanned
  hotspots outside this module remain listed by the report.
- Security: source backports passed 51/51; frontend production dependency audit
  reported zero vulnerabilities; touched-source injection/eval scan found no
  matches; package validation, parser/runtime tests and backend adversarial/rich
  security tests passed.
- `git diff --check` passed.

## Honest gaps

- No physical native-device or real screen-reader session was run.
- The full mobile UI suite ended at 529 passed and one unrelated, reproducible
  Family Tree failure in
  `scopeRecoveryRemediation.test.tsx` (`People` is present in the rendered tree
  but its role query times out). Orbit-focused native tests and mobile typecheck
  are green; the unrelated module was not changed in this single-module run.
- The worker-rich package keeps its established 3D central scene. Its lesson
  flow, copy and evidence changed, but the renderer itself was not graphically
  redesigned. Downloaded packages remain web-only in native, as stated by the
  existing contract.
- No package was published, no deployment was run, and production was not
  touched.

## Parent visual correction status

The correction replaces the flat primary SVG with a demand-rendered Three.js
scene driven by the unchanged shared `orbitActivity(...)` points. The web and
generated native/offline scene now include a NASA-textured Earth, atmosphere,
warm key/cool rim/hemisphere lighting, a view-dependent atmosphere, a larger
detailed probe and shared-model path/vectors. The default close camera rotates
with the current radial direction to frame the physical `0.22`-radius planet
and nearby probe without changing their scale. Overview fits bounds calculated
from the actual model points, and Follow centers the actual probe position for
escape. The central scene keeps only concise outcome copy; settings and live
measurements are below the art. Motion is opt-in with play, pause, restart,
drag, timeline and keyboard scrubbing.

Artwork parity is intentionally limited: web and the generated native offline
scene share the enhanced scene builder, while native presentation and controls
remain platform-native. The isolated rich package retains its established 3D
renderer. All use the same shared lesson inputs, outcome order and caveats.

Completed correction checks:

- Focused web/renderer/route/rich-package regressions: 7 files, 49/49.
- Full frontend Vitest: 150 files, 841/841.
- Shared Orbit model plus registry content: 2 files, 34/34.
- Native Orbit lesson UI: 10/10; generated offline scene freshness and mobile
  TypeScript passed. Generated scene builder output: 1,823,866 bytes.
- Isolated worker education/runtime regressions: 9/9.
- Frontend ESLint and production build passed. Build emitted only the existing
  Zod annotation and large-chunk warnings.
- Security backport/source verification: 4/4; touched Orbit source contains no
  `dangerouslySetInnerHTML`, dynamic evaluation or `javascript:` URL patterns.
- Strict architecture report: zero boundary violations. Existing unrelated
  hotspots remain reported; `git diff --check` is part of final handoff.
- Isolated Playwright passed 2/2 at 1440×1050 and 390×844. It exercised real
  authentication, initial close and calculated overview cameras, opt-in motion
  plus pause stability and restart, Home/End keyboard movement, both controlled
  evidence flows, escape Follow, ordinary mobile scroll, horizontal overflow
  and WebGL context-loss fallback.

Fresh full-page, component and scene captures were visually inspected for
desktop/mobile initial, overview, motion-paused, operated and escape-follow
states. The phone close view shows the textured planet at roughly 125 px while
retaining a legible probe and curved trajectory; Overview shows the whole bound
path, and Follow retains the escaping probe at the model cutoff. The clean
fallback and ordinary-scroll phone view were also inspected. Review artifacts,
including original/rejected/corrected comparisons and motion proof, are staged
under
`/root/.openclaw/workspace/media/exploration-series/orbital-mechanics-correction/`.
Orbit remains reopened and `in_progress`, not accepted or counted complete,
until parent visual review. Gravity and all later modules remain paused.
