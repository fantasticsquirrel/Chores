# Cloud and Rain Lab redesign verification

Review checkpoint: 2026-11-03 on `feat/discovery-learning-overhaul`, working
from baseline `668ea2911b8237415e6b359d74b42108fa1f3ca8`. Independent science,
visual, web and standalone-package review is accepted. This checkpoint
authorizes no merge, deployment, publication, production service or production
database change. No commit or push has been made; the host commit is pending.
The series count is **22 complete / 4 pending**. Exploration #23 Magnetic
Fields is next, pending and untouched.

## Learning design and shared model

Web, native and the checked-in rich package use the same bounded state and two
prediction-first, baseline, one-change, numerical/visual evidence,
correct-or-incorrect feedback, explanation and reset investigations:

1. `Lift to saturation` holds 24 °C starting temperature, 60% starting RH,
   20 µm representative particle diameter and 80% below-cloud RH fixed while
   lift changes from 400 m to 1,600 m.
2. `Grow precipitation` holds the saturated parcel and both RH inputs fixed
   while representative liquid-particle diameter changes from 20 µm to
   1,000 µm. The diameter changes 50-fold and the spherical volume comparison
   is 125,000-fold.

The pure model bounds temperature to 22–32 °C, starting RH to 30–95%, lift to
0–2,000 m, representative diameter to 10–2,000 µm and below-cloud RH to
20–100%. It fixes starting pressure at 1,000 hPa, uses a Magnus saturation
vapor-pressure relationship, conserves starting vapor mixing ratio below
saturation, uses 9.8 °C/km dry cooling and uses an explicitly simplified fixed
6 °C/km rate above saturation.

The corrected cloud-base calculation numerically finds the first height where
that same dry-parcel pressure, temperature and conserved mixing ratio reach
100% RH. One crossing now controls displayed saturation, cloud depth and
condensate. At the crossing, RH is 100% but cloud depth and condensate are zero,
so no cloud or precipitation is drawn. A positive rise above it produces
positive modeled condensate before visible cloud or precipitation geometry is
allowed. At the default 24 °C/60% state the crossing is
`1,034.2509074462205 m`; at ±0.001 m the tests distinguish RH below 100% and no
condensate, exact saturation with zero condensate, then positive condensate.
The 32 °C/30% crossing is 2,456.269 m, outside the learner lift bound; the
bounded 2,000 m state therefore remains unsaturated with no cloud.

The particle input is a chosen representative size, not a growth-time model or
size distribution. The 200 µm value only turns on a visible precipitation path
for the controlled growth comparison; it is not a universal threshold for
falling. Any positive diameter that survives the invented D² evaporation path
is ground-reaching liquid precipitation in this model. Virga is assigned only
when the modeled diameter reaches exactly zero before the ground. A tested
300 µm particle through the 95% RH layer survives at about 133 µm and is not
virga; the tested 1,000 µm particle through the 20% RH layer reaches zero and is
virga. The 500 µm rain-size name and 1,400 µm²/m evaporation coefficient are
explicit teaching choices. Modeled condensate is an equilibrium parcel
difference, not measured cloud liquid-water content or supply for arbitrary
particles.

Water vapor remains identified as an invisible gas; visible cloud material is
liquid droplets, ice crystals or both. Copy does not say air literally holds
water or imply every cloud rains. The model is above-freezing and omits ice
growth, mixing/entrainment, detailed pressure-dependent microphysics, vertical
wind, fall speed, temperature-dependent evaporation, collision efficiency,
breakup, changing weather and a size distribution. It cannot forecast a cloud
base or precipitation for a place or time.

## Scene, accessibility and platform parity

The original rich dimensional landscape remains: layered terrain, lake,
vegetation, atmospheric lighting/depth, parcel marker, cloud material,
representative droplets, precipitation/virga paths and ground detail. It was
not reduced to cards or charts. State groups distinguish invisible vapor,
visible cloud without precipitation, small liquid precipitation at ground,
rain at ground and virga without relying on color. Cloud and precipitation are
now impossible in the scene when modeled condensate is zero.

Web retains keyboard sliders, keyboard orbit/Home reset, opt-in parcel replay,
cancel-on-change behavior and reduced-motion status. The dense detailed model
boundary is now under an accessible web `<details>` disclosure after a
short visible core note, reducing the repeated mobile page length without
removing limitations. Native uses a simpler platform diagram but shares model,
trial, measurements, outcomes and noncolor explanation. Offline native scenes
were regenerated after the correction. The standalone package mirrors the
pure model and rich scene exactly apart from import paths and directly tests
complete trial/model/serialized-scene parity.

