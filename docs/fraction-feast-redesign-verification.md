# Fraction Feast redesign verification

Verified: 2026-11-02

## Scope

This checkpoint redesigns only `fraction-feast`. Pattern Palace remains pending.
No merge, deployment, publication, production service, or production database
test was performed.

An independent review after the original checkpoint identified three exactness
issues. This correction pass preserves the lesson and visual composition while
fixing signed mixed-number decomposition, reducing safe intermediate sums beyond
the public input bound, and making every rendered pizza layer cover its full
wedge angle. No other Exploration was changed.

## Learning and model boundary

- Investigation 1 fixes the whole area and selected area, asks for a prediction,
  then compares `1/2` with `2/4`. Feedback distinguishes the increased piece
  count from the decreased piece size and names both held variables.
- Investigation 2 fixes equal-area wholes, asks whether `2/3 + 3/4` exceeds one
  whole, then exposes the exact conversion `8/12 + 9/12 = 17/12 = 1 whole and
5/12` in copy and a two-whole partition model.
- Free exploration remains locked until both comparisons are complete. Changing
  a guided prediction clears its stale evidence and relocks exploration; reset
  clears both predictions, evidence, controls, and the operated scene.
- `packages/family-api/src/discovery-models/fractions.ts` is the shared exact
  rational boundary. It accepts bounded safe integers only, normalizes signs and
  zero, rejects zero denominators/non-finite/decimal/out-of-range input, checks
  equivalence by exact cross-products, and adds with the least common
  denominator. Inputs are validated against the `96` component bound once;
  private safe-integer reduction then permits exact valid results such as
  `96/96 + 48/96 = 3/2` and `1/95 + 1/96 = 191/9120`. Truncation-based mixed
  decomposition retains a signed remainder, preserves
  `wholeCount + remainder = sum`, and canonicalizes negative zero. Learning
  controls remain nonnegative proper portions; the exact addition result may be
  improper.
- Both pizzas stand for the same whole area and each denominator means equal-area
  parts within one whole. Toppings, textures, lighting, plate depth, and
  perspective do not participate in the arithmetic.

The reviewed source claims and exact URLs are recorded in
`docs/fraction-feast-copy-research.md`.

## Architecture and parity

- Web lesson state is isolated in `fraction/useFractionLesson.ts`; prediction
  cards, exact amount diagram, and keyboard piece toggles are cohesive extracted
  compositions rather than additions to the shared simulation monolith.
- Native imports the same shared fraction model. Its fallback pizza and exact
  twelfths strip live in a separate `fraction/FractionVisuals.tsx`, keeping the
  main lesson below the architecture hotspot threshold.
- The generated native offline scene uses the rich Three.js pizza geometry.
  Native platform controls and fallback composition are simpler and are not
  claimed pixel-identical to web.
- The sandboxed package owns its required model copy. Repository tests compare
  all boundary results with the shared model and compare package/web scene graph
  geometry, transforms, material values, and labels at matched states.
- Web and package retain the dimensional tabletop, food materials, crust/sauce/
  cheese/topping depth, shadowed ceramic plates, glaze highlights, lighting, and
  equal-area geometry. Dough, sauce, cheese, and crust now use each exact full
  wedge angle at the shared plate center. Thin radial line overlays preserve
  visible cut boundaries without removing denominator-dependent area. Package-
  host chrome differs from the built-in web lesson.
- Fraction evidence is static by design. There is no invented motion or motion
  control; reduced-motion audits report zero running animations.

## Test-first evidence

The required failing-first records are retained under
`/tmp/fraction-verification/`:

- `shared-model-red.log`;
- `web-workflow-red.log`;
- `native-workflow-red.log`;
- `package-workflow-red.log`.

Focused green records include `shared-model-green-initial.log`,
`web-focused-green.log`, `native-focused-green-2.log`,
`native-extraction-focused.log`, `package-fraction-green-2.log`, and
`web-fraction-focused-final.log`.

The review correction retains new failing-first evidence in
`review-model-scene-red.log` and `review-package-model-red.log`. Corrected
model, geometry, UI, and package-parity runs are in
`review-focused-model-scene-parity-corrected.log` and
`review-scene-node-environment-correction.log`. Signed algebra cases include a
negative proper result and negative improper results; boundary cases include a
reduced numerator above `96` and a result denominator of `9120`. Geometry
coverage compares the actual triangulated top area of every complete dough,
sauce, and cheese layer as equal-part counts double through 24, and asserts that
every wedge remains centered.

## Final checks

- shared API and contract gate: **41 files / 552 tests**;
- module manifest/integration validation: **2 files / 10 tests**;
- full frontend after final review correction: **161 files / 872 tests**;
- broad rich-package audit after the frontend, sequentially: **46/46**;
- full native non-UI: **32 files / 296 tests**;
- full native UI after extraction: **63 suites / 532 tests**;
- native typecheck, regenerated offline-scene freshness (**1,850,186 bytes**),
  unchanged Expo dependency alignment, and Discovery scene protocol typecheck:
  passed;
- native offline browser: **26/26** under unprivileged sandboxed Chrome, with no
  remote scene requests; the pizza screenshot was personally inspected;
- isolated backend Discovery/architecture suite: **61/61**, using test fixtures
  only and no production database;
