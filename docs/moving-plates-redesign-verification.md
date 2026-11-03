# Moving Plates redesign verification

Completed 2026-11-03 on `feat/discovery-learning-overhaul`. The exact final
commit, remote proof, clean-tree proof and evidence checksums are recorded in
`/tmp/exploration-series-moving-plates-report.md`. This checkpoint authorizes
no merge, deployment, publication, production service or production database
change. Overall series: **21 complete / 5 pending**; **Cloud and Rain Lab** is
next and remains untouched.

## Learning and model

One bounded pure model supplies web and native; the standalone package mirrors
it with exhaustive model, trial and complete scene parity. A learner selects a
relative plate-motion rate from 1–10 cm/yr and an elapsed model time from 0–5
million years. The exact displayed conversion is:

`relative motion (km) = rate (cm/yr) × time (million yr) × 10`.

The controls are teaching inputs, not the reconstructed history of named
plates. The default controlled comparison holds 4 cm/yr and 2.0 million years
fixed, giving 80 km of calculated relative motion. It changes only the boundary
example:

- Apart separates oceanic lithosphere at a submerged mid-ocean ridge, where
  localized melt can rise and cool into new oceanic crust.
- Together shows an oceanic–continental example: oceanic lithosphere bends at
  a trench and descends continuously beneath continental lithosphere. Localized
  mantle-wedge melt feeds a volcanic arc.
- Sideways moves lithosphere horizontally past itself. It neither creates nor
  destroys crust in this boundary model.

A separate qualitative locked-fault investigation starts at an invented 80%
loading index after four equal steps and changes only the fifth step. The index
drops to 0%, the illustrated slip count becomes one and the surface marker gains
a visible schematic offset. The five-step threshold, equal steps, regular
repetition, offset size and 20-slip display limit are invented; they have no
time or magnitude units. The model gives no earthquake date, location,
probability, magnitude, shaking level or hazard forecast.

The lesson consistently distinguishes crust, lithosphere and asthenosphere. A
tectonic plate is lithosphere—crust plus rigid uppermost mantle. The
asthenosphere is hot, slowly deforming, mostly solid rock, not a global liquid
magma layer. Scene widths, relief, trench depth, slab angle and vertical scale
are schematic. The complete 0–500 km numerical range maps to changing scene
geometry without pretending that the drawing is geographically scaled.

Both investigations implement prediction -> baseline -> one change -> evidence
-> correct/incorrect feedback -> explanation -> reset on web, native and the
standalone package. Quarter-million-year inputs are announced exactly: at
4 cm/yr, 0.25 million years gives 10 km and 0.75 gives 30 km.

## Dimensional scene and interaction

The original rich tectonic block was preserved and enriched rather than
flattened into cards or charts. It retains layered crust and mantle materials,
rock textures, ocean depth, terrain relief, shadows, directional arrows and
purposeful callouts. The redesigned scene adds continuous ridge water, new
oceanic crust, a segmented descending slab with crust above lithospheric mantle,
an exposed front cutaway, mantle-wedge melt, volcanic cones, a transform-fault
road, deformation markers, slip waves and a tally that stays meaningful through
the bounded slip range.

The Together slab joins the trench and descends at every segment; no slab
surface rises above the ocean. The Apart ridge remains submerged beneath a
continuous water surface. The first transform slip uses a deliberately
nonlinear schematic offset so it is visible at portrait width, while every
later accepted slip still changes the marker and tally. Tests cover these
geometry constraints, maximum 500 km model progress and the 20-slip bound.

Web motion is opt-in. A 1.3-second relative-motion sweep is explicitly
illustrative rather than geologic speed; it cancels on control changes,
comparison actions, hiding and unmount. Reduced-motion users keep the final
state and receive an explicit status. Controls, prediction flow, scene orbit,
Home reset and lesson resets are keyboard operable. Essential evidence is
available in text and does not depend on color or animation.

Package-specific portrait review found that a long mantle-wedge callout and the
generic nowrap rule could crowd the standalone renderer. The callout was
shortened without changing its meaning, narrow rich-package labels now wrap
with higher-specificity responsive styling, and the package heading was made
concise. The final 390 px package images contain all callouts and the same rich
geometry without horizontal overflow.

## Sources and editorial review

The claim map, numerical decisions, wording boundaries and primary links are in
[moving-plates-copy-research.md](moving-plates-copy-research.md). Raw HTTP 200
snapshots of three USGS legacy pages and a clearly identified same-day
search-index snapshot for modern USGS routes are staged with checksums under
the media `sources/` directory. No failed modern-page retrieval is described as
a successful raw download.

Rendered copy removes decorative observatory/bench labels and retains only
instruction, current state, evidence, explanation, controls, assumptions and
sources. It does not imply that all convergence is subduction, that the mantle
is fully liquid, or that the transform illustration predicts earthquakes.

