# Fraction Feast redesign verification

Verified: 2026-11-02

## Scope

This checkpoint redesigns only `fraction-feast`. Pattern Palace remains pending.
No merge, deployment, publication, production service, or production database
test was performed.

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
  denominator. Learning controls remain nonnegative proper portions; the exact
  addition result may be improper.
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
  equal-area geometry. Package-host chrome differs from the built-in web lesson.
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

## Final checks

- shared API and contract gate: **41 files / 546 tests**;
- module manifest/integration validation: **2 files / 10 tests**;
- full frontend after final web correction: **160 files / 871 tests**;
- broad rich-package audit after the frontend, sequentially: **46/46**;
- full native non-UI: **32 files / 296 tests**;
- full native UI after extraction: **63 suites / 532 tests**;
- native typecheck, generated-scene freshness, Expo dependency alignment, and
  Discovery scene protocol typecheck: passed;
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

The first shared-gate attempt used system `python3`, which lacked Pillow; the
required gate then passed with `FAMILY_TREE_CONTRACT_PYTHON=.venv/bin/python`.
The first final frontend attempt exposed three stale Fraction expectations,
which were updated to the gated workflow. A later full run hit the known
dashboard mock-timing flake (`reject is not a function`); that unrelated suite
passed 8/8 in isolation, and the untouched full frontend passed 871/871 on the
immediate idle-machine retry before the package suite ran.

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
