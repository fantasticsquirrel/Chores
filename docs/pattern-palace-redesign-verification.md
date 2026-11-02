# Pattern Palace redesign verification

Verified: 2026-11-02

Branch: `feat/discovery-learning-overhaul`

Baseline: `0d81b902d5614be42f7818ce893c117e0d30dc92`

## Scope and learning contract

Pattern Palace now teaches two separate, controlled geometry investigations:

1. Predict whether a 90° clockwise rotation or a reflection across a vertical
   line moves the same marked point M farther right. The motif, center, size,
   and point are held fixed. Evidence reports the exact image coordinates and
   the rigid-transformation invariant.
2. Predict what changes when a fourth regular-pentagon corner is added at the
   same point. Regular shape, side length, 108° corner, and meeting point are
   held fixed. Evidence compares `3 × 108° = 324°` with
   `4 × 108° = 432°` and identifies the resulting 72° overlap.

Both investigations require a prediction before comparison. Changing a
prediction clears that investigation's evidence and relocks exploration until
the comparison is run again. Reset restores the two original predictions,
three-pentagon state, original motif, and locked exploration controls.

The visible model boundary says that a 360° fit at one observed point is local
evidence, not proof that a rule extends over the plane, and that regular and
irregular polygons are not interchangeable. Source review and editorial
decisions are recorded in `docs/pattern-palace-copy-research.md`.

## Model and platform parity

- `packages/family-api/src/discovery-models/patterns.ts` is the bounded shared
  model for regular-polygon corner totals, polygon vertices, and rigid point
  transformations. Invalid, fractional, non-finite, and out-of-range inputs
  return `null`.
- Point M is `(-30, -18)` in screen coordinates. The shared model produces
  `(18, -30)` after a clockwise quarter-turn and `(30, -18)` after a vertical
  reflection. Tests also verify distance preservation and orientation reversal
  only under reflection.
- Web and the native offline atlas share the palace workbench SVG. Native
  platform controls are intentionally simpler. The downloadable package owns a
  sandbox-safe bounded model copy, with direct parity tests against the shared
  model.
- Web, native, and package lessons share the same prediction gates, exact
  evidence, changed/held variables, stale-feedback clearing, reset behavior,
  model limit, and exploration controls. Visual compositions are not claimed
  to be pixel-identical.

## Visual and interaction review

True before evidence was captured before frontend edits from the baseline in
`/tmp/pattern-before-0d81b90`. The final built-in and actual package-host
scripts use `/tmp/pattern-final-capture.mjs` and
`/tmp/pattern-package-capture.mjs`. Each script captures desktop `1440×1050`
and mobile `390×844`, initial and operated states, with full-page, component,
scene, and ordinary-viewport images. This repository has no
`scripts/capture-ui` entry, so these review-specific scripts are the documented
fallback.

All browser runs use `/usr/bin/google-chrome` as unprivileged user `nobody`,
with the Chromium sandbox enabled, isolated writable `HOME`/XDG directories,
reduced motion, isolated API fixtures, and no remote requests. The scripts
assert exact viewport width, no component or document overflow, keyboard range
operation, both evidence blocks, unlocked controls, the finite-example limit,
zero browser errors, zero failed requests, zero external requests, and zero
running animations.

Rendered images were inspected independently of metrics. The final workbench
preserves and improves the dimensional ceramic tile board, grout, glaze,
inlaid palace arch, brass rosettes, cast shadows, marked asymmetric motif, and
repeated mosaic strip. It does not collapse into a flat chart. Point M remains
upright and named after transformations. Mobile wraps the current image label
without horizontal clipping. A clipped native motif caption found during
review was shortened to an accurate state-specific label; the offline browser
test now checks every motif label's bounding box against the SVG viewport.

Final evidence is staged under
`/root/.openclaw/workspace/media/exploration-series/pattern-palace/` with a
verified `SHA256SUMS.txt` after the review commit.

## Verification results

