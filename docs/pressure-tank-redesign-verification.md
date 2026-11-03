# Pressure Tank redesign verification

Completed 2026-11-03 on `feat/discovery-learning-overhaul`. The exact final
commit, remote proof and clean-tree proof are recorded in
`/tmp/exploration-series-pressure-tank-report.md`. This checkpoint authorizes no
merge, deployment, publication, production service or production database
change. Overall series: **20 complete / 6 pending**; **Moving Plates** is next
and has not been started.

## Learning and model

One bounded pure model now supplies web and native; the standalone package
mirrors it with exhaustive parity checks. For surface height `s` and outlet or
sensor height `y`, it uses the nonnegative vertical head `h = max(0, s - y)`:

- gauge pressure `p_g = rho g h`, with fixed fresh-water density
  `rho = 1,000 kg/m3` and `g = 9.81 m/s2`;
- absolute pressure `p_abs = 101.325 kPa + p_g`;
- net force `F_net = p_g A` on a separate closed `100 cm2` wall sensor whose
  back face is exposed to atmosphere;
- ideal speed `v = sqrt(2gh)` at a separate horizontal atmospheric nozzle;
- ideal floor-level range from that speed and the outlet's fall height;
- exact rectangular or tapered volume from the displayed tank geometry.

The sensor and free jet are deliberately not conflated: the sensor is closed,
while the emerging jet is approximately atmospheric. A dark insulated
electrical cable carries the sensor signal to the elevated display; it is not a
liquid-filled pressure line and does not introduce a hydrostatic-height
correction. Temperature is not a model input, so kelvin/Celsius conversion does
not apply. Gauge pressure, absolute pressure, pascals, kilopascals, newtons,
square metres, square centimetres, metres per second and litres are identified
where used.

Two prediction-first one-variable comparisons share exact before/after states,
evidence, correct/incorrect feedback, changed/held summaries and reset:

- Raise the water surface from 1 to 2 m with a narrow tank and outlet at 0.5 m.
  Head changes 0.5 to 1.5 m, gauge pressure 4.905 to 14.715 kPa, sensor net
  force 49.05 to 147.15 N and ideal speed 3.13 to 5.42 m/s. Pressure and force
  triple; speed changes by `sqrt(3)`.
- Change only tank shape from narrow to wide with surface 2 m and outlet 0.5 m.
  Volume changes 2,000 to 6,480 L, while 1.5 m head, 14.715 kPa gauge pressure,
  147.15 N sensor net force and 5.42 m/s ideal speed remain unchanged.

The bounded 0.2-3.0 m surface, 0.1-2.5 m outlet and three tank shapes are
teaching inputs, not measurements or equipment specifications. The frozen-level
model assumes an open tank, still incompressible frictionless water, negligible
surface speed, a small horizontal outlet, equal atmospheric pressure at the
surface and free jet, and ideal gravity. It omits draining, viscosity,
turbulence, contraction, air drag, splashing, wall stress, pumps, sealed gas and
temperature-dependent density. It is not pressure-vessel design, operating or
safety guidance. Authoritative claim mapping is in
[pressure-tank-copy-research.md](pressure-tank-copy-research.md).

## Dimensional scene and interaction

The original dimensional tank and wooden bench were preserved and enriched
with transparent layered walls, fasteners, braces, a valve/nozzle, parabolic
jet and impact marker, head bracket, force arrow, 100 cm2 sensor, electrical
signal cable, remote gauges, range ruler, working lamps, material highlights,
shadows and a hydraulics-lab backdrop. Surface height, outlet height, tank
shape, volume geometry, sensor force, head, pressure, ideal speed and jet path
all respond to the same bounded model.

The sensor centre is fixed at `z = 0.34 m`; its 0.10 m face remains within the
narrowest wall for every shape and tested outlet boundary. Geometry tests cover
all three shapes at outlet heights 0.1, 0.5 and 2.5 m and assert the sensor,
force arrow and cable connection stay aligned. The dark cable is named and
described as an insulated electrical signal cable. It no longer resembles the
previous brass liquid line.

Pressure-specific responsive framing keeps the tank at least 150 px high in the
tested 336 px web, 365 px package and 390 px native portrait scenes. The portrait
view purposefully crops outer decorative lab context while preserving the tank,
surface/head geometry, nozzle, jet and impact marker for narrow, wide, tapered,
maximum-head and maximum-range states. Desktop retains the full rich lab.
Authored callout slots and leaders avoid the earlier mobile label stack; exact
values repeat below the scene and are not color-dependent.