## Authoritative sources and preserved fetches

The claim map and equation/assumption provenance are in
[cloud-rain-lab-copy-research.md](cloud-rain-lab-copy-research.md). The host
independently fetched these authoritative pages with HTTP 200 and preserved the
raw responses under `/tmp/exploration-series-cloud-rain-lab/sources`:

| Snapshot                     | URL                                                                                  | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `noaa-humidity.html`         | `https://www.nesdis.noaa.gov/about/k-12-education/atmosphere/what-humidity`          | `752c03dfd545bd8308bfeffec7b1a12187257aefd21a94d634e6c98472222b60` |
| `metoffice-water-cycle.html` | `https://weather.metoffice.gov.uk/learn-about/weather/how-weather-works/water-cycle` | `fa942043e676b1c88b4278dbac38c8ba1f9dc65a12c0ea211b91e458ac3cfdc0` |
| `nws-virga.html`             | `https://forecast.weather.gov/glossary.php?word=VIRGA`                               | `362e17500741c75368f11ec365307045584dbdd2325c618e8ef7fe0f2fc0dfef` |

The NOAA JetStream cloud/parcel/precipitation pages remain linked reviewed
references. A direct host snapshot request for the NOAA cloud page returned
HTTP 403, so it is not misrepresented as a successful raw snapshot.
The copy-ready media manifest is `/tmp/cloud-rain-lab-source-provenance.md`.

## Independent browser and visual acceptance

- The host captured and personally inspected 16 true-before desktop/mobile
  images from the untouched built frontend. The report is
  `/tmp/exploration-series-cloud-rain-lab/before/before-capture-report.json`
  (SHA-256 `ba88c3cd16868c00da21f32a78ec29db40ceb0849e9d173e2d8b157947565f4f`).
- The corrected web matrix passed 60 captures across desktop/mobile full,
  component, scene, ordinary viewport, operated, motion and reduced-motion
  states. The host inspected no-cloud, rain, virga and expanded-boundary states
  and accepted the rich art. The report has zero browser errors, failed or
  external requests, a 1,166 px desktop component, and zero readout overlaps.
  Both note paragraphs compute to contrast `10.6023:1`. Report:
  `/tmp/exploration-series-cloud-rain-lab/after/final-report.json` (SHA-256
  `2f140ccc854c1c9e00ba39f1e1e5302a688e541469182aa8addc1c221599e9a2`).
- The actual package matrix passed 54 captures with the same accepted rich
  model states and zero product browser errors, failed or external requests.
  Its one opaque-iframe `Navigator.serviceWorker` `SecurityError` per viewport
  is recorded separately as the expected sandbox denial caused by the
  Playwright `serviceWorkers:block` probe. The iframe CSP and opaque-origin
  security were not relaxed. Report:
  `/tmp/exploration-series-cloud-rain-lab/package/package-report.json`
  (SHA-256 `dfb409e760c663e0978727b685d3c883557b422258c96247e022b2af5b591f29`).
- The host native offline browser passed 27/27, including Cloud and Rain and
  every one of 74 bounded SVG states. The Cloud image SHA-256 is
  `b9aacca1a11d833b9b231e75a6087cec7ae566a071d796aa3d2444b457089496`.
- All successful browser gates use explicit `/usr/bin/google-chrome`,
  `chromiumSandbox: true`, UID/GID 65534, writable isolated HOME/XDG,
  `serviceWorkers:block`, and loopback-only fixtures. Navigation is hidden with
  `visibility:hidden`, never `display:none`.
- Final scope review restored `frontend/src/main.tsx` byte-for-byte to HEAD.
  The package sandbox denial is not evidence for changing or suppressing the
  application's global service-worker registration.

The original review failures remain documented in
`/tmp/cloud-rain-host-review-notes.md`: conflicting saturation equations,
nonzero precipitation mislabeled virga, the actual package parser rejecting a
2,200 m bound, and dark inherited note text. Their corrected runtime states,
parser acceptance and contrast were independently accepted before definitive
gates.

## Definitive command and log ledger

All logs are staged under
`/tmp/exploration-series-cloud-rain-lab/logs/`. Commands ran from the repository
root unless noted.

