# Caravan Crossroads redesign verification

Verified: 2026-11-02

Branch: `feat/discovery-learning-overhaul`

Baseline: `fb42630c4040cd9054561ffe3588d50b31d38664`

## Scope and learning contract

Caravan Crossroads now teaches two controlled investigations in a fictional,
deterministic trade model:

1. Predict how changing only the season changes one River Road journey. Route,
   6 grain units, 14 supply days, capacity, prices and loss rules stay fixed.
   Wet to dry changes 8 to 14 modeled days, 6 to 4 delivered units and margin
   -8 to -22 teaching credits while the 64 kg starting load stays fixed.
2. Predict how changing only the route changes one dry-season pottery journey.
   Season, 6 pottery units, 12 supply days, capacity, prices and loss rules stay
   fixed. Mountain Pass to Oasis Trail changes 9 to 12 modeled days, 5 to 6
   delivered units, toll 8 to 3 and margin 0 to 15 teaching credits while the
   66 kg starting load stays fixed.

Each investigation requires a prediction before evidence is revealed. Changing
a prediction clears its stale feedback and relocks free exploration until that
comparison is run again. Reset restores the wet River Road baseline, clears
both investigations and relocks the free controls.

The lesson explicitly separates history from the model. Silk Roads history is
framed as overlapping land and sea networks connecting many communities in
many directions, not one road, one direction or one merchant carrying goods
end to end. Every market, route, stop, duration, capacity, mass, price, toll,
loss rule and coefficient in the activity is labeled as a fictional teaching
assumption rather than a historical measurement, probability or forecast.
Institutional source review and claim mapping are recorded in
`docs/caravan-crossroads-copy-research.md`.

## Model and platform parity

- `packages/family-api/src/discovery-models/caravans.ts` owns the bounded shared
  route, season, cargo, capacity, delivery and margin model. It accepts only
  safe integer quantities in the documented ranges and returns `null` for
  invalid or non-finite inputs.
- The downloadable package owns the required sandbox-local copy at
  `scripts/exploration-packages/caravan-crossroads/caravans.ts`. Direct tests
  compare calculations and rejection boundaries with the shared model.
- An independent review found that the first string guards used the JavaScript
  `in` operator and therefore admitted inherited names such as `constructor`,
  `toString` and `__proto__`. Test-first regressions now cover those names in
  both models. Both guards use target-compatible own-property membership, and
  no inherited name can produce a result or `NaN`.
- Web and the generated native offline atlas share the detailed caravan relief
  scene. Native platform controls intentionally use a simpler accessible
  diagram. The package has its own sandbox-safe scene copy and is checked for
  model and scene-signature parity.
- Web, native and package share the two prediction gates, exact evidence,
  changed and held variables, feedback invalidation, reset contract, history
  correction and visible model boundary. The compositions are not claimed to
  be pixel-identical.

## Visual and interaction review

True-before evidence was captured before editing from baseline
`fb42630c4040cd9054561ffe3588d50b31d38664` in
`/tmp/caravan-before-fb42630`. The final built-in and actual package-host
scripts are `/tmp/caravan-final-capture.mjs` and
`/tmp/caravan-package-capture.mjs`. They capture desktop `1440x1050` and mobile
`390x844` initial, operated and motion-paused states, each as full-page,
component, central-scene and ordinary-viewport images.

The capture processes use explicit `/usr/bin/google-chrome` as unprivileged
user `nobody`, with the Chromium sandbox enabled, isolated writable `HOME` and
XDG directories, reduced motion and intercepted local fixtures. Both final
matrices assert exact viewport width, no document or component overflow,
keyboard range operation from 6 to 7 units, two feedback blocks, five unlocked
controls, both evidence comparisons, changed/held-variable copy, the model
boundary, zero running animations, zero browser errors, zero failed requests
and zero external requests.

The true-before, final built-in, final package and native-offline images were
personally inspected at original resolution. The final scene preserves and
enhances the dimensional relief map, layered terrain, mountain and river
routes, oasis, caravan animals, cargo, market structures, fabric awnings,
materials, lighting, cast depth and route markers. Two intermediate exchange
stops and multiple route branches reinforce the historical network correction.
Mobile label anchors were moved inward and rechecked after inspection found
edge clipping and collisions; the final mobile built-in, package and native
images have no observed label overlap or clipping. An independent reviewer
also inspected the actual before and final desktop/mobile scenes and agreed
that the rich central art was retained.

Final evidence is staged under
`/root/.openclaw/workspace/media/exploration-series/caravan-crossroads/` with a
verified `SHA256SUMS.txt` after the review commit.

## Verification results

