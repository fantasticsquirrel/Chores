# Heat House redesign verification

Completed 2026-11-03 on `feat/discovery-learning-overhaul`. Final commit and
remote/clean-tree proof are recorded in
`/tmp/exploration-series-heat-house-report.md`. This checkpoint authorizes no
merge, deployment, publication, production service or production database
change. Overall series: **19 complete / 7 pending**; **Pressure Tank** is next
and was not started.

## Learning and model

One bounded pure model now supplies web and native; the standalone package
mirrors it with exhaustive parity checks. It separates signed heat-transfer
power from energy accumulated over time:

- `power = U × area × temperature difference`, reported in W (J/s);
- `energy = power × elapsed seconds`, reported in J, MJ and kWh;
- positive values mean outward transfer, negative values inward transfer, and
  equal temperatures give zero net modeled transfer;
- a fixed 60 m² wall-and-window envelope means additional window area replaces
  opaque wall rather than silently increasing total area.

Two prediction-first one-variable comparisons share exact before/after states,
evidence, correct/incorrect feedback, changed/held summaries and reset:

- Added wall insulation 0→10 cm with brick, 8 m² windows, 20°C inside, 0°C
  outside and 6 h fixed: wall power 2066→346 W, window power remains 448 W,
  combined energy 15.09→4.77 kWh.
- Window area 2→18 m² with brick, 10 cm insulation, 20°C inside, 0°C outside,
  6 h and 60 m² envelope fixed: opaque wall 58→42 m², combined power 498→1288 W,
  combined energy 2.99→7.73 kWh.

The lesson distinguishes conduction, convection and radiation while disclosing
that fixed U-factors lump assembly effects rather than solving the mechanisms.
Insulation raises resistance and does not generate thermal energy. Inputs are
explicit teaching values, not measurements, product ratings, weather forecasts,
load calculations or bill estimates. Authoritative claim mapping is in
[heat-house-copy-research.md](heat-house-copy-research.md).

## Dimensional scene and interaction

The original cutaway house was preserved and enriched with wall layers, brick
courses, glazing/frame depth, rafters, workshop backdrop, fasteners/tools,
temperature instruments, elapsed-energy rail, layered materials, lighting and
shadows. Window width, insulation sample, signed flow arrows, thermometer level,
energy marker and exact callouts respond to state. Authored label slots and
leaders keep the teaching object visible at desktop 1440×1050 and mobile 390×844.

Web replay is opt-in and shows energy accumulating from 0 to the selected time
while power remains fixed. Reduced-motion users receive the final state and an
explicit status without animation. Sliders, scene orbit/Home, prediction flow
and reset are keyboard operable. Exact values and patterned wall/window bars
avoid color-only meaning. Package controls update the same deterministic time
relationship directly and intentionally omit replay animation.

True before images use the separately frozen untouched `1708539` build. Final
web evidence contains 52 captures and actual package evidence 46 captures across
both viewports: full/component/scene/ordinary viewport, both controlled trials,
correct/incorrect feedback, zero difference, inward transfer, maximum outward
difference, zero time, matched rotated/Home states, genuine held mid-replay and
reduced motion. Reports assert no horizontal overflow, out-of-bounds or
overlapping callouts, browser errors, failed requests or external requests.

The independent read-only review is retained at
`/tmp/heat-house-independent-review.md`. Its two moderate findings—duplicated
native fallback language and unmatched later web/package capture states—were
corrected, recaptured, reinspected and accepted with no remaining meaningful
science, visual or accessibility defect.

## Final verification

| Gate                                                         |                              Result |
| ------------------------------------------------------------ | ----------------------------------: |
| Full frontend after final correction                         |                  877/877, 161 files |
| Broad package, sequentially after frontend                   |                               48/48 |
| Shared API/model                                             |                   579/579, 46 files |
| Module contracts                                             |                               10/10 |
| Physical package workers and Heat parity cross-product       |                               16/16 |
| Native unit                                                  |                   296/296, 32 files |
| Native UI                                                    |                  532/532, 63 suites |
| Native offline browser                                       |    27/27; all 74 bounded SVG states |
| Isolated backend/package/security                            |                               61/61 |
| Security backports                                           |                               51/51 |
| Scene freshness, native/scene typecheck, frontend lint/build |                                pass |
| Offline Expo dependency map                                  |             dependencies up to date |
| Strict architecture                                          |         pass; 0 boundary violations |
| Deterministic package                                        | two identical server-validated ZIPs |
| Web desktop/mobile proof                                     |             52 state captures, pass |
| Actual package desktop/mobile proof                          |             46 state captures, pass |

Package 1.0.1 ZIP SHA-256:
`42aced9a50be3e5bfa1a3d8bcc6b620169579cdc59e1d5e5e2c22fac4ec26f69`.
The package browser executes the exact checked-in manifest/worker/assets; its
asset-list identity is recorded separately from the ZIP hash.

## Failure accounting and limits

Failed logs are retained rather than hidden:

- intentional test-first runs failed before the shared model and new behavior
  existed;
- two focused frontend invocations used the wrong root environment/path before
  the workspace-configured jsdom run passed;
- the first visual scripts exposed raw replay floating-point digits and a mobile
  capture scroll overlap, both corrected before the passing 52-capture run;
- one unrelated Caravan broad-package test exceeded its existing 5 s limit by
  0.307 s; the identical unchanged rerun passed 48/48, and no timeout or Caravan
  source was changed;
- system Python lacked project-only Pillow/email-validator dependencies for the
  shared contract and ZIP tools; preserved failures were rerun successfully with
  the repository `.venv/bin/python` per local guidance;
- full native UI exposed a stale generic `Reset experiment` expectation after
  Heat adopted the intentional `Reset lesson` label; the assertion was corrected
  and both focused 30/30 and full 532/532 reruns passed.

`SECURITY_OWASP_TOP10.md` was requested but is absent from the repository and
the referenced local workspaces. The applicable
`docs/security/discovery-package-threat-model.md`, strict architecture report,
package adversarial/backend tests, no-network browser assertions and security
backport suite were used instead. No auth, tenant, CSRF, dependency, transport,
deployment, service or database behavior changed. Backend tests used only
`/tmp/heat-verification/backend-isolated.sqlite`.

No physical-device, touch-hardware or real screen-reader session was performed.
Native controls and package chrome differ graphically from web; native offline
and package/web preserve the rich house, while the native React fallback is a
simpler accessible diagram. Offline Expo validation is a dependency-map check,
not a fresh online advisory scan. The frontend build retains its existing
chunk-size advisory. These limitations do not change the shared model or the
completed learning flow.