| Command                                                                                                                                                                                                                                |                                                                                             Result | Log                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------: | --------------------------------------------------------------------------------- |
| `npm run test --workspace frontend`                                                                                                                                                                                                    |                                                                                 887/887, 161 files | `frontend-full-definitive-final.log`                                              |
| `npx vitest run scripts/exploration-packages/shared/tactile-landscape-packages.test.ts --environment node --maxWorkers=1` immediately after frontend                                                                                   |                                                                                              48/48 | `package-broad-definitive-final.log`                                              |
| `FAMILY_TREE_CONTRACT_PYTHON=/tmp/learning-module-overhaul/.venv/bin/python npm run shared-api:gate` on host                                                                                                                           |                                                                                  596/596, 49 files | `shared-api-host-final.log`                                                       |
| `npm run modules:validate`                                                                                                                                                                                                             |                                                                                              10/10 | `module-contracts-definitive.log`                                                 |
| `node scripts/build-exploration-packages.mjs cloud-rain-lab`                                                                                                                                                                           |                                                         397,989 bytes, byte-identical regeneration | `package-generation-definitive.log`, `package-generation-byte-identity.log`       |
| `node --test scripts/exploration-packages/physical-packages.test.mjs`                                                                                                                                                                  |                                             passing file; all defined worker/parity cases executed | `physical-packages-definitive.log`                                                |
| `npm run test:unit --workspace mobile`                                                                                                                                                                                                 |                                                                                  296/296, 32 files | `native-unit-definitive.log`                                                      |
| `npm run test:ui --workspace mobile`                                                                                                                                                                                                   |                                                                                 533/533, 63 suites | `native-ui-definitive.log`                                                        |
| host `npm run scenes:test:browser --workspace mobile` with sandboxed Chrome fixture                                                                                                                                                    |                                                                           27/27; all 74 SVG states | `native-offline-browser-host-final.log`                                           |
| `npm run scenes:check --workspace mobile`                                                                                                                                                                                              |                                                    1,881,809-byte scenes; 1,068,397-byte SVG atlas | `scenes-freshness-definitive.log`                                                 |
| `npm run typecheck --workspace @family-manager/discovery-scenes`                                                                                                                                                                       |                                                                                               pass | `scene-typecheck-definitive.log`                                                  |
| `npm run typecheck --workspace mobile`                                                                                                                                                                                                 |                                                                                               pass | `native-typecheck-definitive.log`                                                 |
| `npm run check:dependencies --workspace mobile`                                                                                                                                                                                        |                                                            local offline dependency map up to date | `native-dependencies-definitive.log`                                              |
| `npm run lint`                                                                                                                                                                                                                         |                                                                                pass, zero warnings | `frontend-lint-definitive.log`                                                    |
| `npm run build`                                                                                                                                                                                                                        |                                                                                               pass | `frontend-build-definitive.log`                                                   |
| `npm run architecture:report -- --strict`                                                                                                                                                                                              |                                                                     pass, zero boundary violations | `architecture-strict-definitive.log`                                              |
| `npm run security:backports`                                                                                                                                                                                                           |                                         source backports and upstream artifacts pass; 4 test files | `security-backports-definitive.log`                                               |
| `node --test scripts/ci-security-audit-contract.test.mjs`                                                                                                                                                                              |                                                                                                1/1 | `security-audit-contract-definitive.log`                                          |
| host `npm audit --workspace frontend --omit=dev --audit-level=high`                                                                                                                                                                    |                                                                                  0 vulnerabilities | `frontend-runtime-audit-host-final.log`                                           |
| host `bash scripts/audit-mobile-runtime-dependencies.sh`                                                                                                                                                                               | pass; 7 raw low findings, exact source backport admitted, no remaining findings after verification | `mobile-runtime-audit-host-final.log`                                             |
| host `bash /tmp/cloud-rain-lab-host-backend-final.sh` (ten isolated discovery/backend/security files; disposable `DATABASE_URL`)                                                                                                       |                                                                                              61/61 | `backend-isolated-host-final.log`, `backend-host-disposable-path.log`             |
| `.venv/bin/python scripts/discovery-packages.py build docs/examples/discovery-packages/cloud-rain-lab /tmp/cloud-rain-lab-1.0.1-{a,b}.zip`; `cmp`; `sha256sum`; `.venv/bin/python scripts/discovery-packages.py validate` on both ZIPs |                                                                                identical and valid | `package-zip-*.log`                                                               |
| authored changed files `npx prettier --check ...`; final `git diff --check`                                                                                                                                                            |                                                                                               pass | `edited-source-format-final.log`, `docs-format-final.log`, `diff-check-final.log` |

