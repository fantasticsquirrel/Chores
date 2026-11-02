# Pollinator Express redesign verification

Verified: 2026-11-03

Branch: `feat/discovery-learning-overhaul`

Baseline: `b96ef57a4422f4d5a50c875ba8c76814c72f079d`

Status: complete for the parent review checkpoint. Final commit and remote proof
are recorded in `/tmp/exploration-series-pollinator-express-report.md`.
No merge, deployment or production-database operation was performed.

## Learning and model contract

The lesson now requires a prediction before each controlled comparison and
unlocks free exploration only after both comparisons are run. Changing a
prediction invalidates its evidence; reset clears both predictions, both
results and the route.

- Species trial: both conditions use `Gold 1 → trial`, the trial target stays
  at `(230, 195)`, and only its displayed Gold/Violet species changes.
- Habitat trial: both conditions attempt
  `Gold 1 → Gold 2 → Gold bridge → Gold 3`; only habitat presence changes. The
  habitat manipulation is accurately described as one bridge patch containing
  Gold and Violet flowers. The fixed planned route uses the Gold stop; it does
  not visit the Violet flower.
- Every coordinate, reach value, stop, route and count is an invented
  deterministic teaching assumption, not an ecological measurement,
  probability, conservation result or forecast.
- Pollination, later fertilization, seed formation and later seed dispersal
  are explicitly separated. A visit and a received-pollen mark do not claim
  fertilization, fruit or seeds.

Malformed pollen, source/species contradictions, inherited property names,
unknown or unbounded coordinates, path/current-position mismatch, unsafe
counters, and 23/24/25-stop boundaries are covered in the shared and package
models. The exact 24-stop maximum is accepted and 25 is rejected.

## Visual and interaction contract

The existing raised garden, layered soil, plant materials, flowers, bee, nest,
lighting, shadows and depth are retained. Enlarged anthers/stigma, compatible
pollen receipt, route beads, patch flowers and fixed-position trial-flower
state add observable evidence. Reach and route traces now use paired dark and
light strokes over every terrain. Narrow web/package layouts use a shorter
canvas and closer garden framing. Text/check labels ensure that color is not
the only state cue; keyboard controls and reduced-motion behavior remain
supported.

Native uses a deliberately simpler platform diagram while carrying the same
predictions, controlled inputs, exact evidence, reset rules and scene state.
The downloadable package keeps the rich authored geometry and the same
learning contract.

## Source verification

Claim-to-source mapping and the complete invented-assumption boundary are in
`docs/pollinator-express-copy-research.md`. Sources are institutional USDA
NRCS, USDA-hosted SARE/Xerces, NPS and OpenStax materials. The supervisor
independently fetched and read the cited material recorded in
`/tmp/pollinator-source-supervisor.txt`; OpenStax is used for the precise
pollination/fertilization distinction. Source pages support lesson copy only,
not package art or model numbers. The package has no downloaded visual/audio
assets; attribution is recorded in
`scripts/exploration-packages/pollinator-express/ASSETS.md`.

## Definitive verification

| Gate                                    |                       Result | Log under `/tmp/pollinator-verification/` |
| --------------------------------------- | ---------------------------: | ----------------------------------------- |
| Shared model                            |                          7/7 | `shared-model-final.log`                  |
| Shared API                              |            568/568, 44 files | `shared-api-host-final.log`               |
| Module contracts                        |                        10/10 | `modules-validate.log`                    |
| Focused web                             |                        18/18 | `web-focused-final-review.log`            |
| Focused native                          |                        10/10 | `native-focused-final-review.log`         |
| Full frontend after all corrections     |           872/872, 161 files | `frontend-full-serial-final.log`          |
| Broad package, after frontend           |                        48/48 | `package-broad-serial-final.log`          |
| Native unit                             |            296/296, 32 files | `native-unit.log`                         |
| Native UI                               |           532/532, 63 suites | `native-ui.log`                           |
| Native typecheck/freshness/dependencies |                         pass | `native-quality-final.log`                |
| Native offline browser                  |     26/26; all 74 SVG states | `native-browser-serial-final.log`         |
| Isolated discovery backend              |                        61/61 | `backend-isolated-host-final.log`         |
| Frontend lint                           |          pass, zero warnings | `frontend-lint-final.log`                 |
| Frontend production build               |                         pass | `frontend-build-definitive.log`           |
| Security backports                      |                        51/51 | `security-backports-final.log`            |
| Strict architecture                     |        0 boundary violations | `architecture-strict-final.log`           |
| Deterministic package                   | two valid identical archives | `package-determinism-final.log`           |
| Built-in desktop/mobile browser         |                         pass | `web-host-capture-final.log`              |
| Actual package desktop/mobile browser   |                         pass | `package-host-capture-definitive.log`     |