- strict architecture report: zero boundary violations and no new Fraction
  hotspot after extracting the native visual composition;
- security backport/upstream verification: **51/51**;
- frontend ESLint and production Vite build: passed; the build transformed 579
  modules and retained existing third-party annotation/large-chunk warnings;
- deterministic package build/validate: the server-exact builder and validator
  passed twice with byte-identical archives;
- changed-file Prettier check, JSON parsing, `git diff --check`, generated-scene
  freshness, and unsafe-sink scan: passed.

For the review correction, the shared gate passed with
`FAMILY_TREE_CONTRACT_PYTHON=.venv/bin/python`. One combined focused command
incorrectly placed a node-only geometry check in jsdom; the retained log shows
that invocation, and the test now declares its intended node environment. The
first restarted full frontend run then hit the same known dashboard mock-timing
flake (`reject is not a function`) described by the original checkpoint. That
unrelated suite passed 8/8 in isolation without a source change. The immediate
idle-machine full retry passed 872/872, and only then did the broad package suite
run and pass 46/46.

Primary logs are under `/tmp/fraction-verification/`, including:

- `shared-api-final-venv.log`, `modules-validate.log`;
- `frontend-full-exact-final.log`, `frontend-dashboard-isolated.log`,
  `frontend-lint-final.log`, `frontend-build-final.log`;
- `package-broad-final.log`, `package-build-validate.log`,
  `package-assets.sha256`;
- `mobile-unit-final.log`, `mobile-ui-final.log`,
  `native-typecheck-final.log`, `native-dependencies.log`,
  `mobile-scenes-browser-final.log`, `scene-protocol-typecheck.log`;
- `backend-isolated-final.log`, `architecture-report-final.log`,
  `security-backports-final.log`;
- `prettier-check-final.log`, `json-parse-final.log`,
  `git-diff-check-final.log`, `unsafe-sink-scan-final.log`.

Review-correction logs use the `review-*.log` prefix, including
`review-shared-api-full.log`, `review-native-typecheck.log`,
`review-mobile-unit-full.log`, `review-mobile-ui-full.log`,
`review-mobile-scenes-browser.log`, `review-frontend-lint.log`,
`review-architecture-strict.log`, `review-security-backports.log`,
`review-frontend-full-final-retry.log`, and
`review-package-broad-final-after-frontend.log`.

## Corrected deterministic package

The corrected immutable package is `fraction-feast-package` version `1.0.2`
with runtime `worker-rich-v1`. Two independent server-exact builds and validates
produced byte-identical 590,614-byte archives:

- `worker.js`: 385,413 bytes, SHA-256
  `6194fdd7025cc928cb302f728786cbdd4df9664c06df1a6f27a39d63f94dcab8`;
- `manifest.json`: 7,799 bytes, SHA-256
  `f3c169f4b7a85298cc47088d2007d7c58cf73f159f77dab445f6ecd50fb03f55`;
- archive: SHA-256
  `ee17dc5cbd80d8968e45a42f90433637103b405dfd62adf63aa2ed568f296d96`;
- actual package-host declared-asset checksum:
  `62453bea5c2e5ebc3d52e3e2757139f97f857ec4a4dbaa30ab88ae0a55e995f5`.

## Visual review

Before any frontend source edit, the unchanged baseline at
`e6040f4554b8d2c5ac30a15ad73225f76f16272e` was captured at desktop
1440 × 1050 and mobile 390 × 844 in initial and operated states. Each state has
full-page, component, scene, and ordinary-viewport proof (16 PNGs total), plus a
machine-readable report with keyboard, overflow, reduced-motion, renderer, and
browser-error checks.

The final built-in web matrix repeats those 16 views. The actual package host
adds another 16-view matrix. Accepted captures show no horizontal overflow,
browser errors, failed/external requests, or running animations; keyboard input
advances one selected piece. Rendered review corrected the original mobile
caption overlap by moving the fraction readouts into high-contrast tabletop
badges and restored keyboard-operable numbered piece toggles after the full
regression suite identified their absence.

The review-correction matrix was recaptured from the rebuilt app and corrected
package under unprivileged `nobody`, explicit `/usr/bin/google-chrome`, enabled
Chromium sandboxing, and isolated writable HOME/XDG directories. Personal
inspection confirmed that radial seams remain clear without removing selected
area, pizza layers meet at the common center, materials/toppings/lighting remain
rich, and the mobile Plate B badge now sits fully in the inter-plate band rather
than covering a rim. The fresh 26-case native offline audit passed and its 390px
pizza image was inspected with the same findings.

The generated native offline pizza was captured independently at 390 px under
the same explicit `/usr/bin/google-chrome`, `chromiumSandbox: true`, unprivileged
`nobody` setup. This is browser proof of the offline native asset, not a claim of
physical Android/iOS device verification.

Immutable evidence and `SHA256SUMS.txt` are staged under
`/root/.openclaw/workspace/media/exploration-series/fraction-feast/`.

## Honest gaps

- No physical mobile-device or real screen-reader session was available.
- Web, native platform controls, and package-host chrome are functionally and
  mathematically aligned but not pixel-identical.
- The model teaches exact area fractions for consistent equal-area wholes. It
  does not claim that real pizzas are perfectly circular, identically sized, or
  cut into physically exact equal areas.
- Review readiness does not grant merge, deployment, publication, or production
  authority.