| Area                                     |                      Final result | Log                                                                    |
| ---------------------------------------- | --------------------------------: | ---------------------------------------------------------------------- |
| Shared Caravan model                     |                               4/4 | `/tmp/caravan-verification/shared-model-final-compatible.log`          |
| Focused web interactions                 |                             18/18 | `/tmp/caravan-verification/web-focused-final-after-review.log`         |
| Focused native interactions              |                             21/21 | `/tmp/caravan-verification/native-workflow-focused.log`                |
| Focused rich package                     |         1/1, 47 skipped by filter | `/tmp/caravan-verification/package-focused-final-compatible.log`       |
| Shared API                               |               561/561 in 43 files | `/tmp/caravan-verification/shared-api-gate-final.log`                  |
| Module contracts                         |                             10/10 | `/tmp/caravan-verification/modules-validate.log`                       |
| Full frontend                            |              872/872 in 161 files | `/tmp/caravan-verification/frontend-full-definitive.log`               |
| Broad rich-package suite                 |                             48/48 | `/tmp/caravan-verification/package-broad-definitive.log`               |
| Native unit                              |               296/296 in 32 files | `/tmp/caravan-verification/native-unit-after-review.log`               |
| Native UI                                |              532/532 in 63 suites | `/tmp/caravan-verification/native-ui.log`                              |
| Native typecheck and generated freshness | pass; offline SVG 1,068,075 bytes | `/tmp/caravan-verification/native-typecheck-after-review.log`          |
| Native dependency check                  |                              pass | `/tmp/caravan-verification/native-dependencies.log`                    |
| Sandboxed native offline browser         |          26/26; all 74 SVG states | `/tmp/caravan-verification/native-browser-final-after-corrections.log` |
| Isolated discovery backend               |                             61/61 | `/tmp/caravan-verification/backend-isolated.log`                       |
| Strict architecture                      |             0 boundary violations | `/tmp/caravan-verification/architecture-strict-after-review.log`       |
| Security backports                       |                             51/51 | `/tmp/caravan-verification/security-backports-after-review.log`        |
| Frontend lint                            |               pass, zero warnings | `/tmp/caravan-verification/frontend-lint-after-review.log`             |
| Frontend production build                |                              pass | `/tmp/caravan-verification/frontend-build-final-compatible.log`        |
| Package build/validation                 | two valid byte-identical archives | `/tmp/caravan-verification/package-determinism-definitive.log`         |

The final full frontend and broad package gates ran sequentially after every
model, copy, interaction, art and generated-artifact correction. The first
full frontend attempt exposed an obsolete `LandscapeLearning` assumption and
then remained alive after reporting it; only that Vitest process was stopped.
The obsolete assertion was replaced with separate generic and gated-Caravan
coverage before the definitive 872/872 frontend run and subsequent 48/48
package run.

The two final validated package archives are byte-identical with SHA-256
`6386b176947f3e70a2eccba09e24a3276ee6e9f3065c0217122960cd124d13e6`.
The generated worker SHA-256 is
`c2e814cfae9b972afef928f4edd358c6f253b0185dcee0a1675aa5319f74c6e5`,
and the generated manifest SHA-256 is
`2427ea8287d85c84df74ef8239c24a16a0cbe05f4bb92cf1c2c0823039002848`.

Initial test-first failure logs are retained for the shared, web, native and
package workflows. Independent-review boundary failures are retained at
`/tmp/caravan-verification/shared-prototype-membership-red.log` and
`/tmp/caravan-verification/package-prototype-membership-red.log`.

## Security and accessibility review

- No production service, production database, deployment, new network
  permission, dynamic code execution or raw HTML injection was introduced.
- Package execution stays inside the existing CSP-constrained worker/vector
  protocol. All model quantities are bounded, and route/cargo strings require
  own-property membership before evaluation.
- Prediction buttons expose pressed state on web, comparison controls are
  disabled until a prediction exists, native controls have platform-accessible
  labels, and reset plus free exploration controls are keyboard-operable.
- Exact text reports route, season, days, starting load, delivered units, cost,
  revenue, toll and margin, so the evidence never relies on color alone.
  Feedback uses status regions and describes evidence rather than praise.
- Responsive browser checks cover the component and ordinary viewport, not
  only full-page screenshots. Reduced motion produces zero running animations;
  the dimensional camera remains optional and user-controlled.
- The isolated backend gate used temporary test storage only. No production
  database command was run.

## Known evidence gaps

- No physical-device session was performed.
- No real screen-reader session was performed; automated semantic, keyboard
  and accessible-label checks cover the implemented controls and evidence.
- Native controls and package-host chrome differ graphically from the built-in
  lesson while the learning workflow and bounded calculations remain aligned.
- Historical sources support only the networks-and-communities framing. They
  do not validate any fictional model number.
- This checkpoint does not authorize merge, deployment, publication,
  production services or production database access.