| Area                                     |                      Final result | Log                                                       |
| ---------------------------------------- | --------------------------------: | --------------------------------------------------------- |
| Shared Pattern model                     |                               5/5 | `/tmp/pattern-verification/shared-model-focused.log`      |
| Focused web interactions                 |                             19/19 | `/tmp/pattern-verification/web-focused-corrected.log`     |
| Focused native interactions              |                             21/21 | `/tmp/pattern-verification/native-workflow-focused.log`   |
| Focused rich package                     |         1/1, 46 skipped by filter | `/tmp/pattern-verification/package-workflow-focused.log`  |
| Shared API                               |               557/557 in 42 files | `/tmp/pattern-verification/shared-api-gate.log`           |
| Module contracts                         |                             10/10 | `/tmp/pattern-verification/modules-validate-final.log`    |
| Full frontend                            |              872/872 in 161 files | `/tmp/pattern-verification/frontend-full-final-2.log`     |
| Broad rich-package suite                 |                             47/47 | `/tmp/pattern-verification/package-broad-final-2.log`     |
| Native unit                              |               296/296 in 32 files | `/tmp/pattern-verification/native-unit-full-final-2.log`  |
| Native UI                                |              532/532 in 63 suites | `/tmp/pattern-verification/native-ui-full-final-2.log`    |
| Native typecheck and generated freshness | pass; offline SVG 1,070,099 bytes | `/tmp/pattern-verification/native-typecheck-final-2.log`  |
| Native dependency check                  |                              pass | `/tmp/pattern-verification/native-dependencies-final.log` |
| Sandboxed native offline browser         |          26/26; all 74 SVG states | `/tmp/pattern-verification/native-browser-final-2.log`    |
| Isolated discovery backend               |                             61/61 | `/tmp/pattern-verification/backend-isolated.log`          |
| Strict architecture                      |             0 boundary violations | `/tmp/pattern-verification/architecture-strict-final.log` |
| Security backports                       |                             51/51 | `/tmp/pattern-verification/security-backports-final.log`  |
| Frontend lint                            |               pass, zero warnings | `/tmp/pattern-verification/frontend-lint-final.log`       |
| Frontend production build                |                              pass | `/tmp/pattern-verification/frontend-build.log`            |
| Package build/validation                 | two valid byte-identical archives | `/tmp/pattern-verification/package-determinism.log`       |

The deterministic package archives both have SHA-256
`723cee3069888aef0d57a70dcfe71fec4b5d65e467d9a3ef673e5371dee5b5f5`.
The generated worker has SHA-256
`554a83fdee870790938209eda50334fc97de57e737bac793c5f4a5a9fc235c29`.

Test-first failure logs are retained as
`shared-model-red.log`, `web-workflow-red.log`, `native-workflow-red.log`, and
`package-workflow-red.log`. Two later corrective failures are also retained:
the first full frontend run found an obsolete pre-redesign interaction test
(`frontend-full.log`), and the first final lint run found a Fast Refresh export
warning (`frontend-lint.log`). Both causes were corrected before the final full
runs above. Preview and native image inspection additionally found and fixed
the clipped offline motif caption before the final 26-case browser run.

## Security and accessibility review

- No new network permission, production service, production database, dynamic
  code execution, raw HTML injection, or unbounded model input was introduced.
- The package remains inside the existing CSP-constrained worker/vector
  protocol. Package input values are bounded before model evaluation.
- Prediction buttons expose pressed state on web. Comparison buttons are
  disabled until a prediction exists. Native controls use platform-accessible
  labels. Reset and all free controls are keyboard-operable.
- Point M, coordinates, angle totals, gap/overlap text, and shape names make
  the evidence independent of color alone. Feedback uses live/status regions
  without reducing the result to praise.
- Reduced motion is the default. This lesson uses static, purposeful comparison
  states, so an animation control would add no instructional value.

## Known evidence gaps

- No physical-device session was performed.
- No real screen-reader session was performed; automated semantic and keyboard
  checks cover the implemented labels and control states.
- Native platform controls and package-host chrome differ visually from the
  built-in lesson, while the instructional model and workflow remain aligned.
- This checkpoint does not authorize merge, deploy, publication, production
  services, or production database access.