The checked-in worker SHA-256 is
`afb10339904ea00391c2d321dd8cc948a39e03c52d40b10466e050b44756c995`.
Two independently built, server-validated version 1.0.1 ZIPs are byte-identical
at SHA-256
`2d6e5a2ccecb4de511f8e006787c004ea27d10bbc530e67cc0832b652932470e`.
They are staged at `/tmp/cloud-rain-lab-1.0.1-a.zip` and `-b.zip`.

## Security and remaining limits

The OWASP review found no new server route, authorization, session, CSRF,
credential, transport, dynamic-HTML, remote-fetch or production-service
surface. Bounded worker inputs, exact rich-frame parsing, opaque sandbox CSP,
no-network browser assertions, deterministic package validation, adversarial
backend coverage, strict architecture and verified dependency source backports
remain the applicable controls. Production `main.tsx` and package CSP are not
weakened.

The host frontend runtime audit found zero vulnerabilities. The host mobile
runtime audit retained seven raw low-severity, version-based findings in the
Expo dependency graph. Its fail-closed verifier accepted the exact installed
`deepmerge` source backport and reported `no-remaining-findings`; this is not
misstated as a zero-advisory audit or a patched npm release. No dependency was
changed. The earlier restricted frontend and mobile audit attempts could not
reach `registry.npmjs.org` (`EAI_AGAIN`), and the mobile attempt also recorded a
nested Node `EPERM`; those unsuccessful attempts remain in
`frontend-runtime-audit-definitive.log` and
`mobile-runtime-audit-definitive.log`. Expo's separate dependency check used
its local offline map and is not an online advisory scan.

No physical-device, touch-hardware or real screen-reader session was run.
Native and package chrome are not pixel-identical to web, though model, trial
and scene state parity is tested. The frontend build retains its existing
third-party Rollup annotation and large-chunk advisories.

## Failure accounting

- The initial restricted before-capture browser path could not launch; the host
  captured and inspected the untouched frozen build instead.
- Before science acceptance, the first full frontend run passed 886 and failed
  one unrelated dashboard timing test; its unchanged isolated file passed 8/8,
  then the full rerun passed 887/887. A later broad run was deliberately
  interrupted for independent review and is not called a pass.
- After acceptance, a first log destination was host-owned and rejected `tee`.
  That frontend process reported 886/887 on the unrelated view-only Homeschool
  PDF assertion. The unchanged file passed 16/16 in isolation, and the final
  full run passed 887/887 followed immediately by 48/48. After restoring
  `main.tsx` to baseline, the required final sequence passed again at 887/887
  then 48/48.
- Two restricted shared-contract attempts timed out five Family Tree producer
  setup suites; the second was deliberately interrupted after reproducing the
  timeout. The host standalone producer emitted 45,069 bytes and the exact
  virtualenv shared gate passed 596/596 in 58.77 seconds. No production database
  was used.
- A restricted isolated-backend attempt collected 61 tests, passed the first
  nine architecture tests, then stalled in `test_discovery_api.py`; it was
  terminated once. The exact disposable host command is
  `/tmp/cloud-rain-lab-host-backend-final.sh`. The host route then passed 61/61
  in 50.71 seconds against only
  `/tmp/cloud-rain-host-backend-3ABjyS/discovery.sqlite3`; its two warnings are
  the established Starlette deprecation and deliberate duplicate-ZIP-name
  adversarial fixture.
- The first format selection included the mechanically generated compact
  package manifest and reported it as non-Prettier. No file was changed; the
  corrected authored-source selection passed.

## Durable full-series follow-up

Cloud and Rain Lab does not silently absorb or dismiss three exploratory legacy
failures discovered during Moving Plates. Full-series final verification must
triage/fix or explicitly resolve these exact tests:

- `fraction slice selection remains in range after reducing the denominator`;
- `changing a controlled variable clears stale fixed numerical comparison evidence`;
- `wrong Moon and orbit predictions never receive a matching-prediction reward`.

Their preserved source log is
`/root/.openclaw/workspace/media/exploration-series/moving-plates/logs/package-broad-shared.log`.
Their live assertions are
`scripts/exploration-packages/shared/education-regressions.test.ts:58`, `:111`
and `:129`, respectively. They are not represented as part of the established
green 48-test broad gate.

## Completed checkpoint

Cloud and Rain Lab #22 is complete at the accepted review checkpoint. The final
commit SHA, clean-tree proof, remote proof and committed-source screenshot
checksums are recorded in `/tmp/exploration-series-cloud-rain-lab-report.md`.
The protected stash `2f445b9b5ccfba50775d3dfb00db8e975c3699da` remains unchanged.
Magnetic Fields #23 is next and untouched; the overall series remains open.
No merge, deployment, publication or production change is authorized.