The generated scene document is 1,852,559 bytes; the SVG atlas is 1,068,141
bytes. Dependency validation used Expo's local dependency map while offline;
it is not a fresh online advisory scan. The production build retains its
existing chunk-size advisory.

Both final package archives have SHA-256
`f266d1a27a8a3ff632f4da2056cfb5922227de13e10fc23834d9e17f2e3d85c7`.
Worker SHA-256:
`76ef4514bae5501e8c8d571d65ce4b5f8bce567e2b158656b8a4e0c44fa3cf77`.
Manifest SHA-256:
`d02475f7fa79f5c136426c8bc38f46be363cbab7a7bd76eeccda6aacaf83ca54`.

## Independent review and corrections

Independent review found and drove fixes for malformed state, source/species
consistency, finite/safe bounds, route-size boundaries, and both experiments'
controlled inputs. A second actual-image critique found that the habitat copy
omitted the visible Violet bridge flower and mobile route/reach traces were
too faint. Copy now names the two-flower patch and fixed Gold stop; the larger,
shorter mobile scene has dark/light outlined traces. The reviewer inspected
fresh actual images and gave a final pass with no remaining material issues.
Reports: `/tmp/pollinator-independent-model-review.md` and
`/tmp/pollinator-independent-final-review.md`.

The first broad package run exposed a real Pollinator render-time regression:
the generic every-action/reset test exceeded its unchanged 30-second limit,
including on an isolated retry. A six-entry worker-local LRU cache now reuses
identical serialized gardens, keyed by every render-relevant field and viewport
mode. No artwork, validation or timeout was weakened. Its focused runtime fell
to 12.28 seconds; final broad regression passes. Details:
`/tmp/pollinator-performance-fix.md`.

Nested-runner Python gates could not complete under that runner's restrictions;
they passed on the authorized host with temporary test storage. Concurrent
host attempts also produced unrelated frontend timing/readback failures and
an unchanged pond browser readback failure. No unrelated product code or test
timeout was changed. Definitive unchanged-source serial runs passed. Final
frontend and broad package gates ran sequentially after the cache correction.
Failed and red-stage logs are retained rather than presented as passing proof.

## Visual evidence and provenance

True-before: `/tmp/pollinator-before-b96ef57` (captured before source edits).
Final built-in: `/tmp/pollinator-final-evidence`.
Final actual package: `/tmp/pollinator-package-final`.
Final native offline: `/tmp/pollinator-native-browser-final`.

Desktop 1440×1050 and mobile 390×844 evidence includes matched full-page,
component, scene and ordinary viewport images, plus operated and reduced-motion
states. The supervisor personally inspected actual before/final desktop and
mobile art, corrected mobile route/contrast views, actual-package views and
native offline scene. The rich garden remains intact; no material clipping or
label overlap was observed. Package chrome and native platform controls differ
from web; they are not claimed pixel-identical.

Both web/package matrices assert exact viewport widths, no horizontal overflow,
two evidence comparisons, keyboard reach 170→180, scientific/model boundaries,
zero running animations under reduced motion, zero browser errors, failed
requests or external requests. Browser proof uses explicit
`/usr/bin/google-chrome`, unprivileged `nobody`, enabled Chromium sandbox, and
isolated writable HOME/XDG directories. No temporary nested-runner workaround
is part of the successful evidence or shipped changes.

Media, browser reports, review notes, capture scripts and logs are staged under
`/root/.openclaw/workspace/media/exploration-series/pollinator-express/` with a
verified SHA256SUMS manifest. Capture reports retain honest baseline HEAD and
dirty-diff provenance; the final report records the committed source SHA.

## Security and remaining gaps

No server authorization, household boundaries, credentials, network permissions,
CSP or production services were changed. The existing sandbox worker protocol
remains authoritative for package validation. Bounded model/state checks,
isolated discovery adversarial/security tests and security-backport checks pass.
No new dependencies, raw HTML injection or dynamic execution paths were added.

No physical-device or real screen-reader session was performed. Native controls
use a simpler accessible platform composition while offline scenes preserve the
rich garden. Sources validate the biology explanations, not invented model
numbers. This checkpoint authorizes neither merge nor deployment.