Web replay is opt-in and shows the surface rising while the outlet remains
fixed. Reduced-motion users receive the final state and an explicit status.
Replay cancels on manual control, guided comparison, document hiding and
unmount. Sliders, tank-shape controls, scene orbit/Home, prediction flow and
reset are keyboard operable. The package uses direct deterministic controls;
native provides the same controlled learning flow and regenerated rich offline
scene.

True-before evidence uses a separately frozen untouched build at baseline
`3cd849d1e0c48c1be6c27feab9ab0ffea3454909`. Final web evidence contains 58
captures and actual package evidence 54 captures across desktop/mobile
full/component/scene/ordinary viewport, both controlled investigations,
correct/incorrect feedback, dry outlet, maximum head, maximum range, wide,
tapered, rotated/Home, running replay and reduced motion. Reports assert no
horizontal overflow, clipped or overlapping authored callouts, browser errors,
failed requests or external requests.

## Independent review corrections

The parent review at `/tmp/pressure-independent-review-notes.md` compared actual
baseline and redesigned desktop/mobile images and required three corrections.
All were implemented before the definitive gates:

1. The 100 cm2 sensor, force arrow and cable connector moved inside the wall at
   every bounded state, with cross-shape/extreme geometry regressions.
2. The misleading brass gauge lead became a clearly insulated electrical
   signal cable in scene geometry, names and accessible explanations.
3. Portrait framing increased the central tank from about 94 px to at least
   150 px while retaining the jet and impact marker for wide, tapered and
   maximum-range states; outer decorative context is cropped rather than the
   teaching geometry.

An independent code and learning-flow critique also required explicit
gauge-force wording, a clear closed-sensor/atmospheric-nozzle distinction,
grade-band correction to 6-8, and replay lifecycle coverage. Those items were
corrected and the focused native flow passed 30/30 before full verification.

## Final verification

| Gate | Result |
| --- | ---: |
| Full frontend after final correction | 881/881, 161 files |
| Broad package, sequentially after frontend | 48/48 |
| Shared API/model | 585/585, 47 files |
| Module contracts | 10/10 |
| Physical package workers and Pressure parity cross-product | 17/17 |
| Native unit | 296/296, 32 files |
| Native UI | 532/532, 63 suites |
| Native offline browser | 27/27; all 74 bounded SVG states |
| Isolated backend/package/security | 61/61 |
| Security backports | 51/51 |
| Scene freshness, native/scene typecheck, frontend lint/build | pass |
| Offline Expo dependency map | dependencies up to date |
| Strict architecture | pass; 0 boundary violations |
| Deterministic package | two identical server-validated ZIPs |
| Web desktop/mobile proof | 58 state captures, pass |
| Actual package desktop/mobile proof | 54 state captures, pass |

Package 1.0.1 ZIP SHA-256:
`4a8115606de20237fc26db41b083edfe419425d58c27c33b05fce55d9e299d36`.
The package browser executes the exact checked-in manifest, worker and assets;
its report records the asset-list identity separately from the ZIP hash.

Successful browser runs use explicit `/usr/bin/google-chrome`,
`chromiumSandbox: true`, unprivileged UID 65534 and isolated writable HOME/XDG.
The committed-source reports record the exact final SHA, empty source status,
the empty-diff SHA-256, and zero browser errors, failed requests or external
requests. Backend verification used only the disposable SQLite database under
`/tmp/pressure-verification/`; no production database was read or written.

## Failure accounting and limits

Failed checks were retained rather than hidden:

- intentional test-first model, web and scene runs failed before the new model
  and learning behavior existed;
- the first shared gate used system Python, which lacked the repository Pillow
  dependency; the identical gate passed with `.venv/bin/python` through the
  documented contract environment;
- the first scene typecheck exposed a test-only `unknown` attribute cast; the
  typed `BufferAttribute` assertion and focused rerun passed before the
  definitive typecheck;
- one package visual run detected horizontal truncation in the long sensor
  callout; the callout was shortened while exact values remained in readouts,
  and the 54-capture rerun passed;
- an early native command selected a TSX suite with the unit-only Vitest
  pattern; the correct focused native UI run passed 30/30 and the full native UI
  run passed 532/532;
- a proposed cleanup command was rejected before test execution; a unique
  disposable database was used instead, without deleting any data.

No physical-device, touch-hardware or real screen-reader session was performed.
Native control chrome/React fallback and package host chrome are not
pixel-identical to web; the regenerated native offline scene and package/web
preserve the rich pressure apparatus and exact numerical model. Offline Expo
validation is a dependency-map check, not a fresh online advisory scan. The
frontend build retains its existing chunk-size advisory. These limitations do
not change numerical parity or the completed prediction-to-explanation flow.