## Independent review corrections

The independent host review at `/tmp/moving-plates-host-review-notes.md`
inspected the original and successive actual desktop/mobile images. All
required corrections were completed before the definitive product gates:

1. The convergent cutaway was exposed and the initial hidden slab was replaced
   by a physically continuous segmented descent from the trench.
2. The earlier above-water slab ramp and dry mid-ocean ridge were corrected;
   the slab now remains below the surface and the ridge stays underwater.
3. Transform slips remain visually meaningful through the bound, the first
   slip is visible on mobile and a no-op prevents false claims beyond 20.
4. Scene progress maps the full accepted 0–500 km range.
5. Purposeful opt-in replay and reduced-motion evidence were added.
6. Accessible arithmetic now uses the same two-decimal trailing-zero formatter
   as the visible readout and replay, with exact 0.25/0.75 regressions.

The third image review accepted the corrected rich art. A later in-app package
proof found and corrected the separate portrait label issue described above.

## Final verification

| Gate                                                       |                                          Result |
| ---------------------------------------------------------- | ----------------------------------------------: |
| Full frontend after final product correction               |                              885/885, 161 files |
| Broad rich-package suite immediately afterward             |                                           48/48 |
| Shared API/model                                           |                               591/591, 48 files |
| Module contracts                                           |                                           10/10 |
| Physical package workers and complete Moving Plates parity |            18/18 full; focused final parity 1/1 |
| Earth scene geometry                                       |                                             3/3 |
| Native unit                                                |                               296/296, 32 files |
| Native UI                                                  |                              532/532, 63 suites |
| Native offline browser                                     |                27/27; all 74 bounded SVG states |
| Isolated backend/package/security                          |                                           61/61 |
| Security backports                                         |                                           51/51 |
| Scene freshness                                            | 1,873,303-byte scenes; 1,068,282-byte SVG atlas |
| Native and scene typechecks                                |                                            pass |
| Frontend lint/build                                        |                                            pass |
| Offline Expo dependency map                                |                         dependencies up to date |
| Strict architecture                                        |                     pass; 0 boundary violations |
| Deterministic package                                      |       two byte-identical, server-validated ZIPs |
| Web desktop/mobile proof                                   |                         58 state captures, pass |
| Actual package desktop/mobile proof                        |                         54 state captures, pass |

Package 1.0.1 deterministic ZIP SHA-256:
`7bc6fe4dca95e28e0376b8a5ddf511e37a54e73abaf2615b29f92cfeffee90c4`.
The package browser executes the checked-in manifest, worker and assets; its
report records the asset-list identity separately from the ZIP hash.

Successful browser runs use explicit `/usr/bin/google-chrome`,
`chromiumSandbox: true`, unprivileged UID 65534 and isolated writable HOME/XDG.
The committed-source reports record the exact final SHA, empty source status,
the empty-diff SHA-256, and zero browser errors, failed requests or external
requests. Navigation is hidden for isolated captures with `visibility:hidden`,
never `display:none`; desktop component width and readout rectangles are
asserted inside that reversible style. Backend verification used only a newly
created disposable SQLite database under `/tmp/moving-plates-backend-*`; no
production database was read or written.

## Failure accounting and limits

Failures are retained rather than represented as passes:

- true-before Chromium could not run in the earlier restricted CLI context;
  the host captured 16 images with sandboxed Chrome from the immutable frontend
  build frozen before source edits;
- one focused frontend command used a root-relative path from inside the
  workspace and selected no tests; the corrected focused run passed 8/8;
- an exploratory three-file package glob exposed three failures outside Moving Plates in
  Fraction Feast, Machine Workshop copy-case and Moon/Orbit workflow failures;
  the established broad rich-package gate passed 48/48 and Moving Plates parity
  passed independently;
- the first shared gate used the wrong Python environment variable and system
  Python lacked Pillow/email-validator; the correct contract interpreter passed
  591/591;
- a repo-wide Prettier check reports 102 pre-existing files outside this change;
  all edited frontend/package source was formatted, ESLint and build pass;
- one bare package renderer run exceeded its five-second visibility timeout and
  passed unchanged with a fresh profile;
- early in-app package helpers used a non-secure `.local` origin, exact live
  range-label matching, then detected the real nowrap/crowding defect. The
  secure loopback, prefix-label, corrected 54-capture rerun passed.

No physical-device, touch-hardware or real screen-reader session was performed.
Native controls and package host chrome are not pixel-identical to web; their
model values, trial states and dimensional scene are parity-tested. Offline Expo
validation is a dependency-map check, not a fresh online advisory scan. The
frontend build retains its existing chunk-size advisory.
