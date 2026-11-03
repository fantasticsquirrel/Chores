# Machine Workshop redesign verification

Completed 2026-11-03 on `feat/discovery-learning-overhaul`. Final commit and
remote/clean-tree proof are recorded in `/tmp/exploration-series-machine-workshop-report.md`.
This checkpoint does not authorize another module, merge, deployment, publication
or production database access. Overall series: **18 complete / 8 pending**;
**Heat House** is next, after parent checkpoint review.

## Learning and model

Two prediction-first, single-variable comparisons are shared by web/native and
mirrored in the self-contained package, with exact evidence, changed/held inputs,
correct/incorrect feedback and complete reset:

- Pulley sections 1→2: 40 kg, 0.5 m lift; effort392.4→196.2 N,
  travel0.5→1.0 m; input work and gravitational energy196.2 J.
- Driven gear teeth12→48: fixed driver12 teeth, load40 kg, lift0.5 m,
  crank/drum radii0.20 m; crank turns0.3979→1.5915; input torque78.48→19.62 N·m;
  output torque remains78.48 N·m; work/energy196.2 J.

Mass, weight, force, displacement, work/energy and torque are distinguished with
SI units. Ideal quasi-static assumptions, fixed gravity9.81 N/kg, friction/flexing
and real-efficiency boundaries are explicit. At zero lift, ideal efficiency is
an assumption rather than a measured 0/0. Authoritative claims are mapped in
[machine-workshop-copy-research.md](machine-workshop-copy-research.md).

## Dimensional scene and review corrections

Preserved and enriched wood/metal/brass workshop art, wall tools, lighting,
shadows, depth, mechanism geometry, fixed anchors and start references. All
load/ruler displacements use one scene unit per metre; lever effort movement,
pulley free-end travel and gear rotations obey their physical ratios. Focused
tests protect boundaries, topology, kinematics, framing and serializer parity.

Actual-image review drove fixes for clipping, half-scale lever motion, replay
continuing through comparisons, hidden anchors, ambiguous torque language and
mobile labels covering apparatus. Authored edge labels keep mechanisms visible;
web/package add leaders and native offline honors the same positions. The package
retains its external heading, suppresses the redundant in-scene heading, and uses
a complete compact radius callout. Native fallback is explicitly position-only.

Independent final acceptance:
`/tmp/machine-package-final-acceptance.md` (combines accepted web v3, physical
model corrections and actual package v5). Supervisor also personally inspected
before/final web, package and regenerated native offline images.

## Final verification

| Gate                                                             |                              Result |
| ---------------------------------------------------------------- | ----------------------------------: |
| Full frontend, after final corrections                           |                   876/876,161 files |
| Broad package, sequentially after frontend                       |                               48/48 |
| Shared API                                                       |                    573/573,45 files |
| Module contracts                                                 |                               10/10 |
| Native unit                                                      |                    296/296,32 files |
| Full native UI                                                   |                   532/532,63 suites |
| Native offline browser                                           |     27/27; all74 bounded SVG states |
| Isolated backend/security                                        |                               61/61 |
| Security backports                                               |                               51/51 |
| Native typecheck/freshness, scene typecheck, frontend lint/build |                                pass |
| Strict architecture                                              |          pass;0 boundary violations |
| Deterministic package                                            | two identical server-validated ZIPs |
| Web desktop/mobile proof                                         |             72 state captures, pass |
| Actual package desktop/mobile proof                              |             68 state captures, pass |

Logs are under `/tmp/machine-verification/` and staged media `logs/`. Full web and
broad package were rerun after the final native adapter correction. Failed logs
are retained: initial system Python lacked project dependencies; a stale native
reset-test label was corrected without product changes; one unrelated Homeschool
timing failure passed an isolated retry and unchanged full-native rerun. No
unrelated code or timeout was changed. Expo's dependency check used its offline
map, not a fresh advisory scan. The build retains its existing chunk-size advisory.

## Evidence and package

Media: `/root/.openclaw/workspace/media/exploration-series/machine-workshop/`.
True baseline uses the untouched e081838 build, frozen before any redesigned
build. Final desktop1440×1050/mobile390×844 matrices include full/component/scene/
ordinary viewport, controlled baseline/after, both feedback outcomes, all machine
families at ratio/lift extremes, rotation/Home, deterministic true mid-replay and
separate reduced-motion state. Keyboard input changes real React state, not only
DOM inputValue. Final full-page captures hide fixed navigation solely to avoid
stitching artifacts; ordinary viewports retain it and assert no obstruction.

Successful browsers use unprivileged nobody, explicit `/usr/bin/google-chrome`,
enabled sandboxing and writable isolated HOME/XDG directories. APIs are isolated
fixtures, not production accounts. Reports record zero errors or external/failed
requests. Native browser testing is offline Chromium, not a real-device claim.

Package1.0.4 ZIP SHA-256:
`c81fdef3e00bb366a89aedadb10c416eb5865e1a8f7e5d8e2748c7758d4222b9`.
The browser fixture executes the exact checked-in manifest/worker/assets; its
asset-list identity is not represented as the ZIP hash.

## Security and limits

OWASP review: server authorization/tenant boundaries, auth/session/CSRF,
credentials, transport/network policy and production services are unchanged.
No dependencies, raw HTML injection or dynamic execution paths were added.
Bounded inputs, worker protocol validation, no-network browser assertions,
checksum validation, isolated adversarial tests and backport checks pass.

No physical-device, touch-hardware or real screen-reader session was performed.
Native controls/fallback and package chrome differ graphically from web. Native
labels use compact platform styling; web alone provides timed replay. All
surfaces retain the same model, controlled learning, feedback and reset. This is
not a pixel-identical or real-machine efficiency claim.
